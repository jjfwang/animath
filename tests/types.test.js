'use strict';
/* types.test.js — guards the hand-authored .d.ts files (issue #635):
 * for every JS subpath in package.json's exports map, a sibling .d.ts must
 * exist, and every name the JS module actually exports must be declared in
 * the .d.ts. package.json's "types" field must resolve to an existing file.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));

// Subpaths of the exports map that point at JS files (skip ./package.json).
function jsSubpaths() {
  return Object.entries(pkg.exports)
    .filter(([, target]) => typeof target === 'string' && target.endsWith('.js'))
    .map(([subpath, target]) => ({ subpath, js: path.join(REPO, target) }));
}

// Declared top-level names in a .d.ts: exported functions, interfaces,
// type aliases, consts and classes, including re-exported `import type`.
// A union of cheap regexes is enough for hand-authored defs of this repo's
// size; the test asserts export-name coverage, not syntactic completeness.
function declaredNames(dtsText) {
  const names = new Set();
  const patterns = [
    { re: /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g, braces: false },
    { re: /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g, braces: false },
    { re: /export\s+(?:interface|type|class|enum)\s+([A-Za-z_$][\w$]*)/g, braces: false },
    { re: /export\s*\{([^}]*)\}/g, braces: true }
  ];
  for (const { re, braces } of patterns) {
    let m;
    while ((m = re.exec(dtsText)) !== null) {
      if (braces) {
        for (const part of m[1].split(',')) {
          const n = part.trim().split(/\s+as\s+/).pop().trim();
          if (n) names.add(n);
        }
      } else {
        names.add(m[1]);
      }
    }
  }
  return names;
}

describe('types: sibling .d.ts for every exported JS subpath', () => {
  for (const { subpath, js } of jsSubpaths()) {
    it(`exports map ${subpath} has a sibling .d.ts`, () => {
      const dts = js.replace(/\.js$/, '.d.ts');
      assert.ok(fs.existsSync(dts), `${dts} must exist next to ${js}`);
      const text = fs.readFileSync(dts, 'utf8');
      assert.ok(text.length > 20, `${dts} must not be empty`);
    });
  }
});

describe('types: .d.ts declares every actual JS export name', () => {
  for (const { subpath, js } of jsSubpaths()) {
    it(`${subpath}: export-name parity between .js and .d.ts`, () => {
      const dts = js.replace(/\.js$/, '.d.ts');
      const actual = Object.keys(require(js));
      const text = fs.readFileSync(dts, 'utf8');
      const declared = declaredNames(text);
      for (const name of actual) {
        assert.ok(declared.has(name),
          `${path.basename(dts)} must declare the exported name "${name}"`);
      }
    });
  }
});

describe('types: package.json types field', () => {
  it('"types" resolves to an existing .d.ts file', () => {
    assert.ok(pkg.types, 'package.json must carry a "types" field');
    const resolved = path.join(REPO, pkg.types);
    assert.ok(fs.existsSync(resolved), `types field must resolve: ${resolved}`);
  });

  it('every sibling .d.ts is shipped in the files field', () => {
    const ship = (rel) =>
      pkg.files.some((entry) => {
        if (entry === rel) return true;
        return entry.endsWith('/') && rel.startsWith(entry);
      });
    for (const { subpath, js } of jsSubpaths()) {
      const rel = path.relative(REPO, js).replace(/\.js$/, '.d.ts');
      assert.ok(ship(rel), `package.json files field must ship ${rel} (subpath ${subpath})`);
    }
  });
});
