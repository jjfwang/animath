/* animath ESM consumption tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards the drift filed as #637: the package is CJS+UMD, so ESM consumers
 * only get default-import interop — the README "Install as a library" section
 * documents the pattern, and this test runs a real ESM script importing the
 * charts entry (via the package's self-referencing exports map) to prove the
 * documented pattern actually works.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const FIXTURE = path.join(__dirname, 'fixtures', 'esm-charts-entry.mjs');

test('a real ESM script imports the charts entry via default interop', () => {
  const out = execFileSync(process.execPath, [FIXTURE], { encoding: 'utf8' });
  const result = JSON.parse(out);
  assert.equal(result.api, 'ok');
  assert.equal(result.sectorCount, 3);
  assert.ok(result.allSectorKind);
});

test('the ESM fixture matches the README-documented snippet', () => {
  const fs = require('node:fs');
  const fixtureSrc = fs.readFileSync(FIXTURE, 'utf8');
  assert.ok(
    fixtureSrc.includes("import charts from '@jjfwang/animath/charts';"),
    'fixture uses the README default-import line',
  );
  assert.ok(
    fixtureSrc.includes('const { pieSectors } = charts;'),
    'fixture destructures after the default import',
  );
});
