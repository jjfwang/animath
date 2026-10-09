/* animath export frames v0.1 — DOM-free deterministic per-frame SVG (slice 1 of issue #506).
 *
 * Slice 2's browser recording harness consumes this contract: given a spec +
 * frame index, produce the SVG string for that frame deterministically, so
 * frames can be rasterized to an offscreen canvas and fed to MediaRecorder.
 * No MediaRecorder here, no UI here, no new text rendering path (Unicode math
 * only — latex shapes render through latexFallbackText, exactly like the
 * player's no-KaTeX fallback; a DOM is required for KaTeX, so it cannot run
 * in this contract).
 *
 * Deterministic contract (byte-identical across runs and processes):
 *  - shapeMarkup() mirrors drawShape's attribute decisions exactly: the same
 *    defaults (fill 'none', stroke '#1a1a1a', stroke-width 2, text-anchor
 *    'start'), the same geometry (sectorPath, taperShaft, arrowhead rebuild),
 *    data-shape-id on every shape. It reuses the player's exported pure
 *    helpers (player.js must be loaded first in the browser; in Node it is
 *    required below), so the contract cannot drift from the renderer.
 *  - sceneShapes() replays the scene timeline with the player's instant
 *    semantics (renderSceneAt(i, ms, instant=true)): steps fire in array
 *    order when step.at_ms <= ms; show adds, hide removes, emphasize is a
 *    geometric no-op, caption targets the HTML chrome and is ignored. The
 *    one deliberate difference: move steps INTERPOLATE with interpFields at
 *    p = (ms - step.at_ms) / (step.dur_ms || 800) instead of jumping to
 *    step.to, so a frame sampled mid-tween matches the player's live tween
 *    position. (The player's tween loop is linear in p — no easing — so the
 *    match is exact, not approximate.)
 *  - Opacity fades (the player's 300ms show fade) are FLATTENED: a frame
 *    either contains a shape or it does not. Fades are a presentation
 *    nicety; a recorded frame must be a clean still.
 *  - Text content is XML-escaped; numbers serialize with JS String(), which
 *    is deterministic in V8. No Date, no Math.random, no DOM anywhere.
 */
