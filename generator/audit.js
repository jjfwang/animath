#!/usr/bin/env node
/* animath geometry audit CLI (issue #365).
 *
 * Runs the static geometry audit (auditGeometry) and the time-sampled audit
 * (auditGeometrySampled) from generator/geometry.js over sample files and
 * reports findings with their time bands. Exit-code contract (CI-able):
 *   0 — no findings
 *   1 — one or more findings
 *   2 — usage error or unreadable file
 *
 * Usage:
 *   node generator/audit.js <file...> [--dir <samples-dir>]
 *   node generator/audit.js --all [--dir <samples-dir>]
 *
 * The module exports its pieces for tests; only the require.main guard
 * touches process.exit/stdout.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var audits = require('./geometry.js');

function usage() {
  return [
    'Usage:',
    '  node generator/audit.js <file...> [--dir <samples-dir>]',
    '  node generator/audit.js --all [--dir <samples-dir>]',
    '',
    'Exit codes: 0 clean, 1 findings, 2 usage/file error.'
  ].join('\n');
}

// argv (without node/script) -> { files, all, dir, error }
function parseArgs(argv) {
  var out = { files: [], all: false, dir: 'samples', error: null };
  var i = 0;
  while (i < argv.length) {
    var a = argv[i];
    if (a === '--all') {
      out.all = true;
    } else if (a === '--dir') {
      i++;
      if (i >= argv.length || !argv[i] || argv[i].charAt(0) === '-') {
        out.error = '--dir needs a directory argument';
        return out;
      }
      out.dir = argv[i];
    } else if (a === '--help' || a === '-h') {
      out.error = 'help';
      return out;
    } else if (a.charAt(0) === '-') {
      out.error = 'unknown flag: ' + a;
      return out;
    } else {
      out.files.push(a);
    }
    i++;
  }
  if (!out.all && out.files.length === 0 && !out.error) {
    out.error = 'no input files; pass <file...> or --all';
  }
  return out;
}

function readJson(file) {
  try {
    return { spec: JSON.parse(fs.readFileSync(file, 'utf8')), error: null };
  } catch (e) {
    return { spec: null, error: 'cannot read/parse ' + file };
  }
}

function manifestFiles(dir) {
  try {
    var manifest = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
    if (!Array.isArray(manifest)) return { files: [], error: 'bad manifest in ' + dir };
    var files = [];
    manifest.forEach(function (name) {
      if (typeof name === 'string' && name.length > 0) files.push(path.join(dir, name));
    });
    return { files: files, error: null };
  } catch (e) {
    return { files: [], error: 'cannot read manifest in ' + dir };
  }
}

// findings for one file: static + sampled, each in record shape
function auditFile(file) {
  var read = readJson(file);
  if (read.error) return { file: file, findings: [], error: read.error };
  var label = path.basename(file);
  var findings = [];
  Array.prototype.push.apply(findings, audits.auditGeometry(read.spec, label));
  Array.prototype.push.apply(findings, audits.auditGeometrySampled(read.spec, label));
  return { file: file, findings: findings, error: null };
}

function formatFinding(f) {
  return f.file + ' ' + f.scene + ' ' + f.kind + ' ' + f.detail;
}

// -> { output, code, findingCount }
function run(opts) {
  var files = opts.files.slice();
  if (opts.all) {
    var m = manifestFiles(opts.dir);
    if (m.error) return { output: m.error, code: 2, findingCount: 0 };
    files = m.files;
  } else if (opts.dir !== 'samples') {
    // resolve relative file args against --dir
    files = files.map(function (f) { return path.join(opts.dir, f); });
  }
  var lines = [];
  var count = 0;
  for (var i = 0; i < files.length; i++) {
    var r = auditFile(files[i]);
    if (r.error) return { output: r.error, code: 2, findingCount: 0 };
    r.findings.forEach(function (f) {
      lines.push(formatFinding(f));
      count++;
    });
  }
  if (count === 0) return { output: 'clean: ' + files.length + ' file(s), no findings', code: 0, findingCount: 0 };
  return { output: lines.join('\n') + '\n' + count + ' finding(s)', code: 1, findingCount: count };
}

function main(argv) {
  var opts = parseArgs(argv);
  if (opts.error) {
    var code = opts.error === 'help' ? 0 : 2;
    return { output: (code === 0 ? usage() : 'error: ' + opts.error + '\n\n' + usage()), code: code, findingCount: 0 };
  }
  return run(opts);
}

module.exports = {
  parseArgs: parseArgs,
  auditFile: auditFile,
  formatFinding: formatFinding,
  run: run,
  main: main,
  usage: usage
};

if (require.main === module) {
  var result = main(process.argv.slice(2));
  process.stdout.write(result.output + '\n');
  process.exit(result.code);
}
