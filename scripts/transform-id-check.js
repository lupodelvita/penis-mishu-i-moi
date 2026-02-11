#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readBuiltinTransforms() {
  const file = path.join(__dirname, '..', 'packages', 'shared-types', 'src', 'transform.ts');
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8');
  const m = content.match(/BUILTIN_TRANSFORMS\s*=\s*\{([\s\S]*?)\}\s*as const/);
  if (!m) return [];
  const body = m[1];
  const vals = [];
  const re = /:\s*'([^']+)'/g;
  let mm;
  while ((mm = re.exec(body)) !== null) {
    vals.push(mm[1]);
  }
  return vals;
}

function collectIds(dir) {
  const ids = new Set();
  function walk(d) {
    const items = fs.readdirSync(d, { withFileTypes: true });
    for (const it of items) {
      const p = path.join(d, it.name);
      if (it.isDirectory()) {
        if (it.name === 'node_modules' || it.name === '.next' || it.name === 'dist') continue;
        walk(p);
      } else if (it.isFile()) {
        if (!/\.(ts|tsx|js|jsx)$/i.test(it.name)) continue;
        const txt = fs.readFileSync(p, 'utf8');
        const re = /id:\s*'([^']+)'/g;
        let m;
        while ((m = re.exec(txt)) !== null) ids.add(m[1]);
      }
    }
  }
  walk(dir);
  return Array.from(ids);
}

function findCollisions(ids) {
  const set = new Set(ids);
  const collisions = [];
  for (const id of ids) {
    const altDot = id.replace(/_/g, '.');
    const altUnd = id.replace(/\./g, '_');
    if (altDot !== id && set.has(altDot)) {
      collisions.push({ a: id, b: altDot });
    } else if (altUnd !== id && set.has(altUnd)) {
      collisions.push({ a: id, b: altUnd });
    }
  }
  // dedupe pairs
  const uniq = new Map();
  for (const c of collisions) {
    const key = [c.a, c.b].sort().join('::');
    uniq.set(key, c);
  }
  return Array.from(uniq.values());
}

function replaceInFiles(dir, from, to) {
  let changed = 0;
  function walk(d) {
    const items = fs.readdirSync(d, { withFileTypes: true });
    for (const it of items) {
      const p = path.join(d, it.name);
      if (it.isDirectory()) {
        if (it.name === 'node_modules' || it.name === '.next' || it.name === 'dist') continue;
        walk(p);
      } else if (it.isFile()) {
        if (!/\.(ts|tsx|js|jsx)$/i.test(it.name)) continue;
        let txt = fs.readFileSync(p, 'utf8');
        const newTxt = txt.split("id: '").join("id: '") // noop to keep pattern
          .replace(new RegExp("id:\\\s*'" + from.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + "'", 'g'), "id: '" + to + "'");
        if (newTxt !== txt) {
          fs.writeFileSync(p, newTxt, 'utf8');
          changed++;
        }
      }
    }
  }
  walk(dir);
  return changed;
}

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const srcRoot = repoRoot; // search entire repo but skip node_modules/.next in logic
  const ids = collectIds(srcRoot);
  const builtins = readBuiltinTransforms();

  console.log('Found', ids.length, 'unique IDs in source');
  // show collisions dot/underscore
  const collisions = findCollisions(ids);
  if (collisions.length === 0) {
    console.log('No dot/underscore collisions found.');
  } else {
    console.error('Found naming collisions (dot vs underscore):');
    collisions.forEach(c => console.error(`  - ${c.a}  <->  ${c.b}`));
  }

  // Optionally attempt fixes when --fix provided: prefer dot-form if exists in builtins or if b contains '.'
  const args = process.argv.slice(2);
  if (args.includes('--fix')) {
    let totalChanges = 0;
    for (const c of collisions) {
      // choose replacement target
      let from = c.a;
      let to = c.b;
      // prefer dot-form (contains '.')
      if (!to.includes('.') && from.includes('.')) {
        from = c.b; to = c.a;
      }
      // prefer builtins
      if (builtins.includes(c.a) && !builtins.includes(c.b)) { from = c.b; to = c.a; }
      if (builtins.includes(c.b) && !builtins.includes(c.a)) { from = c.a; to = c.b; }

      console.log(`Replacing occurrences: ${from} -> ${to}`);
      const changed = replaceInFiles(repoRoot, from, to);
      totalChanges += changed;
    }
    console.log('Total files changed:', totalChanges);
    if (totalChanges > 0) process.exit(0);
  }

  if (collisions.length > 0) process.exit(2);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
