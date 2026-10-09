/* animath export record v0.1 — browser recording harness (slice 2 of issue #506).
 *
 * Consumes the slice-1 contract (player/export-frames.js): renderFrame(),
 * frameMs(), sceneFrameCount(). Rasterizes each frame's SVG string to an
 * offscreen canvas at a fixed fps and feeds canvas.captureStream into
 * MediaRecorder, producing a WebM blob of the full scene sequence.
 *
 * Pacing contract: frames are drawn on a wall-clock timer at 1000/fps ms and
 * the stream is captured at the same fps, so the recorded video plays back at
 * the export fps in real time. Recording a 12s scene at 30fps takes ~12s —
 * this is a recorder, not a fast renderer. (Slice 3's UI records at normal
 * pace too, honoring reduced-motion by never time-compressing.)
 *
 * Browser-only, fully feature-detected, zero-dep, no build step, UMD like
 * player.js/export-frames.js. Every browser capability is read through the
 * injected `env` object ({ document, Image, MediaRecorder, Blob }) — never
 * bare globals — so the whole pipeline runs in Node under test with fakes
 * (the MediaRecorder wiring itself cannot run on the VM's Node build; the
 * testable contract is everything around it). Slice 3's UI wires the real
 * globals: recordSpec(spec, opts, { document: document, Image: window.Image,
 * MediaRecorder: window.MediaRecorder, Blob: window.Blob }).
 *
 * No new text rendering path: frames are slice-1 SVG strings rasterized
 * unchanged (Unicode math only — latex shapes ride the no-KaTeX fallback,
 * exactly like the player without KaTeX loaded).
 */
