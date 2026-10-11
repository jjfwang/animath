/* animath geometry-audit web-wiring tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards the drift filed as #614: generator/geometry.js (auditGeometry +
 * classifyFindings) ships as browser-loadable UMD but the generator web app
 * (web/index.html, where LLM specs are born) never ran it: generations were
 * validated (AnimathValidate.validateSpec) and scored (AnimathRubric.scoreSpec)
 * with no text-vs-shape check, so a spec could pass validation and still
 * render overlapping labels. The audit now runs on every generation-success
 * and renders findings classified 'genuine' as an ADVISORY warning block —
 * playback continues, nothing feeds the validateSpec repair loop (owner
 * decision delegated 2026-10-11, reversible).
 *
 * web/index.html is not node-coverable; its HTML glue is verified by reading
 * plus these fs assertions (the tests/rubric-web.test.js precedent). The
 * audit itself is exercised through the real UMD module in node — the same
 * call the page makes: auditGeometry(spec) + classifyFindings(spec, findings).
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
const geomSrc = readFile('generator/geometry.js');
const geometry = require('../generator/geometry.js');

const TAG = '<script src="../generator/geometry.js"></script>';
const RUBRIC_TAG = '<script src="../generator/rubric.js"></script>';

test('web/index.html loads generator/geometry.js right after rubric.js', () => {
  assert.ok(html.includes(TAG),
    'web/index.html must contain the geometry script tag: ' + TAG);
  assert.ok(html.indexOf(TAG) > html.indexOf(RUBRIC_TAG),
    'the geometry tag must sit after the rubric tag (the #614 scope)');
});

test('geometry script tag loads before the app inline script', () => {
  const tagPos = html.indexOf(TAG);
  // the app inline block starts with a bare <script> tag (no src), after the
  // pinned/generator/player tags
  const inlinePos = html.indexOf('<script>\n(function () {', tagPos);
  assert.ok(tagPos >= 0 && inlinePos > tagPos,
    'the geometry tag must load before the inline app script that calls it');
});

test('web/index.html renders an advisory warning container', () => {
  const m = html.match(/<div class="geom" id="geomwarn"[^>]*>/);
  assert.ok(m, 'web/index.html must contain the #geomwarn container');
  assert.ok(m[0].includes('role="status"'),
    '#geomwarn must be a live status region so warnings are announced');
  assert.ok(m[0].includes('aria-label="Geometry audit advisory"'),
    '#geomwarn must label itself as advisory, not as an error');
  assert.ok(m[0].includes('display:none'),
    '#geomwarn must start hidden until a generation produces findings');
});

test('advisory block sits next to the rubric score panel', () => {
  const warnPos = html.indexOf('id="geomwarn"');
  const panelPos = html.indexOf('id="rubricscore"');
  const stagePos = html.indexOf('id="stage"');
  assert.ok(warnPos >= 0 && panelPos >= 0 && stagePos >= 0,
    'all three landmarks must exist');
  assert.ok(warnPos > panelPos && warnPos < stagePos,
    '#geomwarn must sit after the rubric panel and before the player stage');
});

test('app audits only when the geometry global is present', () => {
  assert.ok(
    html.includes('window.AnimathGeometry && window.AnimathGeometry.auditGeometry') &&
    html.includes('window.AnimathGeometry.classifyFindings'),
    'the app must guard on the geometry global so a failed script load cannot break the page');
});

test('app runs the audit on the generated spec in the success path', () => {
  // the generation-success path is the .then() after generateSpecWithRepair
  const successStart = html.indexOf('generateSpecWithRepair({');
  const auditCall = html.indexOf('window.AnimathGeometry.auditGeometry(spec)', successStart);
  assert.ok(successStart >= 0 && auditCall > successStart,
    'the audit must run in the generation-success path, on the validated spec');
  assert.ok(html.indexOf('window.AnimathGeometry.classifyFindings(', successStart) > successStart,
    'the success path must classify the findings before rendering');
});

test('audit findings never block playback or feed the repair loop', () => {
  const successStart = html.indexOf('generateSpecWithRepair({');
  const mountPos = html.indexOf('AnimathPlayer.mount(stageEl, spec)', successStart);
  const auditPos = html.indexOf('window.AnimathGeometry.auditGeometry(spec)', successStart);
  assert.ok(mountPos > successStart && auditPos > mountPos,
    'the player must mount and play BEFORE the advisory audit runs: ' +
    'findings warn only, they cannot gate playback');
  // renderGeomAdvisory is the only consumer of genuine findings: it renders
  // the warning block or hides it — nothing branches on findings to block
  assert.ok(!html.includes('if (genuine.length)') &&
    !html.includes('findings.length') ,
    'no generation-path branch may gate on the findings count');
  // the repair entry (llm_client.js repair loop input) is validateSpec only
  assert.ok(!html.match(/generateSpecWithRepair\(\{[^}]*auditGeometry/s),
    'the audit must not be fed into generateSpecWithRepair — advisory only');
});

test('advisory block resets when a new generation starts', () => {
  const genStart = html.indexOf('genBtn.addEventListener(\'click\'');
  const reset = html.indexOf('geomEl.style.display = \'none\'', genStart);
  assert.ok(genStart >= 0 && reset > genStart,
    'starting a new generation must hide the previous advisory block');
});

test('geometry.js exposes auditGeometry + classifyFindings as a UMD browser global', () => {
  assert.ok(geomSrc.includes('global.AnimathGeometry = api'),
    'geometry.js must assign the browser global (UMD fallback path)');
  assert.ok(geomSrc.includes('auditGeometry: auditGeometry'),
    'the geometry API object must expose auditGeometry');
  assert.ok(geomSrc.includes('classifyFindings: classifyFindings'),
    'the geometry API object must expose classifyFindings');
});

// A probe spec with two overlapping labels and one label colliding with a
// circle — the audit must surface both, and classification must mark them
// genuine (both shapes co-visible the whole scene, no motion).
function probeSpec() {
  return {
    title: 'probe',
    scenes: [{
      id: 's1', label: 'S1', duration_ms: 4000, steps: [
        { at_ms: 0, do: 'show', shape: { kind: 'text', x: 100, y: 100, size: 28, text: 'Alpha' } },
        { at_ms: 0, do: 'show', shape: { kind: 'text', x: 105, y: 105, size: 28, text: 'Beta' } },
        { at_ms: 0, do: 'show', shape: { kind: 'circle', cx: 480, cy: 270, r: 40 } },
        { at_ms: 0, do: 'show', shape: { kind: 'text', x: 470, y: 270, size: 28, text: 'Hits disk' } }
      ]
    }]
  };
}

test('auditGeometry surfaces overlap + text-shape-overlap findings', () => {
  const findings = geometry.auditGeometry(probeSpec());
  const kinds = findings.map(function (f) { return f.kind; });
  assert.ok(kinds.includes('overlap'),
    'the two overlapping labels must produce an overlap finding');
  assert.ok(kinds.includes('text-shape-overlap'),
    'the label on the circle must produce a text-shape-overlap finding');
  for (const f of findings) {
    assert.ok(typeof f.scene === 'string' && typeof f.kind === 'string' &&
      typeof f.detail === 'string',
      'every finding must carry { scene, kind, detail } for the advisory render');
  }
});

test('classifyFindings marks the probe findings genuine', () => {
  const spec = probeSpec();
  const classified = geometry.classifyFindings(spec, geometry.auditGeometry(spec));
  assert.ok(classified.length > 0, 'classification must return one record per finding');
  for (const c of classified) {
    assert.ok(c.finding && typeof c.verdict === 'string',
      'every record must carry { finding, verdict }');
  }
  const genuine = classified.filter(function (c) { return c.verdict === 'genuine'; });
  assert.ok(genuine.length > 0,
    'co-visible, motionless overlaps must classify as genuine');
});

test('a clean spec audits clean and renders nothing', () => {
  const spec = { title: 'clean', scenes: [] };
  const classified = geometry.classifyFindings(spec, geometry.auditGeometry(spec));
  assert.deepStrictEqual(classified, [],
    'a clean spec yields no findings, so the advisory block stays hidden');
});
