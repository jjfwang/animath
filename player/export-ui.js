/* Export button UI wiring — slice 3 of issue #506.
 *
 * Connects the slice-1/slice-2 export modules (AnimathExportFrames /
 * AnimathExportRecord) to a demo page: one clearly-labeled Export button with
 * a short status line (idle / recording progress / done with the file name /
 * error reason). UMD, zero dependencies, no DOM at load: every browser
 * capability (document, window, the export harness) arrives through injected
 * parameters, so the whole flow is node-testable with fakes.
 *
 * Reduced motion: the export always records the FULL scene sequence at normal
 * pace (per #506), so a reduced-motion user receives the same complete video —
 * nothing is shortened or skipped. The live player keeps playing undisturbed;
 * recording runs on the harness's own rasterized frames.
 *
 * Usage from a demo page (thin bootstrap only):
 *   var ui = AnimathExportUI.attachExportUI(document, window, AnimathExportRecord, {
 *     getSpec: function () { return currentSpec; },
 *     getSlug: function () { return currentSlug; }
 *   });
 *   // after each spec load:
 *   ui.refresh();
 */
(function (global) {
  'use strict';

  var EXPORT_FPS = 30;

  // Deps for the export pipeline; `record` is the slice-2 harness (recordSpec,
  // supportCheck, defaultExportName exposed by player/export-record.js).
  //   cfg: { spec, env, slug, record }
  // env: { MediaRecorder, document, Image, Blob } — the real browser objects
  //      on the demo page, fakes in tests.
  function createExportController(cfg) {
    var spec = cfg.spec;
    var env = cfg.env;
    var slug = cfg.slug;
    var record = cfg.record;

    function supportReason() {
      return record.supportCheck(env);
    }

    function fileName(when) {
      return record.defaultExportName(slug, when);
    }

    // ui: { onProgress(frac, info), onDone(name), onError(message) } —
    // every callback optional. Returns the underlying promise.
    function run(ui) {
      ui = ui || {};
      var reason = supportReason();
      if (reason) {
        if (typeof ui.onError === 'function') ui.onError(reason);
        return Promise.reject(new Error(reason));
      }
      return record.recordSpec(spec, {
        fps: EXPORT_FPS,
        onProgress: function (frac, info) {
          if (typeof ui.onProgress === 'function') ui.onProgress(frac, info);
        }
      }, env).then(function (result) {
        var name = fileName();
        var url = cfg.createObjectURL(result.blob);
        cfg.download(url, name);
        cfg.revokeObjectURL(url);
        if (typeof ui.onDone === 'function') ui.onDone(name);
        return { name: name, frameCount: result.frameCount, totalMs: result.totalMs };
      }, function (err) {
        var message = err && err.message ? err.message : String(err);
        if (typeof ui.onError === 'function') ui.onError(message);
        throw err;
      });
    }

    return { supportReason: supportReason, fileName: fileName, run: run };
  }

  // Full demo-page wiring with an injected document/window pair.
  //   doc:  { getElementById, createElement, body } (real document on the page)
  //   win:  { MediaRecorder, Image, Blob, URL } (real window on the page)
  //   record: the slice-2 harness (AnimathExportRecord on the page)
  //   fns:  { getSpec() -> spec|null, getSlug() -> string }
  // The page must contain a button#exportbtn and a span#exportstatus.
  // Returns { refresh() } — call after each spec load so the button tracks the
  // current spec and capability state.
  function attachExportUI(doc, win, record, fns) {
    var button = doc.getElementById('exportbtn');
    var status = doc.getElementById('exportstatus');
    var env = { MediaRecorder: win.MediaRecorder, document: doc, Image: win.Image, Blob: win.Blob };
    var ctl = null;

    function setStatus(text) {
      status.textContent = text;
    }

    function refresh() {
      var spec = fns.getSpec();
      if (!spec) {
        ctl = null;
        button.disabled = true;
        button.title = 'Load a sample to enable export';
        setStatus('');
        return;
      }
      ctl = createExportController({
        spec: spec,
        env: env,
        slug: fns.getSlug(),
        record: record,
        createObjectURL: function (blob) { return win.URL.createObjectURL(blob); },
        download: function (url, name) {
          var a = doc.createElement('a');
          a.href = url;
          a.download = name;
          doc.body.appendChild(a);
          a.click();
          a.remove();
        },
        revokeObjectURL: function (url) { win.URL.revokeObjectURL(url); }
      });
      var reason = ctl.supportReason();
      button.disabled = !!reason;
      button.title = reason || 'Record the full animation as a WebM video';
      setStatus(reason ? 'Export unavailable: ' + reason : '');
    }

    button.addEventListener('click', function () {
      if (!ctl || button.disabled) return;
      button.disabled = true;
      setStatus('Recording... 0%');
      // The returned promise is handled through the ui callbacks; swallow it
      // here so a recording failure never surfaces as an unhandled rejection.
      ctl.run({
        onProgress: function (frac) {
          setStatus('Recording... ' + Math.round(frac * 100) + '%');
        },
        onDone: function (name) {
          refresh();
          setStatus('Saved ' + name);
        },
        onError: function (message) {
          refresh();
          setStatus('Export failed: ' + message);
        }
      }).then(null, function () {});
    });

    return { refresh: refresh };
  }

  var api = {
    EXPORT_FPS: EXPORT_FPS,
    createExportController: createExportController,
    attachExportUI: attachExportUI
  };
  global.AnimathExportUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
