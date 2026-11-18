// Static check for the edge functions (there is no Deno toolchain in every dev setup, and they talk to
// payment / carrier / AI providers, so they cannot simply be run in tests).
//
// It reads every supabase/functions/**/*.ts file and verifies, against the generated database types, that
//   * every  .rpc('name', { p_arg: … })  names a real function, uses only real argument names, and passes all required ones;
//   * every  .from('table')  names a real table, and the columns in  .select('…')  and in simple filters exist.
// Run: node supabase/tests/check_edge_calls.mjs      (exit code 1 when something does not match)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const types = fs.readFileSync(path.join(root, 'packages/shared/src/database.types.ts'), 'utf8').replace(/\r/g, '');
const section = (from, to) => types.slice(types.indexOf(`    ${from}: {`), types.indexOf(`    ${to}: {`));
const tablesText = section('Tables', 'Views') + section('Views', 'Functions');
const functionsText = section('Functions', 'Enums');

/** name -> text of its entry (up to the next entry at the same indentation) */
function entries(text) {
  const out = new Map();
  const re = /\n      "(\w+)":/g;
  let m;
  let prev = null;
  while ((m = re.exec(text))) {
    if (prev) out.set(prev.name, text.slice(prev.at, m.index));
    prev = { name: m[1], at: m.index };
  }
  if (prev) out.set(prev.name, text.slice(prev.at));
  return out;
}
const tables = new Map([...entries(tablesText)].map(([name, body]) => {
  const row = body.slice(body.indexOf('Row: {'), body.indexOf('\n        }', body.indexOf('Row: {')));
  return [name, new Set([...row.matchAll(/"(\w+)"\??:/g)].map((x) => x[1]))];
}));
const functions = new Map([...entries(functionsText)].map(([name, body]) => {
  const all = new Set([...body.matchAll(/"(p_\w+)"\??:/g)].map((x) => x[1]));
  const overloaded = (body.match(/Args:/g) ?? []).length > 1;
  const required = overloaded ? new Set() : new Set([...body.matchAll(/"(p_\w+)":/g)].map((x) => x[1]));
  return [name, { all, required }];
}));

/** Text of the balanced {...} or (...) that starts at `open`. */
function balanced(src, open) {
  const pairs = { '{': '}', '(': ')', '[': ']' };
  const stack = [];
  let quote = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return src.slice(open, i + 1);
    }
  }
  return src.slice(open);
}
/** Top-level property names of an object literal's text. */
function topKeys(obj) {
  const keys = [];
  let depth = 0;
  let quote = null;
  let part = '';
  const flush = () => {
    const m = part.match(/^\s*(?:\/\/[^\n]*\n\s*)*["']?(\w+)["']?\s*(:|$)/);
    if (m) keys.push(m[1]);
    else if (part.trim().startsWith('...')) keys.push('...');
    part = '';
  };
  for (const c of obj.slice(1, -1)) {
    if (quote) {
      if (c === quote) quote = null;
      part += c;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    if ('{(['.includes(c)) depth++;
    if ('})]'.includes(c)) depth--;
    if (c === ',' && depth === 0) flush();
    else part += c;
  }
  flush();
  return keys;
}
/** Top-level items of a PostgREST select string. */
function selectItems(sel) {
  const items = [];
  let depth = 0;
  let part = '';
  for (const c of sel) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { items.push(part.trim()); part = ''; } else part += c;
  }
  if (part.trim()) items.push(part.trim());
  return items;
}

const problems = [];
let rpcCount = 0;
let fromCount = 0;
const dir = path.join(root, 'supabase/functions');
const files = fs.readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.ts')).map((f) => path.join(dir, String(f)));

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const lineOf = (i) => src.slice(0, i).split('\n').length;
  const complain = (i, text) => problems.push(`${rel}:${lineOf(i)}  ${text}`);

  for (const m of src.matchAll(/\.rpc\(\s*'(\w+)'/g)) {
    rpcCount++;
    const fn = functions.get(m[1]);
    if (!fn) { complain(m.index, `rpc '${m[1]}' does not exist`); continue; }
    const after = src.slice(m.index + m[0].length);
    const comma = after.match(/^\s*,\s*/);
    let keys = [];
    if (comma) {
      const at = m.index + m[0].length + comma[0].length;
      if (src[at] !== '{') continue; // arguments built elsewhere (a variable): not checked here
      keys = topKeys(balanced(src, at));
    }
    if (keys.includes('...')) continue;
    for (const k of keys) if (!fn.all.has(k)) complain(m.index, `rpc '${m[1]}' has no argument '${k}'`);
    for (const k of fn.required) if (!keys.includes(k)) complain(m.index, `rpc '${m[1]}' is missing required argument '${k}'`);
  }

  for (const m of src.matchAll(/\.from\(\s*'(\w+)'\s*\)/g)) {
    fromCount++;
    const cols = tables.get(m[1]);
    if (!cols) { complain(m.index, `table '${m[1]}' does not exist`); continue; }
    // the rest of the call chain: up to the end of the statement
    const chain = src.slice(m.index, m.index + 1500).split(/;\s*\n/)[0];
    const sel = chain.match(/\.select\(\s*(['"`])([\s\S]*?)\1/);
    if (sel) {
      for (const item of selectItems(sel[2])) {
        if (item === '*' || item === '') continue;
        const embed = item.match(/^(?:\w+:)?(\w+)(?:!\w+)?\(([\s\S]*)\)$/);
        if (embed) {
          const other = tables.get(embed[1]);
          if (!other) { complain(m.index, `embedded table '${embed[1]}' does not exist`); continue; }
          for (const c of selectItems(embed[2])) {
            const name = c.replace(/^\w+:/, '').replace(/::\w+$/, '');
            if (name !== '*' && /^\w+$/.test(name) && !other.has(name)) complain(m.index, `'${embed[1]}' has no column '${name}'`);
          }
          continue;
        }
        const name = item.replace(/^\w+:/, '').replace(/::\w+$/, '');
        if (/^\w+$/.test(name) && !cols.has(name)) complain(m.index, `'${m[1]}' has no column '${name}'`);
      }
    }
    for (const f of chain.matchAll(/\.(?:eq|neq|in|is|gt|gte|lt|lte|like|ilike|order)\(\s*'(\w+)'/g)) {
      if (!cols.has(f[1])) complain(m.index, `'${m[1]}' has no column '${f[1]}' (used in a filter)`);
    }
  }
}

console.log(`${files.length} files, ${rpcCount} rpc calls, ${fromCount} table reads checked against ${functions.size} functions and ${tables.size} tables`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log('EDGE FUNCTION CALLS MATCH THE SCHEMA');
