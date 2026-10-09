/* Tests for player/export-record.js — browser recording harness
 * (slice 2 of issue #506). Node-only, zero dependencies: every browser
 * capability (document, Image, MediaRecorder, Blob) is injected through the
 * env object as fakes.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const rec = require('../player/export-record.js');
const xf = require('../player/export-frames.js');

const CANVAS = { width: 960, height: 540 };

function circleShape(id, cx, cy, r) {
  return { id: id, kind: 'circle', cx: cx, cy: cy, r: r };
}

function sceneWith(durationMs, steps) {
  return { duration_ms: durationMs, steps: steps };
}

function showStep(id, shape) {
  return { do: 'show', at_ms: 0, shape: shape };
}

// Small two-scene fixture: scene 0 -> 4 frames at fps 20, scene 1 -> 6.
function twoSceneSpec() {
  return {
    title: 't', canvas: CANVAS,
    scenes: [
      sceneWith(200, [showStep('c1', circleShape('c1', 100, 100, 10))]),
      sceneWith(300, [showStep('c2', circleShape('c2', 200, 200, 10))])
    ]
  };
}

// --- fakes ---

function makeEnv(overrides) {
  overrides = overrides || {};
  var createdTags = [];
  var ctx = {
    drawn: [],
    drawImage: function (img, x, y, w, h) {
      this.drawn.push({ src: img.src, x: x, y: y, w: w, h: h });
    }
  };
  var canvas = {
    width: 0, height: 0, _fps: null,
    getContext: function (kind) { return kind === '2d' ? ctx : null; },
    captureStream: function (fps) { this._fps = fps; return fakeStream; }
  };
  if (overrides.noCaptureStream) delete canvas.captureStream;
  if (overrides.mozOnly) {
    delete canvas.captureStream;
    canvas.mozCaptureStream = function (fps) { this._fps = fps; return fakeStream; };
  }
  var fakeStream = {};
  var doc = {
    createElement: function (tag) { createdTags.push(tag); return canvas; }
  };
  function FakeImage() {
    var self = this;
    this.onload = null;
    this.onerror = null;
    Object.defineProperty(this, 'src', {
      configurable: true,
      get: function () { return self._src; },
      set: function (v) {
        self._src = v;
        setTimeout(function () {
          if (FakeImage.failNext) {
            FakeImage.failNext = false;
            if (self.onerror) self.onerror(new Error('rasterize boom'));
          } else if (self.onload) {
            self.onload();
          }
        }, 0);
      }
    });
  }
  FakeImage.failNext = false;
  function FakeMediaRecorder(stream, opts) {
    if (FakeMediaRecorder.throwOnConstruct) throw new Error('construct boom');
    this.stream = stream;
    this.opts = opts;
    this.started = false;
    this.stopped = false;
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
    FakeMediaRecorder.instances.push(this);
  }
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.throwOnConstruct = false;
  FakeMediaRecorder.zeroChunkFirst = false;
  FakeMediaRecorder.supported = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  FakeMediaRecorder.isTypeSupported = function (t) {
    return FakeMediaRecorder.supported.indexOf(t) !== -1;
  };
  FakeMediaRecorder.prototype.start = function () { this.started = true; };
  FakeMediaRecorder.prototype.stop = function () {
    this.stopped = true;
    var self = this;
    if (FakeMediaRecorder.zeroChunkFirst && self.ondataavailable) {
      self.ondataavailable({ data: { size: 0 } });
    }
    if (self.ondataavailable) self.ondataavailable({ data: { size: 3, toString: function () { return 'abc'; } } });
    setTimeout(function () { if (self.onstop) self.onstop(); }, 0);
  };
  FakeMediaRecorder.prototype.fail = function () {
    if (this.onerror) this.onerror(new Error('recorder boom'));
  };
  var env = {
    document: doc,
    Image: FakeImage,
    MediaRecorder: FakeMediaRecorder,
    Blob: Blob
  };
  if (overrides.noMediaRecorder) delete env.MediaRecorder;
  if (overrides.noDocument) delete env.document;
  if (overrides.badDocument) env.document = {};
  if (overrides.noGetContext) canvas.getContext = undefined;
  if (overrides.nullCtx) canvas.getContext = function () { return null; };
  return { env: env, ctx: ctx, canvas: canvas, createdTags: createdTags, FakeImage: FakeImage, FakeMediaRecorder: FakeMediaRecorder };
}

// --- buildFramePlan ---

describe('buildFramePlan', function () {
  test('lists every frame of every scene in playback order', function () {
    var plan = rec.buildFramePlan(twoSceneSpec(), { fps: 20 });
    assert.equal(plan.fps, 20);
    assert.equal(plan.totalFrames, 10);
    assert.equal(plan.totalMs, 500);
    assert.deepEqual(plan.frames.slice(0, 4).map(function (f) { return f.atMs; }), [0, 50, 100, 150]);
    assert.deepEqual(plan.frames.slice(0, 4).map(function (f) { return f.scene; }), [0, 0, 0, 0]);
    assert.deepEqual(plan.frames.slice(4).map(function (f) { return f.scene; }), [1, 1, 1, 1, 1, 1]);
    assert.deepEqual(plan.frames.slice(4, 6).map(function (f) { return f.atMs; }), [0, 50]);
    assert.deepEqual(plan.frames.map(function (f) { return f.frame; }),
      [0, 1, 2, 3, 0, 1, 2, 3, 4, 5]);
  });

  test('defaults to 30fps and tolerates missing scenes', function () {
    var plan = rec.buildFramePlan({ canvas: CANVAS, scenes: [sceneWith(100, [])] });
    assert.equal(plan.fps, 30);
    // ceil(100 / (1000/30)) = 3 frames
    assert.equal(plan.totalFrames, 3);
    var empty = rec.buildFramePlan({ canvas: CANVAS });
    assert.equal(empty.totalFrames, 0);
    assert.equal(empty.totalMs, 0);
  });
});

// --- defaultExportName ---

describe('defaultExportName', function () {
  test('slug + timestamp, zero-padded', function () {
    var when = new Date(2026, 9, 9, 9, 18, 25); // local time, month is 0-based
    assert.equal(rec.defaultExportName('my-slug', when), 'my-slug-20261009-091825.webm');
    var single = new Date(2026, 0, 5, 7, 8, 9);
    assert.equal(rec.defaultExportName('s', single), 's-20260105-070809.webm');
  });

  test('defaults to now', function () {
    assert.match(rec.defaultExportName('abc'), /^abc-\d{8}-\d{6}\.webm$/);
  });
});

// --- preferredMimeTypes / pickMimeType ---

describe('mime types', function () {
  test('preference order is vp9, vp8, plain webm', function () {
    assert.deepEqual(rec.preferredMimeTypes(),
      ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']);
  });

  test('pickMimeType takes the first supported type', function () {
    var mr = { isTypeSupported: function (t) { return t === 'video/webm;codecs=vp8'; } };
    assert.equal(rec.pickMimeType(mr), 'video/webm;codecs=vp8');
  });

  test('pickMimeType fails closed', function () {
    var none = { isTypeSupported: function () { return false; } };
    assert.equal(rec.pickMimeType(none), '');
    assert.equal(rec.pickMimeType({}), '');
    assert.equal(rec.pickMimeType(undefined), '');
    assert.equal(rec.pickMimeType(null), '');
  });
});

// --- supportCheck ---

describe('supportCheck', function () {
  test('null when everything is present', function () {
    assert.equal(rec.supportCheck(makeEnv().env), null);
  });

  test('a reason for every missing capability', function () {
    assert.match(rec.supportCheck(makeEnv({ noMediaRecorder: true }).env), /MediaRecorder/);
    assert.match(rec.supportCheck(undefined), /MediaRecorder/);
    assert.match(rec.supportCheck({}), /MediaRecorder/);
    assert.match(rec.supportCheck(makeEnv({ noDocument: true }).env), /DOM canvas/);
    assert.match(rec.supportCheck(makeEnv({ badDocument: true }).env), /DOM canvas/);
    assert.match(rec.supportCheck(makeEnv({ noGetContext: true }).env), /2d context/);
    assert.match(rec.supportCheck(makeEnv({ nullCtx: true }).env), /2d context/);
    assert.match(rec.supportCheck(makeEnv({ noCaptureStream: true }).env), /captureStream/);
  });

  test('mozCaptureStream counts as capture support', function () {
    assert.equal(rec.supportCheck(makeEnv({ mozOnly: true }).env), null);
  });
});

// --- recordSpec ---

describe('recordSpec', function () {
  test('happy path: records every frame, resolves the blob', async function () {
    var fx = makeEnv();
    var progress = [];
    var result = await rec.recordSpec(twoSceneSpec(), {
      fps: 20,
      onProgress: function (frac, info) { progress.push([frac, info]); }
    }, fx.env);
    assert.equal(result.frameCount, 10);
    assert.equal(result.totalMs, 500);
    assert.equal(result.mimeType, 'video/webm;codecs=vp9');
    assert.equal(result.blob.type, 'video/webm;codecs=vp9');
    // canvas sized to the spec canvas, stream captured at the export fps
    assert.equal(fx.canvas.width, 960);
    assert.equal(fx.canvas.height, 540);
    assert.equal(fx.canvas._fps, 20);
    assert.deepEqual(fx.createdTags, ['canvas', 'canvas']);
    // recorder constructed with the picked mime type and default bitrate
    var mr = fx.FakeMediaRecorder.instances[0];
    assert.equal(mr.opts.mimeType, 'video/webm;codecs=vp9');
    assert.equal(mr.opts.videoBitsPerSecond, 2500000);
    assert.equal(mr.started, true);
    assert.equal(mr.stopped, true);
    // every frame rasterized from the deterministic slice-1 SVG
    assert.equal(fx.ctx.drawn.length, 10);
    var spec = twoSceneSpec();
    fx.ctx.drawn.forEach(function (d, k) {
      var fr = rec.buildFramePlan(spec, { fps: 20 }).frames[k];
      var expected = xf.renderFrame(spec, fr.scene, fr.atMs);
      var actual = decodeURIComponent(d.src.split(',', 2)[1]);
      assert.equal(actual, expected);
      assert.equal(d.x, 0);
      assert.equal(d.y, 0);
      assert.equal(d.w, 960);
      assert.equal(d.h, 540);
      assert.match(d.src, /^data:image\/svg\+xml;charset=utf-8,/);
    });
    // progress ran 1/N .. 1 in order
    assert.equal(progress.length, 10);
    assert.deepEqual(progress.map(function (p) { return p[0]; }),
      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    assert.deepEqual(progress[0][1], { scene: 0, frame: 0, frames: 10 });
    assert.deepEqual(progress[9][1], { scene: 1, frame: 5, frames: 10 });
  });

  test('works without onProgress and with the mozCaptureStream fallback', async function () {
    var fx = makeEnv({ mozOnly: true });
    var result = await rec.recordSpec(twoSceneSpec(), { fps: 20 }, fx.env);
    assert.equal(result.frameCount, 10);
    assert.equal(fx.ctx.drawn.length, 10);
  });

  test('zero-size chunks are dropped', async function () {
    var fx = makeEnv();
    fx.FakeMediaRecorder.zeroChunkFirst = true;
    var result = await rec.recordSpec(twoSceneSpec(), { fps: 20 }, fx.env);
    assert.equal(result.blob.size, 3); // only the size-3 chunk survived
  });

  test('mimeType and bitrate overrides are honored', async function () {
    var fx = makeEnv();
    var result = await rec.recordSpec(twoSceneSpec(), {
      fps: 20, mimeType: 'video/webm', videoBitsPerSecond: 1000000
    }, fx.env);
    assert.equal(result.mimeType, 'video/webm');
    assert.equal(fx.FakeMediaRecorder.instances[0].opts.videoBitsPerSecond, 1000000);
  });

  test('rejects when unsupported', async function () {
    var fx = makeEnv({ noMediaRecorder: true });
    await assert.rejects(rec.recordSpec(twoSceneSpec(), { fps: 20 }, fx.env), /MediaRecorder/);
  });

  test('rejects when the spec has no frames', async function () {
    var fx = makeEnv();
    await assert.rejects(
      rec.recordSpec({ canvas: CANVAS, scenes: [] }, { fps: 20 }, fx.env),
      /no frames/);
  });

  test('rejects when the spec has no canvas', async function () {
    var fx = makeEnv();
    await assert.rejects(
      rec.recordSpec({ scenes: [sceneWith(100, [])] }, { fps: 20 }, fx.env),
      /no canvas/);
  });

  test('rejects when no WebM MIME type is supported', async function () {
    var fx = makeEnv();
    fx.FakeMediaRecorder.supported = [];
    await assert.rejects(rec.recordSpec(twoSceneSpec(), { fps: 20 }, fx.env), /MIME type/);
  });

  test('rejects when the MediaRecorder constructor throws', async function () {
    var fx = makeEnv();
    fx.FakeMediaRecorder.throwOnConstruct = true;
    await assert.rejects(rec.recordSpec(twoSceneSpec(), { fps: 20 }, fx.env), /construct boom/);
  });

  test('rejects when a frame fails to rasterize', async function () {
    var fx = makeEnv();
    fx.FakeImage.failNext = true;
    await assert.rejects(rec.recordSpec(twoSceneSpec(), { fps: 20 }, fx.env), /rasterize failed/);
  });

  test('rejects when renderFrame throws on a bad shape', async function () {
    var fx = makeEnv();
    var bad = {
      title: 't', canvas: CANVAS,
      scenes: [sceneWith(100, [showStep('b', { id: 'b', kind: 'nope' })])]
    };
    await assert.rejects(rec.recordSpec(bad, { fps: 20 }, fx.env), /unknown shape kind/);
  });

  test('rejects on MediaRecorder error mid-recording', async function () {
    var fx = makeEnv();
    var p = rec.recordSpec(twoSceneSpec(), { fps: 20 }, fx.env);
    setTimeout(function () { fx.FakeMediaRecorder.instances[0].fail(); }, 5);
    await assert.rejects(p, /MediaRecorder error/);
  });

  test('opts may be omitted entirely', async function () {
    var fx = makeEnv();
    var spec = { title: 't', canvas: CANVAS, scenes: [sceneWith(34, [showStep('c', circleShape('c', 1, 1, 1))])] };
    var result = await rec.recordSpec(spec, undefined, fx.env);
    assert.equal(result.frameCount, 2); // ceil(34 / (1000/30)) at default 30fps
  });
});
