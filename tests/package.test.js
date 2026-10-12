/* Package surface test — every exports-map entry resolves to a real file
 * and loads cleanly in Node (issue #626). The UMD modules work in Node via
 * require() and in browsers via script tag; this test pins the Node side. */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const EXPECTED_APIS = {
  '.': ['buildPrompts'],
  './build-prompt': ['buildPrompts'],
  './charts': ['pieSectors', 'barLayout', 'axisTicks'],
  './geometry': ['auditGeometry'],
  './rubric': ['scoreSpec'],
  './audit': ['auditFile'],
  './audit-samples': ['auditSampleFile', 'auditAllSamples'],
  './misconceptions': ['MISCONCEPTIONS'],
  './llm-client': ['generateSpec'],
  './player': ['mount'],
  './export-frames': ['version', 'shapeMarkup', 'sceneShapes', 'renderFrame', 'frameMs', 'sceneFrameCount'],
  './export-record': ['buildFramePlan', 'defaultExportName', 'preferredMimeTypes', 'pickMimeType', 'supportCheck', 'recordSpec'],
  './export-ui': ['EXPORT_FPS', 'createExportController', 'attachExportUI'],
  './embed': ['mount'],
  './player-validate': ['validateSpec'],
  './pipeline': ['generateAnimation'],
  './unpack': [
    'buildUnpackPrompts',
    'parseTransitions',
    'unpackTopic',
    'parseUnpackResponse',
    'attachMisconceptions',
    'SHAPES',
    'UNPACK_SYSTEM_TEMPLATE',
    'UNPACK_USER_TEMPLATE',
  ],
};

test('package.json has a name, version and exports map', () => {
  assert.ok(pkg.name, 'name present');
  assert.ok(pkg.version, 'version present');
  assert.ok(pkg.exports && typeof pkg.exports === 'object', 'exports map present');
  assert.ok(pkg.files.includes('generator/'), 'generator/ ships');
  assert.ok(pkg.files.includes('player/'), 'player/ ships');
});

test('every exports entry resolves to an existing file', () => {
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (subpath === './package.json') continue;
    const abs = path.join(ROOT, target);
    assert.ok(fs.existsSync(abs), `${subpath} -> ${target} exists`);
  }
});

test('every JS export loads in Node and exposes its API', () => {
  for (const [subpath, apiNames] of Object.entries(EXPECTED_APIS)) {
    const target = pkg.exports[subpath];
    const mod = require(path.join(ROOT, target));
    for (const name of apiNames) {
      assert.ok(mod[name] !== undefined, `${subpath} exposes ${name}`);
    }
  }
});
