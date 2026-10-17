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
  './interactive': ['validate', 'evaluate', 'createSession', 'svgFor', 'mount'],
  './simulations': ['models', 'validate', 'calculate', 'createSession', 'svgFor', 'mount'],
  './tutor-bridge': ['createTutorBridge'],
  './interactive-agent': ['createAgentReviewer'],
  './interactive-review': ['auditSvg', 'audit', 'reviewerPrompt', 'reviewAsset'],
  './approved-assets': ['prefix', 'publish', 'read', 'rollback'],
  './fs-assets': ['createFileStore'],
  './interactive-service': ['prepareAndPublish', 'loadApproved', 'mountApproved'],
  './presenter': ['createPresenter', 'resolveVisual', 'printViews', 'keyAction', 'attachPresenter'],
  './printable': ['renderWorksheet', 'renderWorksheetAnswerKey', 'renderExitTicket', 'renderExitTicketAnswerKey', 'renderNotes', 'renderScript', 'escapeHtml'],
  './export-frames': ['version', 'shapeMarkup', 'sceneShapes', 'renderFrame', 'frameMs', 'sceneFrameCount'],
  './export-record': ['buildFramePlan', 'defaultExportName', 'preferredMimeTypes', 'pickMimeType', 'supportCheck', 'recordSpec'],
  './export-ui': ['EXPORT_FPS', 'createExportController', 'attachExportUI'],
  './embed': ['mount'],
  './player-validate': ['validateSpec', 'validateSlides', 'validateWorksheet', 'validateExitTicket', 'validateNotes', 'validateScript'],
  './syllabus': ['SYLLABUS', 'resolveSyllabusTopic'],
  './pipeline': ['clearPackCache', 'generateAnimation', 'generateExitTicket', 'generateLessonPack', 'generateLessonPackForSyllabus', 'generateNotes', 'generateScript', 'generateSlides', 'generateWorksheet'],
  './slides': ['generateAnimation', 'generateSlides', 'generateWorksheet', 'generateExitTicket'],
  './worksheet': ['generateAnimation', 'generateSlides', 'generateWorksheet', 'generateExitTicket'],
  './exit-ticket': ['generateAnimation', 'generateSlides', 'generateWorksheet', 'generateExitTicket'],
  './notes': ['generateNotes'],
  './script': ['generateScript'],
  './lesson-pack': ['clearPackCache', 'generateLessonPack', 'generateLessonPackForSyllabus'],
  './slides-prompt': ['buildSlidePrompts', 'SLIDE_SYSTEM_TEMPLATE', 'WATER_CYCLE_DECK_EXEMPLAR'],
  './worksheet-prompt': ['buildWorksheetPrompts', 'WORKSHEET_SYSTEM_TEMPLATE', 'WATER_CYCLE_WORKSHEET_EXEMPLAR'],
  './exit-ticket-prompt': ['buildExitTicketPrompts', 'EXIT_TICKET_SYSTEM_TEMPLATE', 'WATER_CYCLE_TICKET_EXEMPLAR'],
  './notes-prompt': ['buildNotesPrompts'],
  './script-prompt': ['buildScriptPrompts'],
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

test('package identity is the teachkit rename (issue #749)', () => {
  assert.equal(pkg.name, '@jjfwang/teachkit');
  assert.equal(pkg.repository.url, 'https://github.com/jjfwang/teachkit.git');
});

test('every exports entry resolves to an existing file', () => {
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (subpath === './package.json') continue;
    const abs = path.join(ROOT, target);
    assert.ok(fs.existsSync(abs), `${subpath} -> ${target} exists`);
  }
});

test('engines floor matches the llm-client Node 18+ requirement', () => {
  assert.equal(pkg.engines.node, '>=18');
  const dts = fs.readFileSync(path.join(ROOT, 'generator', 'llm_client.d.ts'), 'utf8');
  assert.ok(dts.includes('Node 18+'), 'llm_client.d.ts header states Node 18+');
});

test('package.json test scripts wrap the documented test-gate commands', () => {
  assert.equal(pkg.scripts.test, 'node --test "tests/*.test.js"');
  assert.equal(pkg.scripts['test:coverage'], 'node --test --experimental-test-coverage "tests/*.test.js"');
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
