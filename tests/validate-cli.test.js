/* Tests for the player/validate.js CLI entry point (issue #500).
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const child = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const cliPath = path.join(repoRoot, 'player', 'validate.js');

function runCli(args) {
  return child.spawnSync(process.execPath, [cliPath].concat(args), { encoding: 'utf8' });
}
function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'animath-validate-'));
}
// A spec that parses as JSON but fails validation: a show step with no shape.
function invalidSpec() {
  return {
    animath: '0.1', title: 'bad fixture', level: 'primary', subject: 'math',
    topic: 'bad-fixture', kind: 'concept', canvas: { width: 960, height: 540 },
    scenes: [
      {
        id: 's1', caption: 'c', narration: 'n', duration_ms: 5000,
        steps: [{ at_ms: 0, do: 'show' }]
      },
      {
        id: 's2', caption: 'c', narration: 'n', duration_ms: 5000,
        steps: [{ at_ms: 0, do: 'show', shape: { id: 't', kind: 'text', x: 10, y: 10, text: 'hi' } }]
      }
    ]
  };
}

test('CLI: valid sample exits 0 and names the file as valid', () => {
  const sample = path.join(repoRoot, 'samples', 'primary-math-ratio-sharing.json');
  const r = runCli([sample]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /is a valid animath spec/);
  assert.ok(r.stdout.includes('primary-math-ratio-sharing.json'));
});

test('CLI: invalid spec exits 2 and prints the validator error', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'bad.json');
  fs.writeFileSync(f, JSON.stringify(invalidSpec()));
  const r = runCli([f]);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /scenes\[0\]\.steps\[0\]\.shape: must be an object/);
});

test('CLI: no args exits 1 with a usage line', () => {
  const r = runCli([]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Usage: node player\/validate\.js <spec\.json>/);
});

test('CLI: too many args exits 1 with a usage line', () => {
  const r = runCli(['a.json', 'b.json']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Usage:/);
});

test('CLI: unreadable file exits 1 naming the file', () => {
  const missing = path.join(tmpDir(), 'no-such-file.json');
  const r = runCli([missing]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /cannot read file/);
  assert.ok(r.stderr.includes('no-such-file.json'));
});

test('CLI: invalid JSON exits 1 naming the file', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'broken.json');
  fs.writeFileSync(f, '{ not json');
  const r = runCli([f]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not valid JSON/);
  assert.ok(r.stderr.includes('broken.json'));
});

test('require: still exposes validateSpec with no CLI side effects', () => {
  const v = require('../player/validate.js');
  assert.equal(typeof v.validateSpec, 'function');
  assert.deepEqual(Object.keys(v).sort(), ['validateSpec']);
  assert.deepEqual(v.validateSpec(null), ['spec: must be an object']);
});
