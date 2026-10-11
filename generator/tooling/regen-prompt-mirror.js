#!/usr/bin/env node
/* regen-prompt-mirror.js (issue #620) — regenerates the PROMPTS.md
 * "## System prompt" fenced block from the evaluated SYSTEM_TEMPLATE in
 * generator/build_prompt.js.
 *
 * What it does (run from the repo root):
 *
 *     node generator/tooling/regen-prompt-mirror.js
 *
 * Reads the evaluated SYSTEM_TEMPLATE (zero dependencies), locates the
 * fenced block in PROMPTS.md between the exact markers the prompt-mirror
 * test parses ('## System prompt\n\n```\n' ... first '\n```'), and splices
 * the template in byte-for-byte. The file is rewritten only when the block
 * changed; on a clean mirror the run is a no-op and one summary line is
 * printed. Markers missing, or a template that itself contains a fence
 * (which would make the block end ambiguous), fail closed with a non-zero
 * exit and a clear message — the doc block is never hand-edited (see the
 * lock in issue #619).
 *
 * The replacement is structured as the exported pure function
 * regenPromptMirror(doc, template) (string-in/string-out), plus run() and
 * cli() so the suite covers every new line.
 *
 * Requirements: Node, zero dependencies.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const Prompt = require('../build_prompt.js');

const OPEN_MARKER = '## System prompt\n\n```\n';
const CLOSE_MARKER = '\n```';

// String-in/string-out: returns { changed, doc }. Reuses exactly the marker
// logic the prompt-mirror test parses with, so script and test agree on the
// block boundaries. Throws when the markers are missing or ambiguous.
function regenPromptMirror(doc, template) {
  const open = doc.indexOf(OPEN_MARKER);
  if (open === -1) {
    throw new Error('missing marker: PROMPTS.md has no "## System prompt" fenced block');
  }
  const start = open + OPEN_MARKER.length;
  const end = doc.indexOf(CLOSE_MARKER, start);
  if (end === -1) {
    throw new Error('missing marker: PROMPTS.md system-prompt fence never closes');
  }
  if (template.indexOf(CLOSE_MARKER) !== -1) {
    throw new Error('ambiguous block end: SYSTEM_TEMPLATE contains a fence line');
  }
  if (doc.slice(start, end) === template) {
    return { changed: false, doc: doc };
  }
  return { changed: true, doc: doc.slice(0, start) + template + doc.slice(end) };
}

// Rewrites mdPath only when the block changed; returns the summary line.
function run(mdPath) {
  const doc = fs.readFileSync(mdPath, 'utf8');
  const result = regenPromptMirror(doc, Prompt.SYSTEM_TEMPLATE);
  if (result.changed) {
    fs.writeFileSync(mdPath, result.doc, 'utf8');
    return 'PROMPTS.md system-prompt block regenerated from SYSTEM_TEMPLATE';
  }
  return 'PROMPTS.md already byte-identical to SYSTEM_TEMPLATE (no change)';
}

// Returns the process exit code so tests can exercise the CLI path.
function cli(mdPath) {
  try {
    console.log('regen-prompt-mirror: ' + run(mdPath));
    return 0;
  } catch (err) {
    console.error('regen-prompt-mirror: ' + err.message);
    return 1;
  }
}

// Separated so tests can exercise the entry path with a fake exit.
function launch(exit) {
  exit(cli(path.join(__dirname, '..', '..', 'PROMPTS.md')));
}

if (require.main === module) launch(process.exit);

module.exports = { regenPromptMirror: regenPromptMirror, run: run, cli: cli, launch: launch };
