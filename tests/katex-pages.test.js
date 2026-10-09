/* animath KaTeX page-pin tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards the spec/implementation drift fixed by #553: SPEC.md "Math notation"
 * promises `latex` shapes are "rendered with KaTeX when the player page loads
 * it" (player/demo.html pins the CDN copy), so every page that mounts the
 * player must pin the same KaTeX assets — otherwise latex samples silently
 * degrade to latexFallbackText on exactly the pages teachers use.
 *
 * web/gallery.html and web/index.html are not node-coverable; their HTML glue
 * is verified by reading plus these fs assertions against demo.html's pinned
 * version (the single source of truth, so a version bump re-pins all pages).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readHtml(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function pinnedKatexUrls() {
  const demo = readHtml('player/demo.html');
  const css = demo.match(/<link rel="stylesheet" href="(https:\/\/cdn\.jsdelivr\.net\/npm\/katex@[^"]+\/dist\/katex\.min\.css)">/);
  const js = demo.match(/<script src="(https:\/\/cdn\.jsdelivr\.net\/npm\/katex@[^"]+\/dist\/katex\.min\.js)" defer><\/script>/);
  assert.ok(css, 'player/demo.html must pin the KaTeX CSS asset');
  assert.ok(js, 'player/demo.html must pin the KaTeX JS asset with defer');
  return { css: css[1], js: js[1] };
}

const KATEX = pinnedKatexUrls();
const PAGES = ['web/gallery.html', 'web/index.html'];

test('demo.html pins a single KaTeX version for CSS and JS', () => {
  const versionOf = (u) => u.match(/katex@([0-9.]+)/)[1];
  assert.strictEqual(versionOf(KATEX.css), versionOf(KATEX.js),
    'demo.html CSS and JS pins must share one version, got ' + KATEX.css + ' / ' + KATEX.js);
});

for (const page of PAGES) {
  test(page + ' pins the demo.html KaTeX CSS asset', () => {
    const html = readHtml(page);
    assert.ok(html.includes('<link rel="stylesheet" href="' + KATEX.css + '">'),
      page + ' must contain the pinned KaTeX CSS tag from demo.html');
  });

  test(page + ' pins the demo.html KaTeX JS asset with defer', () => {
    const html = readHtml(page);
    assert.ok(html.includes('<script src="' + KATEX.js + '" defer></script>'),
      page + ' must contain the pinned KaTeX JS tag with defer from demo.html');
  });

  test(page + ' loads KaTeX before the player mount scripts', () => {
    const html = readHtml(page);
    const katexPos = html.indexOf(KATEX.js);
    const playerPos = html.indexOf('player/player.js');
    assert.ok(katexPos >= 0 && playerPos >= 0 && katexPos < playerPos,
      page + ': KaTeX tag must appear before the player script tag');
  });
}
