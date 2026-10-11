/* animath Export WebM gallery-wiring tests — zero dependencies, Node built-in
 * test runner. Run: node --test "tests/*.test.js"
 *
 * Guards the #506 feature-adoption rollout on the sample gallery (issue
 * #604): web/gallery.html must wire the export modules exactly like
 * web/index.html does — same three script tags after player/player.js, one
 * #exportbtn + aria-live #exportstatus, and the attachExportUI glue tracking
 * the currently mounted spec/slug.
 *
 * web/gallery.html is not node-coverable; its HTML glue is verified by
 * reading plus these fs assertions (tests/katex-pages.test.js precedent).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readHtml(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

const PAGE = 'web/gallery.html';
const EXPORT_SCRIPTS = [
  '../player/export-frames.js',
  '../player/export-record.js',
  '../player/export-ui.js'
];

test(PAGE + ' loads all three export modules', () => {
  const html = readHtml(PAGE);
  for (const src of EXPORT_SCRIPTS) {
    assert.ok(html.includes('<script src="' + src + '"></script>'),
      PAGE + ' must load ' + src);
  }
});

test(PAGE + ' loads the export modules after player.js', () => {
  const html = readHtml(PAGE);
  const playerPos = html.indexOf('<script src="../player/player.js"></script>');
  assert.ok(playerPos >= 0, PAGE + ' must load ../player/player.js');
  for (const src of EXPORT_SCRIPTS) {
    const pos = html.indexOf('<script src="' + src + '"></script>');
    assert.ok(pos > playerPos,
      PAGE + ': ' + src + ' must be loaded after ../player/player.js');
  }
});

test(PAGE + ' has the Export WebM button', () => {
  const html = readHtml(PAGE);
  assert.ok(html.includes('<button id="exportbtn" type="button">Export WebM</button>'),
    PAGE + ' must contain a button#exportbtn labeled Export WebM');
});

test(PAGE + ' has the aria-live export status element', () => {
  const html = readHtml(PAGE);
  assert.ok(html.includes('<span id="exportstatus" aria-live="polite"></span>'),
    PAGE + ' must contain span#exportstatus with aria-live="polite"');
});

test(PAGE + ' attaches export UI with getSpec/getSlug', () => {
  const html = readHtml(PAGE);
  assert.ok(html.includes('window.AnimathExportUI.attachExportUI(document, window, window.AnimathExportRecord, {'),
    PAGE + ' must call attachExportUI with the guarded export globals');
  assert.ok(html.includes('getSpec: function () { return activeSpec; }'),
    PAGE + ' getSpec must return the currently mounted spec (null when none)');
  assert.ok(html.includes('getSlug: function () { return activeSlug; }'),
    PAGE + ' getSlug must return the mounted sample slug');
});

test(PAGE + ' clears and refreshes export state around the mount', () => {
  const html = readHtml(PAGE);
  assert.ok(html.includes('activeSpec = null;') && html.includes("activeSlug = 'animath';"),
    PAGE + ' must clear the mounted spec/slug before mounting a new player');
  const refreshes = html.match(/exportUI\.refresh\(\);/g) || [];
  assert.ok(refreshes.length >= 3,
    PAGE + ' must refresh the export UI at attach, on clear, and after mount');
});

test(PAGE + ' derives the slug from the sample filename', () => {
  const html = readHtml(PAGE);
  assert.ok(html.includes("activeSlug = String(file).replace(/\\.json$/, '') || 'animath';"),
    PAGE + ' must derive the export slug from the sample filename minus .json');
});
