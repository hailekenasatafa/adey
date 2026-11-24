#!/usr/bin/env node
/**
 * Fails when an emoji, or a text symbol standing in for an icon, appears in the website source.
 * The website uses Lucide icons only (lucide-react). Typographic marks such as · – — … “ ” and the
 * multiplication sign in quantities ("2 × Injera") are allowed.
 *
 * Usage: node scripts/check-no-emoji.mjs [dir ...]   (defaults to src and ../../packages/shared/src)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const here = new URL('..', import.meta.url).pathname;
const roots = process.argv.slice(2).length ? process.argv.slice(2) : [join(here, 'src'), join(here, '../../packages/shared/src')];
const exts = /\.(tsx?|jsx?|mjs|css|json|md|html)$/;
const skip = new Set(['node_modules', '.next', 'dist', 'build']);

// Emoji and pictographs, dingbats and miscellaneous symbols (check marks, stars, suns, crosses, the "hamburger" ☰),
// arrows, small triangles used as carets, angle quotes used as chevrons, and the emoji presentation selector.
const banned = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{2190}-\u{21FF}\u{25A0}-\u{25FF}\u{2039}\u{203A}\u{FE0F}]/u;

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (exts.test(name)) {
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        const m = line.match(banned);
        if (m) hits.push(`${relative(process.cwd(), p)}:${i + 1}  U+${m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}  ${line.trim().slice(0, 100)}`);
      });
    }
  }
}
for (const r of roots) { try { walk(r); } catch (e) { if (e.code !== 'ENOENT') throw e; } }

if (hits.length) {
  console.error(`No emojis or symbol icons in the website: use a Lucide icon instead (${hits.length} found).\n`);
  console.error(hits.join('\n'));
  process.exit(1);
}
console.log('check-no-emoji: clean');
