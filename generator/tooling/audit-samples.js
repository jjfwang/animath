/* animath sample-file geometry audits (issue #365; file-walking helpers split
 * from generator/geometry.js by issue #709).
 *
 * Node-only helpers over samples/index.json: auditSampleFile and
 * auditAllSamples. They require('fs') lazily so the core library
 * (generator/geometry.js) stays browser-loadable; this module stays
 * CommonJS and Node-only, like the rest of generator/tooling/.
 *
 * The core audits — auditGeometry, auditGeometrySampled, classifyFindings,
 * estimateTextWidth, textBox — live in generator/geometry.js (UMD, browser
 * and Node).
 */
'use strict';

var geometry = require('../geometry.js');

function baseName(p) {
  var s = String(p);
  var i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  return i < 0 ? s : s.slice(i + 1);
}

// Node-only: audit one sample file by path. Unreadable/invalid files
// yield [] rather than throwing.
function auditSampleFile(path) {
  var fs = require('fs');
  try {
    var parsed = JSON.parse(fs.readFileSync(path, 'utf8'));
    return geometry.auditGeometry(parsed, baseName(path));
  } catch (ignore) {
    return [];
  }
}

// Node-only: audit every file listed in <dir>/index.json (default
// 'samples'). Malformed manifests yield [] rather than throwing.
function auditAllSamples(dir) {
  var fs = require('fs');
  var base = (typeof dir === 'string' && dir.length > 0) ? dir : 'samples';
  var manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(base + '/index.json', 'utf8'));
  } catch (ignore) {
    return [];
  }
  if (!Array.isArray(manifest)) return [];
  var out = [];
  manifest.forEach(function (name) {
    if (typeof name !== 'string' || name.length === 0) return;
    Array.prototype.push.apply(out, auditSampleFile(base + '/' + name));
  });
  return out;
}

module.exports = {
  auditSampleFile: auditSampleFile,
  auditAllSamples: auditAllSamples
};
