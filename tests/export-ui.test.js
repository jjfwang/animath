/* Tests for player/export-ui.js — demo-page Export button wiring
 * (slice 3 of issue #506). Node-only, zero dependencies: the document, window,
 * and the slice-2 harness are all injected as fakes, and the real
 * export-record.js supportCheck/defaultExportName back the controller.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const ui = require('../player/export-ui.js');
const rec = require('../player/export-record.js');

function fakeEl(tag) {
  return {
    tag: tag, disabled: false, title: '', textContent: '',
    listeners: {}, href: '', download: '',
    clicked: 0, removed: 0,
    addEventListener: function (type, fn) { this.listeners[type] = fn; },
    click: function () { this.clicked++; },
    remove: function () { this.removed++; },
    getContext: function () { return {}; },
    captureStream: function () { return {}; }
  };
}

function fakeDoc() {
  var elements = {};
  var doc = {
    body: { children: [], appendChild: function (c) { this.children.push(c); } },
    created: [],
    createElement: function (tag) { var e = fakeEl(tag); this.created.push(e); return e; },
    getElementById: function (id) {
      if (!elements[id]) elements[id] = fakeEl('stub');
      return elements[id];
    }
  };
  return doc;
}

function fakeWin(mediaRecorder) {
  var revoked = [];
  return {
    MediaRecorder: mediaRecorder,
    Image: function () {},
    Blob: function (parts, opts) { this.parts = parts; this.type = opts && opts.type; },
    URL: {
      createObjectURL: function () { return 'blob:fake'; },
      revokeObjectURL: function (u) { revoked.push(u); }
    },
    revoked: revoked
  };
}

function fakeMR() {}

function twoSceneSpec() {
  return {
    title: 't', canvas: { width: 960, height: 540 }, scenes: []
  };
}

// Real feature detection + filename, stubbed recorder.
function recordHarness(recordSpecStub) {
  return {
    supportCheck: rec.supportCheck,
    defaultExportName: rec.defaultExportName,
    recordSpec: recordSpecStub
  };
}

function flush(n) {
  var p = Promise.resolve();
  for (var i = 0; i < (n || 5); i++) p = p.then(function () { return new Promise(function (r) { setImmediate(r); }); });
  return p;
}

describe('attachExportUI', function () {
  test('refresh with no spec disables the button and ignores clicks', function () {
    var doc = fakeDoc();
    var win = fakeWin(fakeMR);
    var calls = [];
    var api = ui.attachExportUI(doc, win, recordHarness(function () { calls.push(1); }), {
      getSpec: function () { return null; },
      getSlug: function () { return 'x'; }
    });
    var button = doc.getElementById('exportbtn');
    api.refresh();
    assert.equal(button.disabled, true);
    button.listeners.click();
    assert.equal(calls.length, 0);
  });

  test('supported browser: enabled button, default title, empty status', function () {
    var doc = fakeDoc();
    var win = fakeWin(fakeMR);
    var spec = twoSceneSpec();
    var api = ui.attachExportUI(doc, win, recordHarness(function () {}), {
      getSpec: function () { return spec; },
      getSlug: function () { return 'my-slug'; }
    });
    api.refresh();
    var button = doc.getElementById('exportbtn');
    var status = doc.getElementById('exportstatus');
    assert.equal(button.disabled, false);
    assert.equal(button.title, 'Record the full animation as a WebM video');
    assert.equal(status.textContent, '');
  });

  test('unsupported browser: disabled button with the supportCheck reason', function () {
    var doc = fakeDoc();
    var win = fakeWin(undefined); // no MediaRecorder
    var api = ui.attachExportUI(doc, win, recordHarness(function () {}), {
      getSpec: function () { return twoSceneSpec(); },
      getSlug: function () { return 'my-slug'; }
    });
    api.refresh();
    var button = doc.getElementById('exportbtn');
    var status = doc.getElementById('exportstatus');
    assert.equal(button.disabled, true);
    assert.equal(button.title, 'MediaRecorder is not available in this browser');
    assert.equal(status.textContent, 'Export unavailable: MediaRecorder is not available in this browser');
    button.listeners.click(); // ignored while disabled
  });

  test('happy path: progress updates, download triggered, status shows the saved name', async function () {
    var doc = fakeDoc();
    var win = fakeWin(fakeMR);
    var fakeBlob = { fake: true };
    var recordedOpts = null;
    var statusAtProgress = null;
    var statusEl = doc.getElementById('exportstatus');
    var recordSpec = function (spec, opts, env) {
      recordedOpts = opts;
      return new Promise(function (resolve) {
        setImmediate(function () {
          opts.onProgress(0.5, { scene: 0, frame: 4, frames: 8 });
          statusAtProgress = statusEl.textContent;
          resolve({ blob: fakeBlob, mimeType: 'video/webm', frameCount: 8, totalMs: 266 });
        });
      });
    };
    var api = ui.attachExportUI(doc, win, recordHarness(recordSpec), {
      getSpec: function () { return twoSceneSpec(); },
      getSlug: function () { return 'my-slug'; }
    });
    api.refresh();
    var button = doc.getElementById('exportbtn');
    var status = statusEl;
    button.listeners.click();
    assert.equal(button.disabled, true);
    assert.equal(status.textContent, 'Recording... 0%');
    await flush();
    assert.equal(statusAtProgress, 'Recording... 50%');
    assert.equal(recordedOpts.fps, ui.EXPORT_FPS);
    var anchors = doc.created.filter(function (e) { return e.tag === 'a'; });
    assert.equal(anchors.length, 1);
    var a = anchors[0];
    assert.equal(a.href, 'blob:fake');
    assert.match(a.download, /^my-slug-\d{8}-\d{6}\.webm$/);
    assert.equal(a.clicked, 1);
    assert.equal(doc.body.children.indexOf(a) !== -1, true);
    assert.deepEqual(win.revoked, ['blob:fake']);
    assert.match(status.textContent, /^Saved my-slug-\d{8}-\d{6}\.webm$/);
    assert.equal(button.disabled, false); // refresh() re-enabled after done
  });

  test('recorder rejection surfaces the message and re-enables the button', async function () {
    var doc = fakeDoc();
    var win = fakeWin(fakeMR);
    var recordSpec = function () { return Promise.reject(new Error('boom')); };
    var api = ui.attachExportUI(doc, win, recordHarness(recordSpec), {
      getSpec: function () { return twoSceneSpec(); },
      getSlug: function () { return 'my-slug'; }
    });
    api.refresh();
    var button = doc.getElementById('exportbtn');
    var status = doc.getElementById('exportstatus');
    button.listeners.click();
    await flush();
    assert.equal(status.textContent, 'Export failed: boom');
    assert.equal(button.disabled, false);
  });
});

describe('createExportController', function () {
  function envFor(win) {
    return { MediaRecorder: win.MediaRecorder, document: fakeDoc(), Image: win.Image, Blob: win.Blob };
  }

  test('supportReason is null when supported', function () {
    var ctl = ui.createExportController({
      spec: twoSceneSpec(), env: envFor(fakeWin(fakeMR)), slug: 's',
      record: recordHarness(function () {}),
      createObjectURL: function () { return 'u'; },
      download: function () {},
      revokeObjectURL: function () {}
    });
    assert.equal(ctl.supportReason(), null);
  });

  test('fileName follows the slug-timestamp contract', function () {
    var ctl = ui.createExportController({
      spec: twoSceneSpec(), env: envFor(fakeWin(fakeMR)), slug: 'my-slug',
      record: recordHarness(function () {}),
      createObjectURL: function () { return 'u'; },
      download: function () {},
      revokeObjectURL: function () {}
    });
    assert.equal(ctl.fileName(new Date(2026, 0, 2, 3, 4, 5)), 'my-slug-20260102-030405.webm');
  });

  test('run works with no ui and with empty ui, returns the recording summary', async function () {
    function mkCtl(rej) {
      var downloads = [];
      return {
        ctl: ui.createExportController({
          spec: twoSceneSpec(), env: envFor(fakeWin(fakeMR)), slug: 's',
          record: recordHarness(function (spec, opts) {
            opts.onProgress(1, { scene: 0, frame: 1, frames: 1 });
            return rej ? Promise.reject(rej) : Promise.resolve({ blob: {}, frameCount: 3, totalMs: 100 });
          }),
          createObjectURL: function () { return 'blob:u'; },
          download: function (u, n) { downloads.push([u, n]); },
          revokeObjectURL: function () {}
        }),
        downloads: downloads
      };
    }
    var r1 = await mkCtl(null).ctl.run();
    assert.equal(r1.frameCount, 3);
    assert.equal(r1.totalMs, 100);
    var pair = mkCtl(null);
    var r2 = await pair.ctl.run({});
    assert.match(r2.name, /^s-\d{8}-\d{6}\.webm$/);
    assert.deepEqual(pair.downloads[0][0], 'blob:u');
    await assert.rejects(mkCtl('plain-fail').ctl.run({}), /plain-fail/);
    await assert.rejects(mkCtl(new Error('nope')).ctl.run(), /nope/);
  });

  test('unsupported run rejects and reports the reason through onError when present', async function () {
    var ctl = ui.createExportController({
      spec: twoSceneSpec(), env: envFor(fakeWin(undefined)), slug: 's',
      record: recordHarness(function () {}),
      createObjectURL: function () { return 'u'; },
      download: function () {},
      revokeObjectURL: function () {}
    });
    var seen = [];
    await assert.rejects(ctl.run({ onError: function (m) { seen.push(m); } }), /MediaRecorder is not available/);
    assert.deepEqual(seen, ['MediaRecorder is not available in this browser']);
    await assert.rejects(ctl.run(), /MediaRecorder is not available/);
  });

  test('run with a valueless rejection still reports through onError', async function () {
    var ctl = ui.createExportController({
      spec: twoSceneSpec(), env: envFor(fakeWin(fakeMR)), slug: 's',
      record: recordHarness(function () { return Promise.reject(); }),
      createObjectURL: function () { return 'u'; },
      download: function () {},
      revokeObjectURL: function () {}
    });
    var seen = [];
    await assert.rejects(ctl.run({ onError: function (m) { seen.push(m); } }));
    assert.deepEqual(seen, ['undefined']);
  });

  test('EXPORT_FPS is the fixed export frame rate', function () {
    assert.equal(ui.EXPORT_FPS, 30);
  });
});
