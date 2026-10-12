#!/usr/bin/env node
/* animath geometry audit CLI (issue #365; CLI entry split from
 * generator/audit.js by issue #709).
 *
 * CLI entry point over the programmatic runner in generator/audit.js:
 * argument parsing, usage text, and the require.main guard that touches
 * process.exit/stdout. Importing this module has no side effects.
 *
 * Usage:
 *   node generator/tooling/audit-cli.js <file...> [--dir <samples-dir>]
 *   node generator/tooling/audit-cli.js --all [--dir <samples-dir>]
 *
 * Exit codes: 0 clean, 1 findings, 2 usage/file error.
 */
'use strict';

var audit = require('../audit.js');

function usage() {
  return [
    'Usage:',
    '  node generator/tooling/audit-cli.js <file...> [--dir <samples-dir>]',
    '  node generator/tooling/audit-cli.js --all [--dir <samples-dir>]',
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

function main(argv) {
  var opts = parseArgs(argv);
  if (opts.error) {
    var code = opts.error === 'help' ? 0 : 2;
    return { output: (code === 0 ? usage() : 'error: ' + opts.error + '\n\n' + usage()), code: code, findingCount: 0 };
  }
  return audit.run(opts);
}

module.exports = {
  parseArgs: parseArgs,
  usage: usage,
  main: main
};

if (require.main === module) {
  var result = main(process.argv.slice(2));
  process.stdout.write(result.output + '\n');
  process.exit(result.code);
}
