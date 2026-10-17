/* animath lesson-pack web-wiring tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards issue #780: the lesson-pack engine (generator/pipeline.js
 * generateLessonPack, issue #768) was reachable only from Node — the web
 * app (web/index.html) could generate a lone animation but had no pack
 * mode: the per-material prompt builders and the generator syllabus were
 * never loaded (pipeline.js captures its siblings at load time), there
 * was no mode selector, no pack manifest, and no material downloads.
 *
 * web/index.html is not node-coverable; its HTML glue is verified by
 * reading plus these fs assertions (the tests/export-webapp.test.js
 * precedent). The pipeline itself is covered by tests/pipeline-pack.test.js.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readFile(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

const html = readFile('web/index.html');
const readme = readFile('README.md');
const changelog = readFile('CHANGELOG.md');

const PACK_TAGS = [
  '<script src="../generator/build_slides_prompt.js"></script>',
  '<script src="../generator/build_worksheet_prompt.js"></script>',
  '<script src="../generator/build_exit_ticket_prompt.js"></script>',
  '<script src="../generator/build_notes_prompt.js"></script>',
  '<script src="../generator/build_script_prompt.js"></script>',
  '<script src="../generator/syllabus.js"></script>'
];
const BUILD_PROMPT_TAG = '<script src="../generator/build_prompt.js"></script>';
const PIPELINE_TAG = '<script src="../generator/pipeline.js"></script>';

const packCallPos = html.indexOf('AnimathPipeline.generateLessonPack({');
const packCall = packCallPos >= 0 ? html.slice(packCallPos, packCallPos + 4500) : '';

test('web/index.html loads all six lesson-pack sibling scripts', () => {
  for (const tag of PACK_TAGS) {
    assert.ok(html.includes(tag),
      'web/index.html must contain the pack sibling script tag: ' + tag);
  }
});

test('pack sibling tags load in brief order, after build_prompt.js, before pipeline.js and the inline script', () => {
  const buildPromptPos = html.indexOf(BUILD_PROMPT_TAG);
  const pipelinePos = html.indexOf(PIPELINE_TAG);
  assert.ok(buildPromptPos >= 0, 'the build_prompt.js tag must be present');
  assert.ok(pipelinePos >= 0, 'the pipeline.js tag must be present');
  let prev = buildPromptPos;
  for (const tag of PACK_TAGS) {
    const pos = html.indexOf(tag);
    assert.ok(pos > prev,
      'pack sibling tags must load in order after build_prompt.js: ' + tag);
    assert.ok(pos < pipelinePos,
      'pack sibling tag must load before pipeline.js (siblings are captured at pipeline load time): ' + tag);
    prev = pos;
  }
  const inlinePos = html.indexOf('<script>\n(function () {', pipelinePos);
  assert.ok(inlinePos > pipelinePos,
    'the pack sibling tags must load before the inline app script');
});

test('pack-mode selector exists and defaults to animation', () => {
  assert.ok(html.includes('<input type="radio" name="mode" value="animation" checked>'),
    'the mode radio group must default to animation (checked)');
  assert.ok(html.includes('<input type="radio" name="mode" value="pack">'),
    'the mode radio group must offer the pack value');
  assert.ok(html.includes('id="packmode"'),
    'the mode selector must live in its own #packmode control row');
});

test('pack generation calls generateLessonPack directly with the picker opts', () => {
  assert.ok(packCallPos >= 0, 'web/index.html must call AnimathPipeline.generateLessonPack(');
  assert.ok(!html.includes('AnimathPipeline.generateLessonPackForSyllabus'),
    'the page must use the direct entry, not the syllabus-keyed one');
  for (const opt of ['level: levelSel.value', 'subject: tr.subject',
                     'topic: topicSel.value', 'topicLabel: topicOpt.textContent',
                     'kind: kind', 'focus: focusEl.value.trim()']) {
    assert.ok(packCall.includes(opt),
      'the generateLessonPack opts must carry the current picker value: ' + opt);
  }
  assert.ok(packCall.includes("facetField.style.display === 'none' ? null : facetSel.value"),
    'the generateLessonPack opts must carry the facet like generateAnimation');
});

test('pack generation passes the callChat adapter and all six validators', () => {
  assert.ok(packCall.includes('AnimathLLM.rawChat(system, user, {'),
    'the pack deps must reuse the AnimathLLM.rawChat callChat adapter');
  for (const dep of ['validate: AnimathValidate.validateSpec',
                     'validateSlides: AnimathValidate.validateSlides',
                     'validateWorksheet: AnimathValidate.validateWorksheet',
                     'validateNotes: AnimathValidate.validateNotes',
                     'validateExitTicket: AnimathValidate.validateExitTicket',
                     'validateScript: AnimathValidate.validateScript']) {
    assert.ok(packCall.includes(dep),
      'the pack deps must pass the per-material validator: ' + dep);
  }
});

test('pack success mounts the animation and stores pack state', () => {
  assert.ok(packCall.includes('lastPack = pack;'),
    'pack success must store the pack for the downloads');
  assert.ok(packCall.includes('lastSpec = pack.animation;'),
    'pack success must set lastSpec to the pack animation');
  assert.ok(packCall.includes('lastSlug = pack.manifest.slug;'),
    'pack success must set lastSlug from the manifest');
  assert.ok(packCall.includes('AnimathPlayer.mount(stageEl, pack.animation)'),
    'pack success must mount the pack animation in the stage');
  assert.ok(packCall.includes("setStatus('Playing: ' + pack.animation.title)"),
    'pack success must announce the playing animation');
});

test('manifest container renders slug, topic, level, subject and the material keys', () => {
  assert.ok(html.includes('id="packmanifest"'),
    'web/index.html must contain the #packmanifest container');
  assert.ok(html.includes("packManifestEl.style.display = 'none';"),
    'the manifest must be cleared and hidden at generation start');
  for (const field of ['pack.manifest.slug', 'pack.manifest.topic',
                       'pack.manifest.level', 'pack.manifest.subject',
                       'pack.manifest.materials']) {
    assert.ok(html.includes(field),
      'the manifest rendering must name: ' + field);
  }
});

test('five download controls deliver the exact material objects as <slug>-<key>.json', () => {
  assert.ok(html.includes('id="packdownloads"'),
    'web/index.html must contain the #packdownloads container');
  for (const key of ['slides', 'worksheet', 'notes', 'exitTicket', 'script']) {
    assert.ok(html.includes('id="packdl-' + key + '"'),
      'there must be a download button for: ' + key);
  }
  assert.ok(html.includes("var PACK_DOWNLOAD_KEYS = ['slides', 'worksheet', 'notes', 'exitTicket', 'script'];"),
    'the download wiring must iterate the five material keys');
  assert.ok(html.includes('new Blob([JSON.stringify(lastPack[key], null, 2)], { type: \'application/json\' })'),
    'each download must serialise the exact lastPack[key] object via the Blob pattern');
  assert.ok(html.includes("a.download = lastPack.manifest.slug + '-' + key + '.json';"),
    'each download filename must be the manifest slug plus the material key');
});

test('generation start clears pack state and failures route through the status/problems path', () => {
  const genStart = html.indexOf('genBtn.addEventListener(\'click\'');
  assert.ok(genStart >= 0, 'the generate handler must be present');
  const startClear = html.indexOf('lastPack = null;', genStart);
  assert.ok(startClear > genStart && startClear < packCallPos,
    'generation start must clear lastPack alongside lastSpec');
  const catchPos = packCall.indexOf('}).catch(function (e) {');
  assert.ok(catchPos >= 0, 'the pack call must carry a catch');
  const packCatch = packCall.slice(catchPos, catchPos + 1200);
  assert.ok(packCatch.includes('var problems = e.problems || [e.message];'),
    'the pack catch must collect problems like the animation catch');
  assert.ok(packCatch.includes("setStatus('Generation failed:"),
    'the pack catch must report through setStatus as an error');
  assert.ok(packCatch.includes('showProblems(problems);'),
    'the pack catch must render the problems');
  assert.ok(packCatch.includes('lastPack = null;'),
    'the pack catch must leave no pack behind');
});

test('README and CHANGELOG document the pack mode', () => {
  assert.ok(readme.includes('lesson-pack mode') && readme.includes('web/index.html'),
    'README Quickstart prose must name lesson-pack mode in web/index.html');
  const unreleased = changelog.slice(changelog.indexOf('## [Unreleased]'),
    changelog.indexOf('\n## [', changelog.indexOf('## [Unreleased]') + 1));
  assert.ok(unreleased.includes('Lesson-pack generation mode in the web app'),
    'CHANGELOG [Unreleased] Added must carry the pack-mode bullet');
});
