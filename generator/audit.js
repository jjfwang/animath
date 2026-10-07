#!/usr/bin/env node
/* animath geometry audit CLI (issue #365).
 *
 * Runs the static geometry audit (auditGeometry) and the time-sampled audit
 * (auditGeometrySampled) from generator/geometry.js over sample files and
 * reports findings with their time bands.
 *
 * CLASSIFICATION (issues #382, #384): every overlap finding is passed
 * through classifyFindings (generator/geometry.js), which marks it
 * intentional-motion iff its band touches a move-step flight interval of
 * either involved shape AND both shapes' rest positions are clear (the
 * audit's own band check re-run at rest — same tolerance, same centered-on
 * and point-anchor exemptions); intentional-staging iff it is not
 * intentional-motion and the two shapes' visibility intervals (from
 * show/hide step times) never share a 100ms audit sample — sequential
 * same-slot labels never on screen together; everything else is genuine.
 * Intentional findings get their own report sections (motion with the
 * covering flight interval, staging with the two disjoint visibility
 * intervals) and do NOT affect the exit code. KNOWN LIMITATION (run-274
 * lesson): bands are 100ms samples, so a sub-100ms graze between samples
 * is invisible to the audit and the classifier alike; flight intervals
 * come from the spec's own move steps — scripted motion only.
 *
 * Exit-code contract (CI-able):
 *   0 — no genuine findings
 *   1 — one or more genuine findings
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

// findings for one file: static + sampled, each in record shape.
// The parsed spec is threaded through so run() can classify findings.
function auditFile(file) {
  var read = readJson(file);
  if (read.error) return { file: file, spec: null, findings: [], error: read.error };
  var label = path.basename(file);
  var findings = [];
  Array.prototype.push.apply(findings, audits.auditGeometry(read.spec, label));
  Array.prototype.push.apply(findings, audits.auditGeometrySampled(read.spec, label));
  return { file: file, spec: read.spec, findings: findings, error: null };
}

function formatFinding(f) {
  return f.file + ' ' + f.scene + ' ' + f.kind + ' ' + f.detail;
}

function formatRanges(ranges) {
  return ranges.map(function (r) {
    return '[' + r[0] + '-' + r[1] + 'ms]';
  }).join(', ');
}

function formatClassified(c) {
  var line = formatFinding(c.finding);
  if (c.verdict === 'intentional-motion' && c.flight) {
    line += '  flight ' + c.flight.id +
      ' [' + c.flight.startMs + '-' + c.flight.endMs + 'ms]';
  } else if (c.verdict === 'intentional-staging' && c.staging) {
    line += '  staging ' + c.staging.aId + ' ' + formatRanges(c.staging.aRanges) +
      ' vs ' + c.staging.bId + ' ' + formatRanges(c.staging.bRanges);
  }
  return line;
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
  var genuineLines = [];
  var motionLines = [];
  var stagingLines = [];
  for (var i = 0; i < files.length; i++) {
    var r = auditFile(files[i]);
    if (r.error) return { output: r.error, code: 2, findingCount: 0 };
    audits.classifyFindings(r.spec, r.findings).forEach(function (c) {
      if (c.verdict === 'intentional-motion') {
        motionLines.push(formatClassified(c));
      } else if (c.verdict === 'intentional-staging') {
        stagingLines.push(formatClassified(c));
      } else {
        genuineLines.push(formatFinding(c.finding));
      }
    });
  }
  var genuine = genuineLines.length;
  var motion = motionLines.length;
  var staging = stagingLines.length;
  var total = genuine + motion + staging;
  if (total === 0) return { output: 'clean: ' + files.length + ' file(s), no findings', code: 0, findingCount: 0 };
  var sections = [];
  if (genuine > 0) sections.push('genuine findings:\n' + genuineLines.join('\n'));
  if (motion > 0) sections.push('intentional-motion findings:\n' + motionLines.join('\n'));
  if (staging > 0) sections.push('intentional-staging findings:\n' + stagingLines.join('\n'));
  sections.push(total + ' finding(s): ' + motion + ' intentional-motion, ' +
    staging + ' intentional-staging, ' + genuine + ' genuine');
  return { output: sections.join('\n'), code: genuine > 0 ? 1 : 0, findingCount: total };
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