(function (global) {
  'use strict';

  // The player's pure render path. In Node this is a require; in the
  // browser player.js must be loaded first (it sets global.AnimathPlayer).
  var player = (typeof module !== 'undefined' && module.exports)
    ? require('./player.js')
    : global.AnimathPlayer;

  // XML-escape for text content and double-quoted attribute values.
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function attrs(pairs) {
    return pairs.filter(function (pr) { return pr[1] !== undefined && pr[1] !== null; })
      .map(function (pr) { return ' ' + pr[0] + '="' + esc(pr[1]) + '"'; }).join('');
  }

  // Common defaults shared with drawShape: fill 'none', stroke '#1a1a1a',
  // stroke-width 2. Returns the [fill, stroke, stroke-width] attr triples.
  function baseAttrs(shape) {
    return [
      ['fill', shape.fill || 'none'],
      ['stroke', shape.stroke || '#1a1a1a'],
      ['stroke-width', shape.strokeWidth || 2]
    ];
  }

  // Text-ish markup (text + latex fallback), mirroring textNode(): same
  // defaults for size/color/align/font-family.
  function textMarkup(shape, content) {
    return '<text' + attrs([
      ['x', shape.x], ['y', shape.y],
      ['font-size', shape.size || 28],
      ['fill', shape.color || '#1a1a1a'],
      ['text-anchor', shape.align || 'start'],
      ['font-family', 'system-ui, -apple-system, sans-serif'],
      ['data-shape-id', shape.id]
    ]) + '>' + esc(content) + '</text>';
  }

  // Arrowhead polygon, mirroring drawShape's arrow case exactly
  // (hs = 10 + 2*head-end width, 0.42 rad half-angle).
  function arrowHead(shape, hs) {
    var ang = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
    var p1x = shape.x2 - hs * Math.cos(ang - 0.42);
    var p1y = shape.y2 - hs * Math.sin(ang - 0.42);
    var p2x = shape.x2 - hs * Math.cos(ang + 0.42);
    var p2y = shape.y2 - hs * Math.sin(ang + 0.42);
    return '<polygon' + attrs([
      ['points', shape.x2 + ',' + shape.y2 + ' ' + p1x + ',' + p1y + ' ' + p2x + ',' + p2y],
      ['fill', shape.stroke || '#1a1a1a']
    ]) + '/>';
  }

  // Deterministic SVG markup for one shape — the string twin of drawShape().
  function shapeMarkup(shape) {
    switch (shape.kind) {
      case 'text':
        return textMarkup(shape, shape.text);
      case 'latex':
        // KaTeX needs a DOM, so this contract always takes the player's
        // no-KaTeX fallback path (identical to what the player renders when
        // the CDN is unavailable).
        return textMarkup(shape, player.latexFallbackText(shape.tex));
      case 'rect':
        return '<rect' + attrs([
          ['x', shape.x], ['y', shape.y],
          ['width', shape.w], ['height', shape.h],
          ['rx', shape.rx || 0]
        ].concat(baseAttrs(shape), [['data-shape-id', shape.id]])) + '/>';
      case 'circle':
        return '<circle' + attrs([
          ['cx', shape.cx], ['cy', shape.cy], ['r', shape.r]
        ].concat(baseAttrs(shape), [['data-shape-id', shape.id]])) + '/>';
      case 'line':
        return '<line' + attrs([
          ['x1', shape.x1], ['y1', shape.y1], ['x2', shape.x2], ['y2', shape.y2],
          ['stroke', shape.stroke || '#1a1a1a'],
          ['stroke-width', shape.width || 3],
          ['stroke-linecap', 'round'],
          ['stroke-dasharray', player.dashAttr(shape)],
          ['data-shape-id', shape.id]
        ]) + '/>';
      case 'arrow': {
        var w = shape.width || 3;
        var hasTaper = player.isWidths(shape.widths);
        var wh = hasTaper ? shape.widths[1] : w;
        var hs = 10 + wh * 2;
        var shaft;
        if (hasTaper) {
          // Tapered shaft: dash does not apply to a filled polygon
          // (documented in SPEC.md, mirrored from drawShape).
          shaft = '<polygon' + attrs([
            ['points', player.taperShaft(shape, shape.widths[0], shape.widths[1], hs)],
            ['fill', shape.stroke || '#1a1a1a']
          ]) + '/>';
        } else {
          shaft = '<line' + attrs([
            ['x1', shape.x1], ['y1', shape.y1], ['x2', shape.x2], ['y2', shape.y2],
            ['stroke', shape.stroke || '#1a1a1a'],
            ['stroke-width', w],
            ['stroke-linecap', 'round'],
            ['stroke-dasharray', player.dashAttr(shape)]
          ]) + '/>';
        }
        return '<g' + attrs([['data-shape-id', shape.id]]) + '>' +
          shaft + arrowHead(shape, hs) + '</g>';
      }
      case 'polygon': {
        var pts = shape.points.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
        return '<polygon' + attrs([
          ['points', pts]
        ].concat(baseAttrs(shape), [
          ['stroke-linejoin', 'round'],
          ['data-shape-id', shape.id]
        ])) + '/>';
      }
      case 'sector':
        return '<path' + attrs([
          ['d', player.sectorPath(shape)]
        ].concat(baseAttrs(shape), [['data-shape-id', shape.id]])) + '/>';
      default:
        throw new Error('unknown shape kind: ' + shape.kind);
    }
  }

  // Shallow-clone a shape so timeline replay never mutates the spec.
  // Points/widths arrays are copied (move interpolation writes into them).
  function cloneShape(shape) {
    var c = {};
    for (var k in shape) {
      if (k === 'points' && Array.isArray(shape.points)) {
        c.points = shape.points.map(function (p) { return [p[0], p[1]]; });
      } else if (k === 'widths' && Array.isArray(shape.widths)) {
        c.widths = [shape.widths[0], shape.widths[1]];
      } else {
        c[k] = shape[k];
      }
    }
    return c;
  }

  // Visible shapes (with interpolated positions) at time ms in scene
  // sceneIdx. Deterministic replay of the scene timeline; see the header.
  function sceneShapes(spec, sceneIdx, ms) {
    var scenes = spec.scenes || [];
    var scene = scenes[sceneIdx];
    if (!scene) return [];
    var visible = {};
    (scene.steps || []).forEach(function (step) {
      if (!(step.at_ms <= ms)) return;
      switch (step.do) {
        case 'show':
          visible[step.shape.id] = cloneShape(step.shape);
          break;
        case 'hide':
          delete visible[step.target];
          break;
        case 'move': {
          var rec = visible[step.target];
          if (!rec) break;
          var dur = step.dur_ms || 800;
          var p = Math.min(1, (ms - step.at_ms) / dur);
          var pos = player.interpFields(rec, step.to, p);
          for (var f in pos) rec[f] = pos[f];
          break;
        }
        default:
          break; // emphasize: no geometric effect; caption: chrome-only.
      }
    });
    return Object.keys(visible).map(function (id) { return visible[id]; });
  }

  // Full standalone SVG string for one frame. xmlns is included so slice 2
  // can draw the frame into a canvas from a blob URL.
  function renderFrame(spec, sceneIdx, ms) {
    var W = spec.canvas.width, H = spec.canvas.height;
    var body = sceneShapes(spec, sceneIdx, ms).map(shapeMarkup).join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '">' +
      body + '</svg>';
  }

  // Frame timing for slice 2: ms of frame frameIdx at fps frames/second,
  // and the frame count for a scene (ceil so a trailing partial frame is kept).
  function frameMs(frameIdx, fps) {
    return frameIdx * (1000 / fps);
  }

  function sceneFrameCount(spec, sceneIdx, fps) {
    var scene = (spec.scenes || [])[sceneIdx];
    if (!scene) return 0;
    return Math.ceil(scene.duration_ms / (1000 / fps));
  }

  var api = {
    version: '0.1',
    shapeMarkup: shapeMarkup,
    sceneShapes: sceneShapes,
    renderFrame: renderFrame,
    frameMs: frameMs,
    sceneFrameCount: sceneFrameCount
  };
  global.AnimathExportFrames = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
