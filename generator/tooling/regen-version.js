#!/usr/bin/env node
/* regen-version.js (issue #706) — regenerates the hardcoded version literals
 * in player/player.js and web/embed.js from the package.json version.
 *
 * Why a script instead of a runtime require: player.js and embed.js ship as
 * UMD bundles that run in the browser (the repo has a zero-build-step rule),
 * so they cannot require('../package.json') at runtime. The version is baked
 * in by this maintainer-side script and locked by tests/version.test.js,
 * which fails the suite if either export drifts from package.json.
 * This mirrors the established regen-prompt-mirror.js pattern (issue #620).
 *
 * What it does (run from the repo root):
 *
 *     node generator/tooling/regen-version.js
 *
 * Reads package.json's version, then for each of player/player.js and
 * web/embed.js replaces the single `version: '<literal>'` in the exported
 * api object with `version: '<package.json version>'`. A file is rewritten
 * only when its literal changed; on a clean mirror the run is a no-op and
 * one summary line is printed. The literal is missing, appears more than
 * once, or the version is empty / not a string / contains a quote, fail
 * closed with a non-zero exit and a clear message — the literal is never
 * hand-edited (the version test locks it).
 *
 * The replacement is structured as the exported pure function
 * regenVersion(src, version) (string-in/string-out), plus run() and cli()
 * so the suite covers every new line.
 *
 * Requirements: Node, zero dependencies.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const VERSION_RE = /version: '[^']*'/;
const VERSION_RE_GLOBAL = /version: '[^']*'/g;

// String-in/string-out: returns { changed, src }. Fails closed when the
// literal is missing (marker drift), appears more than once (ambiguous
// which one is the export), or the version cannot be embedded safely.
function regenVersion(src, version) {
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('invalid version: package.json version must be a non-empty string');
  }
  if (version.indexOf("'") !== -1 || version.indexOf('\\') !== -1) {
    throw new Error('invalid version: quotes and backslashes cannot appear in the version literal');
  }
  const matches = src.match(VERSION_RE_GLOBAL) || [];
  if (matches.length === 0) {
    throw new Error('missing version literal: no `version: \'...\'` found in the source');
  }
  if (matches.length > 1) {
    throw new Error('ambiguous version literal: found ' + matches.length + ', expected exactly one');
  }
  const replacement = "version: '" + version + "'";
  if (matches[0] === replacement) {
    return { changed: false, src: src };
  }
  return {
    changed: true,
    src: src.replace(VERSION_RE, function () { return replacement; }),
  };
}

// Rewrites each listed file only when its literal changed; returns the
// summary line.
function run(playerPath, embedPath, version) {
  const updated = [];
  const files = [
    ['player', playerPath],
    ['embed', embedPath],
  ];
  for (const pair of files) {
    const label = pair[0];
    const filePath = pair[1];
    const src = fs.readFileSync(filePath, 'utf8');
    const result = regenVersion(src, version);
    if (result.changed) {
      fs.writeFileSync(filePath, result.src, 'utf8');
      updated.push(label);
    }
  }
  if (updated.length === 0) {
    return 'version literals already match package.json ' + version + ' (no change)';
  }
  return 'version literals updated to ' + version + ' in ' + updated.join(', ');
}

// Returns the process exit code so tests can exercise the CLI path.
function cli(playerPath, embedPath, pkgPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log('regen-version: ' + run(playerPath, embedPath, pkg.version));
    return 0;
  } catch (err) {
    console.error('regen-version: ' + err.message);
    return 1;
  }
}

// Separated so tests can exercise the entry path with a fake exit.
function launch(exit) {
  exit(cli(
    path.join(__dirname, '..', '..', 'player', 'player.js'),
    path.join(__dirname, '..', '..', 'web', 'embed.js'),
    path.join(__dirname, '..', '..', 'package.json')
  ));
}

if (require.main === module) launch(process.exit);

module.exports = { regenVersion: regenVersion, run: run, cli: cli, launch: launch };
