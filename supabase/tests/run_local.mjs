#!/usr/bin/env node
/**
 * Local database validation without installing Postgres.
 *
 * Boots an in-process Postgres (PGlite, WASM), applies the platform shim, every
 * migration in order, the seed, and then the SQL acceptance suite.
 *
 *   node supabase/tests/run_local.mjs            # migrations + seed + acceptance.sql
 *   node supabase/tests/run_local.mjs --no-tests # migrations + seed only
 *   node supabase/tests/run_local.mjs --types    # also regenerate packages/shared/src/database.types.ts
 *
 * Each migration file runs inside ONE transaction, exactly like `supabase db push`,
 * so problems such as using a freshly added enum value in the same migration are
 * caught here instead of on the real project.
 *
 * The acceptance files are written for psql; the few meta-commands they use
 * (\set, \echo, \gset and :'var' interpolation) are interpreted here. CI still
 * runs the same files with real psql against Postgres 16.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const args = new Set(process.argv.slice(2));

async function load() {
  try {
    const [{ PGlite }, { pgcrypto }, { pg_trgm }, { citext }, { unaccent }] = await Promise.all([
      import('@electric-sql/pglite'),
      import('@electric-sql/pglite/contrib/pgcrypto'),
      import('@electric-sql/pglite/contrib/pg_trgm'),
      import('@electric-sql/pglite/contrib/citext'),
      import('@electric-sql/pglite/contrib/unaccent'),
    ]);
    return { PGlite, extensions: { pgcrypto, pg_trgm, citext, unaccent } };
  } catch (e) {
    console.error('Could not load @electric-sql/pglite. Run `pnpm install` at the repo root first.\n', e.message);
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// A small psql-compatible script reader: splits on top-level semicolons, keeps
// strings / dollar-quotes / comments intact, and surfaces backslash commands.
// ---------------------------------------------------------------------------
function* readScript(sql) {
  let buf = '';
  let i = 0;
  const n = sql.length;
  const flush = () => {
    const s = buf.trim();
    buf = '';
    return s;
  };
  while (i < n) {
    const c = sql[i];
    const c2 = sql[i + 1];
    // line comment
    if (c === '-' && c2 === '-') {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? n : end;
      continue;
    }
    // block comment (nestable)
    if (c === '/' && c2 === '*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') { depth++; i += 2; }
        else if (sql[i] === '*' && sql[i + 1] === '/') { depth--; i += 2; }
        else i++;
      }
      continue;
    }
    // single-quoted string (E'' strings honour backslash escapes)
    if (c === "'") {
      const escapes = /[eE]$/.test(buf) && !/[A-Za-z0-9_][eE]$/.test(buf);
      let j = i + 1;
      while (j < n) {
        if (escapes && sql[j] === '\\') { j += 2; continue; }
        if (sql[j] === "'") { if (sql[j + 1] === "'") { j += 2; continue; } break; }
        j++;
      }
      buf += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    // double-quoted identifier
    if (c === '"') {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === '"') { if (sql[j + 1] === '"') { j += 2; continue; } break; }
        j++;
      }
      buf += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    // dollar-quoted string
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 80));
      if (m && !/[A-Za-z0-9_]$/.test(buf)) {
        const tag = m[0];
        const end = sql.indexOf(tag, i + tag.length);
        const stop = end === -1 ? n : end + tag.length;
        buf += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }
    // backslash (psql meta) command: runs to end of line
    if (c === '\\' && /[A-Za-z]/.test(c2 ?? '')) {
      const end = sql.indexOf('\n', i);
      const line = sql.slice(i + 1, end === -1 ? n : end).trim();
      i = end === -1 ? n : end;
      const [name, ...rest] = line.split(/\s+/);
      yield { meta: name, args: rest, pending: flush() };
      continue;
    }
    if (c === ';') {
      const s = flush();
      i++;
      if (s) yield { sql: s };
      continue;
    }
    buf += c;
    i++;
  }
  const tail = flush();
  if (tail) yield { sql: tail };
}

/** psql-style variable interpolation outside of quoted text: :'name' and :name. */
function interpolate(stmt, vars) {
  let out = '';
  let i = 0;
  const n = stmt.length;
  while (i < n) {
    const c = stmt[i];
    if (c === "'") {
      let j = i + 1;
      while (j < n) { if (stmt[j] === "'") { if (stmt[j + 1] === "'") { j += 2; continue; } break; } j++; }
      out += stmt.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(stmt.slice(i, i + 80));
      if (m) { const end = stmt.indexOf(m[0], i + m[0].length); const stop = end === -1 ? n : end + m[0].length; out += stmt.slice(i, stop); i = stop; continue; }
    }
    if (c === ':' && stmt[i - 1] !== ':' && stmt[i + 1] !== ':' && stmt[i + 1] !== '=') {
      const quoted = /^:'([A-Za-z_][A-Za-z0-9_]*)'/.exec(stmt.slice(i, i + 80));
      if (quoted && quoted[1] in vars) { out += "'" + String(vars[quoted[1]]).replace(/'/g, "''") + "'"; i += quoted[0].length; continue; }
      const bare = /^:([A-Za-z_][A-Za-z0-9_]*)/.exec(stmt.slice(i, i + 80));
      if (bare && bare[1] in vars) { out += String(vars[bare[1]]); i += bare[0].length; continue; }
    }
    out += c; i++;
  }
  return out;
}

async function runFile(db, file, { transaction = false, quiet = false } = {}) {
  const sql = readFileSync(file, 'utf8');
  const vars = {};
  const notices = [];
  const onNotice = (n) => {
    const msg = n.message ?? String(n);
    notices.push(msg);
    if (!quiet) console.log(`  ${msg}`);
  };
  const exec = async (stmt) => {
    const text = interpolate(stmt, vars);
    try {
      return await db.query(text, [], { onNotice });
    } catch (e) {
      const where = text.length > 600 ? text.slice(0, 600) + ' …' : text;
      throw new Error(`${basename(file)}: ${e.message}\n--- statement ---\n${where}`);
    }
  };
  if (transaction) await db.query('begin');
  try {
    for (const part of readScript(sql)) {
      if (part.sql) { await exec(part.sql); continue; }
      const { meta, args: a, pending } = part;
      if (meta === 'gset') {
        const res = await exec(pending);
        const row = res.rows?.[0];
        if (row) for (const [k, v] of Object.entries(row)) vars[(a[0] ?? '') + k] = v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
        continue;
      }
      if (pending) await exec(pending);
      if (meta === 'set') vars[a[0]] = a.slice(1).join(' ');
      else if (meta === 'echo') console.log(a.join(' '));
      // other meta-commands (\pset, \timing, …) are irrelevant here
    }
    if (transaction) await db.query('commit');
  } catch (e) {
    await db.query('rollback').catch(() => {});
    throw e;
  }
  return notices;
}

const { PGlite, extensions } = await load();
const db = new PGlite({ extensions });
await db.waitReady;

const started = Date.now();
await runFile(db, join(here, 'local_shim.sql'), { quiet: true });
const migrationsDir = join(root, 'supabase', 'migrations');
const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
for (const f of migrations) {
  process.stdout.write(`applying ${f}\n`);
  await runFile(db, join(migrationsDir, f), { transaction: true, quiet: true });
}
const seed = join(root, 'supabase', 'seed.sql');
if (existsSync(seed)) {
  console.log('applying seed.sql');
  await runFile(db, seed, { quiet: true });
}
console.log(`ALL MIGRATIONS OK (${migrations.length} files, ${((Date.now() - started) / 1000).toFixed(1)}s)`);

if (args.has('--types')) {
  const { generateTypes } = await import('./gen_types.mjs');
  const out = join(root, 'packages', 'shared', 'src', 'database.types.ts');
  writeFileSync(out, await generateTypes(db));
  console.log(`wrote ${out}`);
}

if (!args.has('--no-tests')) {
  const suites = readdirSync(here).filter((f) => /^acceptance.*\.sql$/.test(f)).sort();
  let passed = 0;
  for (const f of suites) {
    console.log(`\nrunning ${f}`);
    const notices = await runFile(db, join(here, f), { quiet: false });
    passed += notices.filter((m) => m.startsWith('PASS')).length;
  }
  console.log(`\n${passed} checks passed across ${suites.length} suite(s)`);
}
await db.close();
