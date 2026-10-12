/* animath version tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Issue #706: player.version and web/embed.js version were hardcoded '0.1'
 * while package.json was already at '0.2.0-beta.0'. Both exports are baked
 * in by generator/tooling/regen-version.js (they cannot require
 * package.json at runtime — UMD bundles running in the browser under the
 * zero-build-step rule) and this suite locks them to the single source of
 * truth: any future drift fails here. The animath spec format version
 * ('0.1', asserted per-sample in tests/specs.test.js and enforced in
 * player/validate.js) is intentionally separate and untouched.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const regen = require('../generator/tooling/regen-version.js');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('package.json version is a non-empty string (the single source of truth)', () => {
  assert.equal(typeof pkg.version, 'string');
  assert.ok(pkg.version.length > 0, 'package.json must carry a version');
});

test('player.version matches package.json', () => {
  const player = require('../player/player.js');
  assert.equal(player.version, pkg.version,
    'player.version must be regenerated from package.json, not hand-typed (see generator/tooling/README.md)');
});

test('web/embed.js version matches package.json', () => {
  const embed = require('../web/embed.js');
  assert.equal(embed.version, pkg.version,
    'embed.version must be regenerated from package.json, not hand-typed (see generator/tooling/README.md)');
});

test('spec format version is still 0.1 and independent of the package version', () => {
  assert.equal(pkg.version === '0.1', false,
    'test sanity: package.json must have moved past 0.1 for this lock to mean something');
});

// regen-version (issue #706) unit and round-trip tests.

function fixtureSrc(literal) {
  return 'var api = { mount: mount, version: ' + literal + ' };\n';
}

function withTempFiles(contents, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'animath-regen-version-'));
  const files = contents.map((content, i) => {
    const file = path.join(dir, 'mod' + i + '.js');
    fs.writeFileSync(file, content, 'utf8');
    return file;
  });
  try {
    return fn(files);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('regenVersion replaces a stale literal', () => {
  const result = regen.regenVersion(fixtureSrc("'0.1'"), '0.2.0-beta.0');
  assert.equal(result.changed, true);
  assert.equal(result.src, fixtureSrc("'0.2.0-beta.0'"));
});

test('regenVersion is a no-op on the real player.js and web/embed.js (idempotence)', () => {
  for (const rel of ['player/player.js', 'web/embed.js']) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const result = regen.regenVersion(src, pkg.version);
    assert.equal(result.changed, false, rel + ' must already carry the package.json version');
    assert.equal(result.src, src);
  }
});

test('regenVersion fails closed when the literal is missing', () => {
  assert.throws(() => regen.regenVersion('var api = { mount: mount };\n', '0.2.0-beta.0'),
    /missing version literal/);
});

test('regenVersion fails closed when the literal appears more than once', () => {
  assert.throws(() => regen.regenVersion(fixtureSrc("'0.1'") + fixtureSrc("'0.1'"), '0.2.0-beta.0'),
    /ambiguous version literal/);
});

test('regenVersion fails closed on an empty or non-string version', () => {
  assert.throws(() => regen.regenVersion(fixtureSrc("'0.1'"), ''), /invalid version/);
  assert.throws(() => regen.regenVersion(fixtureSrc("'0.1'"), undefined), /invalid version/);
  assert.throws(() => regen.regenVersion(fixtureSrc("'0.1'"), 42), /invalid version/);
});

test('regenVersion fails closed when the version would break the literal', () => {
  assert.throws(() => regen.regenVersion(fixtureSrc("'0.1'"), "0.1' + evil + '"), /invalid version/);
  assert.throws(() => regen.regenVersion(fixtureSrc("'0.1'"), '0.1\\x'), /invalid version/);
});

test('run() repairs drifted literals and leaves clean ones untouched', () => {
  withTempFiles([fixtureSrc("'9.9.9'"), fixtureSrc("'" + pkg.version + "'")], (files) => {
    const summary = regen.run(files[0], files[1], pkg.version);
    assert.match(summary, /updated to .* in player/);
    assert.equal(fs.readFileSync(files[0], 'utf8'), fixtureSrc("'" + pkg.version + "'"));
    assert.equal(fs.readFileSync(files[1], 'utf8'), fixtureSrc("'" + pkg.version + "'"),
      'clean file must stay byte-identical');
  });
  const cleanSummary = withTempFiles(
    [fixtureSrc("'" + pkg.version + "'"), fixtureSrc("'" + pkg.version + "'")],
    (files) => regen.run(files[0], files[1], pkg.version)
  );
  assert.match(cleanSummary, /no change/);
});

test('run() fails closed when a source has no version literal', () => {
  withTempFiles([fixtureSrc("'0.1'"), 'no literal here\n'], (files) => {
    assert.throws(() => regen.run(files[0], files[1], pkg.version), /missing version literal/);
  });
});

test('cli() returns 0 on the real repo files and 1 when a literal is missing', () => {
  assert.equal(regen.cli(
    path.join(ROOT, 'player', 'player.js'),
    path.join(ROOT, 'web', 'embed.js'),
    path.join(ROOT, 'package.json')
  ), 0);
  withTempFiles(['no literal here\n'], (files) => {
    assert.equal(regen.cli(files[0], files[0], path.join(ROOT, 'package.json')), 1);
  });
});

test('cli() returns 1 when package.json carries an invalid version', () => {
  withTempFiles(['{ "name": "x", "version": "" }'], (files) => {
    assert.equal(regen.cli(
      path.join(ROOT, 'player', 'player.js'),
      path.join(ROOT, 'web', 'embed.js'),
      files[0]
    ), 1);
  });
});

test('launch() exits 0 against the real repo files', () => {
  let code = -1;
  regen.launch((c) => { code = c; });
  assert.equal(code, 0);
});
