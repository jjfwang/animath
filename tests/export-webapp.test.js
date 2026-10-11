/* animath Export WebM web-wiring tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards the drift filed as #602: player/export-frames.js, player/export-record.js
 * and player/export-ui.js (issue #506) were wired only into player/demo.html —
 * web/index.html (the generator app, where a teacher actually generates an
 * animation) mounted the player with zero export wiring: no download-as-WebM
 * was reachable from the generation page. The app now carries the Export WebM
 * button next to its spec controls.
 *
 * web/index.html is not node-coverable; its HTML glue is verified by reading
 * plus these fs assertions (the tests/katex-pages.test.js and
 * tests/rubric-web.test.js precedent). The export modules themselves are
 * covered by tests/export-frames.test.js, export-record.test.js and
 * tests/export-ui.test.js.
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
const demoHtml = readFile('player/demo.html');
const exportUiSrc = readFile('player/export-ui.js');

const TAGS = [
  '<script src="../player/export-frames.js"></script>',
  '<script src="../player/export-record.js"></script>',
  '<script src="../player/export-ui.js"></script>'
];
const PLAYER_TAG = '<script src="../player/player.js"></script>';

test('web/index.html loads all three export scripts', () => {
  for (const tag of TAGS) {
    assert.ok(html.includes(tag),
      'web/index.html must contain the export script tag: ' + tag);
  }
});

test('export script tags load after ../player/player.js and before the app inline script', () => {
  const playerPos = html.indexOf(PLAYER_TAG);
  assert.ok(playerPos >= 0, 'the player script tag must be present');
  for (const tag of TAGS) {
    const pos = html.indexOf(tag);
    assert.ok(pos > playerPos,
      'export tag must load after ../player/player.js: ' + tag);
  }
  const lastExportPos = Math.max(...TAGS.map((t) => html.indexOf(t)));
  // the app inline block starts with a bare <script> tag (no src)
  const inlinePos = html.indexOf('<script>\n(function () {', lastExportPos);
  assert.ok(inlinePos > lastExportPos,
    'the export tags must load before the inline app script that attaches the UI');
});

test('web/index.html has the Export WebM button and status next to the spec controls', () => {
  const btnPos = html.indexOf('id="exportbtn"');
  const statusPos = html.indexOf('id="exportstatus"');
  const specBtnsPos = html.indexOf('id="specbtns"');
  const copyPos = html.indexOf('id="copybtn"');
  assert.ok(btnPos >= 0, 'web/index.html must contain #exportbtn');
  assert.ok(statusPos >= 0, 'web/index.html must contain #exportstatus');
  assert.ok(specBtnsPos >= 0 && copyPos >= 0, 'the spec controls row must be present');
  assert.ok(btnPos > specBtnsPos && statusPos > specBtnsPos,
    'the export button and status must live inside the spec controls row');
  assert.ok(html.includes('<button id="exportbtn" type="button">Export WebM</button>'),
    '#exportbtn must be a labelled button (same caption as demo.html)');
  assert.ok(html.includes('id="exportstatus" aria-live="polite"'),
    '#exportstatus must be a live region so progress/done/errors are announced');
});

test('attachExportUI is called with the same contract as demo.html', () => {
  // demo.html parity: the three globals, the getSpec/getSlug accessors
  assert.ok(html.includes('AnimathExportUI.attachExportUI(document, window, window.AnimathExportRecord'),
    'the app must attach with the same (document, window, AnimathExportRecord) arguments as demo.html');
  for (const fn of ['getSpec: function () { return lastSpec; }',
                    'getSlug: function () { return lastSlug; }']) {
    assert.ok(html.includes(fn),
      'the attach call must wire the accessor: ' + fn);
  }
  assert.ok(demoHtml.includes('getSpec: function () { return currentSpec; }'),
    'parity check: demo.html still wires getSpec the same way (contract anchor)');
});

test('export UI is attached only when the export globals are present', () => {
  assert.ok(html.includes('window.AnimathExportUI && window.AnimathExportRecord'),
    'the app must guard on the export globals so a failed script load cannot break the page');
});

test('refresh() is called at every generation-site state change', () => {
  const genStart = html.indexOf('genBtn.addEventListener(\'click\'');
  assert.ok(genStart >= 0, 'the generate handler must be present');

  const startRefresh = html.indexOf('if (exportUI) exportUI.refresh();', genStart);
  assert.ok(startRefresh > genStart,
    'starting a generation must refresh the export UI (button disabled, no stale spec)');

  const successRefresh = html.indexOf('specBtns.style.display = \'flex\';\n      if (exportUI) exportUI.refresh();', genStart);
  assert.ok(successRefresh > genStart,
    'a successful generation must refresh the export UI so Export enables');

  const catchPos = html.indexOf('}).catch(function (e) {', genStart);
  const failRefresh = html.indexOf('if (exportUI) exportUI.refresh();', catchPos);
  assert.ok(catchPos > genStart && failRefresh > catchPos,
    'a failed validation must refresh the export UI so getSpec() returns null again');
});

test('generation captures the topic slug for the export filename', () => {
  const success = html.indexOf('lastSpec = spec;', html.indexOf('genBtn.addEventListener(\'click\''));
  assert.ok(success >= 0, 'the success handler must store the spec');
  const slugLine = html.indexOf('lastSlug = topicSel.value', success);
  assert.ok(slugLine > success && slugLine < success + 200,
    'the success handler must capture the chosen topic slug for the export filename');
});

test('the page does not add its own MediaRecorder detection layer', () => {
  // export-ui.js detects MediaRecorder itself (disabled control + reason);
  // the page must not duplicate that logic (issue #602 scope). Comments may
  // name MediaRecorder, but no detection code may exist in the page.
  for (const probe of ['window.MediaRecorder', 'typeof MediaRecorder',
                       'isTypeSupported', 'navigator.mediaDevices']) {
    assert.ok(!html.includes(probe),
      'web/index.html must not probe ' + probe + ' — detection lives in export-ui.js');
  }
  assert.ok(exportUiSrc.includes('record.supportCheck(env)'),
    'parity check: export-ui.js still runs the support check in refresh()');
});