(function (global) {
  'use strict';

  // The slice-1 frame contract. In Node this is a require; in the browser
  // export-frames.js must be loaded first (it sets global.AnimathExportFrames).
  var Frames = (typeof module !== 'undefined' && module.exports)
    ? require('./export-frames.js')
    : global.AnimathExportFrames;

  var DEFAULT_FPS = 30;
  var DEFAULT_BITS_PER_SECOND = 2500000;

  // ---- pure, DOM-free ----

  // The frame list for a full-spec recording: every frame of every scene in
  // playback order, with the slice-1 ms for each. fps defaults to 30.
  function buildFramePlan(spec, opts) {
    var fps = (opts && opts.fps) || DEFAULT_FPS;
    var frames = [];
    var scenes = spec.scenes || [];
    for (var s = 0; s < scenes.length; s++) {
      var n = Frames.sceneFrameCount(spec, s, fps);
      for (var f = 0; f < n; f++) {
        frames.push({ scene: s, frame: f, atMs: Frames.frameMs(f, fps) });
      }
    }
    var totalMs = scenes.reduce(function (t, sc) { return t + (sc.duration_ms || 0); }, 0);
    return { frames: frames, fps: fps, totalFrames: frames.length, totalMs: totalMs };
  }

  // Export filename per the parent issue's owner note: sample slug + timestamp
  // so repeated exports never overwrite each other. `when` is injectable for
  // tests; defaults to now.
  function defaultExportName(slug, when) {
    var d = when || new Date();
    function two(n) { return (n < 10 ? '0' : '') + n; }
    return slug + '-' + d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) +
      '-' + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds()) + '.webm';
  }

  // MIME preference: vp9 first (best compression), then vp8, then plain webm.
  // Fail-closed: pickMimeType returns '' when nothing is supported.
  function preferredMimeTypes() {
    return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  }

  function pickMimeType(mrLike) {
    if (!mrLike || typeof mrLike.isTypeSupported !== 'function') return '';
    var types = preferredMimeTypes();
    for (var i = 0; i < types.length; i++) {
      if (mrLike.isTypeSupported(types[i])) return types[i];
    }
    return '';
  }

  // Feature detection: null when the harness can run, otherwise a
  // human-readable reason the UI can show next to a disabled control.
  function supportCheck(env) {
    if (!env || typeof env.MediaRecorder === 'undefined') {
      return 'MediaRecorder is not available in this browser';
    }
    if (!env.document || typeof env.document.createElement !== 'function') {
      return 'DOM canvas is not available';
    }
    var canvas = env.document.createElement('canvas');
    if (!canvas.getContext || !canvas.getContext('2d')) {
      return 'canvas 2d context is not available';
    }
    if (!canvas.captureStream && !canvas.mozCaptureStream) {
      return 'canvas.captureStream is not available';
    }
    return null;
  }

  // ---- browser harness (everything through env; no bare globals) ----

  // Rasterize one slice-1 SVG string onto ctx at w x h. drawImage with
  // explicit destination dims scales the viewBox-only SVG to the canvas.
  function drawSvgFrame(env, ctx, svg, w, h) {
    return new Promise(function (resolve, reject) {
      var img = new env.Image();
      img.onload = function () {
        ctx.drawImage(img, 0, 0, w, h);
        resolve();
      };
      img.onerror = function () { reject(new Error('frame rasterize failed')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  // Record the full scene sequence. Resolves { blob, mimeType, frameCount,
  // totalMs }. Rejects with a clear reason when unsupported (supportCheck),
  // when the spec has no frames, when no WebM MIME type is supported, or when
  // rasterization/recording fails. opts: { fps, mimeType (override),
  // videoBitsPerSecond, onProgress(frac, { scene, frame, frames }) }.
  function recordSpec(spec, opts, env) {
    opts = opts || {};
    var fps = opts.fps || DEFAULT_FPS;
    return new Promise(function (resolve, reject) {
      var reason = supportCheck(env);
      if (reason) { reject(new Error(reason)); return; }
      var plan = buildFramePlan(spec, opts);
      if (plan.totalFrames === 0) { reject(new Error('spec has no frames to record')); return; }
      var mimeType = opts.mimeType || pickMimeType(env.MediaRecorder);
      if (!mimeType) { reject(new Error('no supported video/webm MIME type')); return; }
      if (!spec.canvas) { reject(new Error('spec has no canvas')); return; }
      var W = spec.canvas.width, H = spec.canvas.height;
      var canvas = env.document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');
      var stream = (canvas.captureStream || canvas.mozCaptureStream).call(canvas, fps);
      var mr;
      try {
        mr = new env.MediaRecorder(stream, {
          mimeType: mimeType,
          videoBitsPerSecond: opts.videoBitsPerSecond || DEFAULT_BITS_PER_SECOND
        });
      } catch (err) { reject(err); return; }
      var chunks = [];
      mr.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mr.onerror = function () { reject(new Error('MediaRecorder error')); };
      mr.onstop = function () {
        resolve({
          blob: new env.Blob(chunks, { type: mimeType }),
          mimeType: mimeType,
          frameCount: plan.totalFrames,
          totalMs: plan.totalMs
        });
      };
      mr.start();
      var slotMs = 1000 / fps;
      var i = 0;
      (function drawNext() {
        if (i >= plan.frames.length) { mr.stop(); return; }
        var fr = plan.frames[i];
        var svg;
        try {
          svg = Frames.renderFrame(spec, fr.scene, fr.atMs);
        } catch (err) { reject(err); return; }
        drawSvgFrame(env, ctx, svg, W, H).then(function () {
          i++;
          if (typeof opts.onProgress === 'function') {
            opts.onProgress(i / plan.frames.length, { scene: fr.scene, frame: fr.frame, frames: plan.frames.length });
          }
          setTimeout(drawNext, slotMs);
        }, reject);
      })();
    });
  }

  var api = {
    buildFramePlan: buildFramePlan,
    defaultExportName: defaultExportName,
    preferredMimeTypes: preferredMimeTypes,
    pickMimeType: pickMimeType,
    supportCheck: supportCheck,
    recordSpec: recordSpec
  };
  global.AnimathExportRecord = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
