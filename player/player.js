/* animath player v0.1 — dependency-free SVG renderer for animation specs.
 *
 * Usage (browser):
 *   var player = AnimathPlayer.mount(document.getElementById('stage'), spec);
 *   player.play(); player.pause(); player.restart();
 *   player.nextScene(); player.prevScene();
 *   player.seekScene(i, ms); player.setSpeed(1.5);
 *   player.on('scene', function (i) { ... });
 *   player.destroy();
 *
 * Node: require()able for smoke tests (no DOM touched until mount()).
 */
(function (global) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var FADE_MS = 300;

  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    }
    return n;
  }

  function textNode(x, y, content, opts) {
    var n = el('text', {
      x: x, y: y,
      'font-size': opts.size || 28,
      fill: opts.color || '#1a1a1a',
      'text-anchor': opts.align || 'start',
      'font-family': 'system-ui, -apple-system, sans-serif'
    });
    n.textContent = content;
    return n;
  }

  // Pure (no-DOM) helpers, exported so Node tests can exercise them.

  // True when a KaTeX API object is available for rendering. Takes the
  // candidate object as a parameter instead of reading the global directly.
  function katexAvailable(katex) {
    return !!(katex && typeof katex.renderToString === 'function');
  }

  // Best-effort unicode approximation of a LaTeX string, for the fallback
  // path when KaTeX is unavailable (CDN failed, offline, file://).
  function latexFallbackText(tex) {
    return String(tex)
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
      .replace(/\\sqrt\{([^{}]*)\}/g, '\u221A($1)')
      .replace(/\^2/g, '\u00B2')
      .replace(/\^3/g, '\u00B3')
      .replace(/\\times/g, '\u00D7')
      .replace(/\\div/g, '\u00F7')
      .replace(/\\pm/g, '\u00B1')
      .replace(/\\cdot/g, '\u00B7')
      .replace(/\\leq/g, '\u2264')
      .replace(/\\geq/g, '\u2265')
      .replace(/\\neq/g, '\u2260')
      .replace(/\\approx/g, '\u2248')
      .replace(/\\pi/g, '\u03C0')
      .replace(/\\theta/g, '\u03B8')
      .replace(/[{}]/g, '')
      .replace(/\\([a-zA-Z]+)/g, '$1');
  }

  // One filmstrip label per scene: 1-based index plus the scene id,
  // e.g. "1 · s1". DOM-free; mount() builds the per-scene nav buttons
  // from this. A missing/empty id falls back to the 0-based index.
  function stripLabels(scenes) {
    return (scenes || []).map(function (scene, i) {
      var id = (scene && scene.id !== undefined && scene.id !== null &&
        String(scene.id) !== '') ? String(scene.id) : String(i);
      return (i + 1) + ' · ' + id;
    });
  }

  // Map a keyboard event to a player action. DOM-free: takes an event-like
  // {key, target} so Node tests can call it directly. Returns one of
  // 'toggle' | 'prev' | 'next', or null for unmapped keys and for keys
  // pressed while typing in an input/textarea/select.
  function keyAction(eventLike) {
    var t = eventLike && eventLike.target;
    if (t && t.tagName) {
      var tag = String(t.tagName).toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return null;
    }
    var key = eventLike && eventLike.key;
    if (key === ' ' || key === 'Spacebar') return 'toggle';
    if (key === 'ArrowLeft') return 'prev';
    if (key === 'ArrowRight') return 'next';
    return null;
  }

  // Pure prefers-reduced-motion check: takes a matchMedia-like function so
  // tests can inject a fake. The call site inside mount() guards
  // matchMedia's existence; server/odd environments must never throw.
  function prefersReducedMotion(matcher) {
    if (typeof matcher !== 'function') return false;
    try {
      var m = matcher('(prefers-reduced-motion: reduce)');
      return !!(m && m.matches);
    } catch (e) {
      return false;
    }
  }

  function drawShape(shape) {
    var n;
    switch (shape.kind) {
      case 'text': {
        n = textNode(shape.x, shape.y, shape.text, shape);
        break;
      }
      case 'latex': {
        if (katexAvailable(global.katex)) {
          var html = global.katex.renderToString(shape.tex, { throwOnError: false });
          n = el('foreignObject', { x: shape.x, y: shape.y, width: 480, height: 240 });
          var div = document.createElement('div');
          div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
          div.style.fontSize = (shape.size || 28) + 'px';
          div.style.color = shape.color || '#1a1a1a';
          div.style.fontFamily = 'system-ui, -apple-system, sans-serif';
          div.innerHTML = html;
          n.appendChild(div);
        } else {
          n = textNode(shape.x, shape.y, latexFallbackText(shape.tex), shape);
        }
        break;
      }
      case 'rect':
        n = el('rect', {
          x: shape.x, y: shape.y, width: shape.w, height: shape.h, rx: shape.rx || 0,
          fill: shape.fill || 'none',
          stroke: shape.stroke || '#1a1a1a',
          'stroke-width': shape.strokeWidth || 2
        });
        break;
      case 'circle':
        n = el('circle', {
          cx: shape.cx, cy: shape.cy, r: shape.r,
          fill: shape.fill || 'none',
          stroke: shape.stroke || '#1a1a1a',
          'stroke-width': shape.strokeWidth || 2
        });
        break;
      case 'line':
        n = el('line', {
          x1: shape.x1, y1: shape.y1, x2: shape.x2, y2: shape.y2,
          stroke: shape.stroke || '#1a1a1a',
          'stroke-width': shape.width || 3,
          'stroke-linecap': 'round'
        });
        break;
      case 'arrow': {
        n = el('g', {});
        var stroke = shape.stroke || '#1a1a1a';
        var w = shape.width || 3;
        n.appendChild(el('line', {
          x1: shape.x1, y1: shape.y1, x2: shape.x2, y2: shape.y2,
          stroke: stroke, 'stroke-width': w, 'stroke-linecap': 'round'
        }));
        var ang = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
        var s = 10 + w * 2;
        var p1x = shape.x2 - s * Math.cos(ang - 0.42);
        var p1y = shape.y2 - s * Math.sin(ang - 0.42);
        var p2x = shape.x2 - s * Math.cos(ang + 0.42);
        var p2y = shape.y2 - s * Math.sin(ang + 0.42);
        n.appendChild(el('polygon', {
          points: shape.x2 + ',' + shape.y2 + ' ' + p1x + ',' + p1y + ' ' + p2x + ',' + p2y,
          fill: stroke
        }));
        break;
      }
      case 'polygon': {
        var pts = shape.points.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
        n = el('polygon', {
          points: pts,
          fill: shape.fill || 'none',
          stroke: shape.stroke || '#1a1a1a',
          'stroke-width': shape.strokeWidth || 2,
          'stroke-linejoin': 'round'
        });
        break;
      }
      default:
        throw new Error('unknown shape kind: ' + shape.kind);
    }
    n.setAttribute('data-shape-id', shape.id);
    n.style.opacity = '0';
    n.style.transition = 'opacity ' + FADE_MS + 'ms ease';
    return n;
  }

  // Position and size fields per shape kind, for move interpolation.
  var POS_FIELDS = {
    text: ['x', 'y'],
    latex: ['x', 'y'],
    rect: ['x', 'y', 'w', 'h'],
    circle: ['cx', 'cy', 'r'],
    line: ['x1', 'y1', 'x2', 'y2'],
    arrow: ['x1', 'y1', 'x2', 'y2']
  };

  // Pure per-field interpolation of a move tween: pos[f] = from[f] +
  // (to[f] - from[f]) * p for every field present in `to` that also has a
  // starting value in `from`. Factored out of the tween loop so it can be
  // tested without a DOM; the tween loop calls it on every frame.
  function interpFields(from, to, p) {
    var pos = {};
    for (var f in to) {
      if (from[f] !== undefined) pos[f] = from[f] + (to[f] - from[f]) * p;
    }
    return pos;
  }

  // SVG attribute names differ from spec field names for rect size:
  // drawShape maps shape.w/shape.h to width/height, so applyPos must too —
  // setting raw 'w'/'h' attributes is a rendering no-op. Other fields name
  // their attribute directly (circle r is unaffected).
  var FIELD_ATTR = { w: 'width', h: 'height' };

  function applyPos(node, shape, pos) {
    var fields = POS_FIELDS[shape.kind];
    if (!fields) return;
    fields.forEach(function (f) {
      if (pos[f] !== undefined) node.setAttribute(FIELD_ATTR[f] || f, pos[f]);
    });
    if (shape.kind === 'arrow') {
      // Rebuild the arrowhead at the new tip.
      while (node.firstChild) node.removeChild(node.firstChild);
      var rebuilt = drawShape({
        id: shape.id, kind: 'arrow',
        x1: pos.x1 !== undefined ? pos.x1 : shape.x1,
        y1: pos.y1 !== undefined ? pos.y1 : shape.y1,
        x2: pos.x2 !== undefined ? pos.x2 : shape.x2,
        y2: pos.y2 !== undefined ? pos.y2 : shape.y2,
        stroke: shape.stroke, width: shape.width
      });
      rebuilt.style.opacity = '1';
      rebuilt.style.transition = 'none';
      while (rebuilt.firstChild) node.appendChild(rebuilt.firstChild);
    }
  }

  function currentPos(shape) {
    var fields = POS_FIELDS[shape.kind] || [];
    var pos = {};
    fields.forEach(function (f) {
      if (shape[f] !== undefined) pos[f] = shape[f];
    });
    return pos;
  }

  function mount(container, spec) {
    var W = spec.canvas.width, H = spec.canvas.height;

    container.innerHTML = '';
    container.className = (container.className + ' animath-player').trim();

    var header = document.createElement('div');
    header.className = 'ap-header';
    header.textContent = spec.title;
    container.appendChild(header);

    var stage = document.createElement('div');
    stage.className = 'ap-stage';
    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      width: '100%',
      preserveAspectRatio: 'xMidYMid meet'
    });
    stage.appendChild(svg);
    var captionBar = document.createElement('div');
    captionBar.className = 'ap-caption';
    stage.appendChild(captionBar);
    container.appendChild(stage);

    var narration = document.createElement('div');
    narration.className = 'ap-narration';
    container.appendChild(narration);

    var controls = document.createElement('div');
    controls.className = 'ap-controls';
    controls.innerHTML =
      '<button data-a="prev" title="Previous scene">|&#9664;</button>' +
      '<button data-a="play" title="Play/Pause">&#9654;</button>' +
      '<button data-a="next" title="Next scene">&#9654;|</button>' +
      '<input data-a="scrub" type="range" min="0" max="1000" value="0">' +
      '<span data-a="tlabel">0:00 / 0:00</span>' +
      '<select data-a="speed"><option value="0.5">0.5x</option>' +
      '<option value="1" selected>1x</option><option value="1.5">1.5x</option>' +
      '<option value="2">2x</option></select>';
    container.appendChild(controls);

    var btnPlay = controls.querySelector('[data-a="play"]');
    var scrub = controls.querySelector('[data-a="scrub"]');
    var tlabel = controls.querySelector('[data-a="tlabel"]');
    var speedSel = controls.querySelector('[data-a="speed"]');

    // Filmstrip nav: one button per scene. Each button jumps through the
    // same goScene closure the prev/next controls use.
    var strip = document.createElement('div');
    strip.className = 'ap-filmstrip';
    var stripBtns = stripLabels(spec.scenes).map(function (label, i) {
      var b = document.createElement('button');
      b.setAttribute('data-scene', String(i));
      b.setAttribute('aria-label', 'Go to scene ' + (i + 1));
      b.textContent = label;
      b.addEventListener('click', function () { goScene(i, 0); });
      strip.appendChild(b);
      return b;
    });
    container.appendChild(strip);

    var state = {
      sceneIdx: 0,
      sceneTime: 0,       // ms into current scene
      playing: false,
      speed: 1,
      raf: 0,
      lastTick: 0,
      fired: {},          // step index -> true (per scene render)
      tweens: [],         // active move interpolations
      pulses: [],         // active emphasize animations
      shapes: {},         // id -> {node, shape}
      listeners: { scene: [] }
    };

    function fmt(ms) {
      var s = Math.floor(ms / 1000);
      return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    }

    // Honor prefers-reduced-motion: render every path instantly (no tween /
    // fade / pulse animation) when the OS setting is on. matchMedia is
    // feature-guarded; Node test runs never call mount() so it is simply
    // absent there. Narration/caption text and all timing are untouched.
    var reducedMotion = prefersReducedMotion(typeof matchMedia === 'function' ? matchMedia : null);

    function emitScene() {
      state.listeners.scene.forEach(function (fn) { fn(state.sceneIdx); });
    }

    function clearScene() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      state.shapes = {};
      state.fired = {};
      state.tweens = [];
      state.pulses = [];
    }

    function fireStep(step, instant) {
      var dur = step.dur_ms || 900;
      switch (step.do) {
        case 'show': {
          var node = drawShape(step.shape);
          svg.appendChild(node);
          state.shapes[step.shape.id] = { node: node, shape: step.shape };
          if (instant) {
            node.style.transition = 'none';
            node.style.opacity = '1';
          } else {
            requestAnimationFrame(function () { node.style.opacity = '1'; });
          }
          break;
        }
        case 'hide': {
          var rec = state.shapes[step.target];
          if (!rec) break;
          if (instant) {
            if (rec.node.parentNode) rec.node.parentNode.removeChild(rec.node);
          } else {
            rec.node.style.opacity = '0';
            setTimeout(function () {
              if (rec.node.parentNode) rec.node.parentNode.removeChild(rec.node);
            }, FADE_MS + 50);
          }
          delete state.shapes[step.target];
          break;
        }
        case 'move': {
          var mrec = state.shapes[step.target];
          if (!mrec || !POS_FIELDS[mrec.shape.kind]) break;
          if (instant) {
            applyPos(mrec.node, mrec.shape, step.to);
            mrec.shape = Object.assign({}, mrec.shape, step.to);
          } else {
            state.tweens.push({
              rec: mrec, from: currentPos(mrec.shape), to: step.to,
              start: state.sceneTime, dur: step.dur_ms || 800
            });
          }
          break;
        }
        case 'emphasize': {
          var erec = state.shapes[step.target];
          if (!erec) break;
          if (!instant) {
            state.pulses.push({ rec: erec, start: state.sceneTime, dur: dur });
          }
          break;
        }
        case 'caption': {
          captionBar.textContent = step.text;
          break;
        }
      }
    }

    function renderSceneAt(i, ms, instant) {
      clearScene();
      var scene = spec.scenes[i];
      captionBar.textContent = scene.caption;
      narration.textContent = scene.narration;
      state.sceneTime = ms;
      scene.steps.forEach(function (step, si) {
        if (step.at_ms <= ms) {
          fireStep(step, instant !== false);
          state.fired[si] = true;
        }
      });
      updateChrome();
    }

    // Mark only the current scene's filmstrip button as active. Called
    // from updateChrome() so play, pause, scrub, goScene, and keyboard
    // all keep the highlight in sync.
    function updateStrip() {
      stripBtns.forEach(function (b, i) {
        if (i === state.sceneIdx) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
    }

    function updateChrome() {
      var scene = spec.scenes[state.sceneIdx];
      scrub.value = String(Math.round((state.sceneTime / scene.duration_ms) * 1000));
      tlabel.textContent = fmt(state.sceneTime) + ' / ' + fmt(scene.duration_ms);
      btnPlay.innerHTML = state.playing ? '&#10074;&#10074;' : '&#9654;';
      updateStrip();
    }

    function tick(now) {
      if (!state.playing) return;
      var dt = (now - state.lastTick) * state.speed;
      state.lastTick = now;
      var scene = spec.scenes[state.sceneIdx];
      state.sceneTime += dt;

      // Fire due steps.
      scene.steps.forEach(function (step, si) {
        if (!state.fired[si] && step.at_ms <= state.sceneTime) {
          fireStep(step, reducedMotion);
          state.fired[si] = true;
        }
      });

      // Advance tweens.
      state.tweens = state.tweens.filter(function (tw) {
        var p = (state.sceneTime - tw.start) / tw.dur;
        if (p >= 1) {
          applyPos(tw.rec.node, tw.rec.shape, tw.to);
          tw.rec.shape = Object.assign({}, tw.rec.shape, tw.to);
          return false;
        }
        var pos = interpFields(tw.from, tw.to, p);
        applyPos(tw.rec.node, tw.rec.shape, pos);
        return true;
      });

      // Advance pulses.
      state.pulses = state.pulses.filter(function (pu) {
        var p = (state.sceneTime - pu.start) / pu.dur;
        if (p >= 1) {
          pu.rec.node.style.transform = '';
          return false;
        }
        var s = 1 + 0.18 * Math.sin(p * Math.PI);
        pu.rec.node.style.transformBox = 'fill-box';
        pu.rec.node.style.transformOrigin = 'center';
        pu.rec.node.style.transform = 'scale(' + s.toFixed(3) + ')';
        return true;
      });

      if (state.sceneTime >= scene.duration_ms) {
        if (state.sceneIdx < spec.scenes.length - 1) {
          goScene(state.sceneIdx + 1, 0);
        } else {
          pause();
          renderSceneAt(state.sceneIdx, scene.duration_ms, true);
        }
      }
      updateChrome();
      state.raf = requestAnimationFrame(tick);
    }

    function play() {
      if (state.playing) return;
      var scene = spec.scenes[state.sceneIdx];
      if (state.sceneTime >= scene.duration_ms) {
        if (state.sceneIdx < spec.scenes.length - 1) goScene(state.sceneIdx + 1, 0);
        else renderSceneAt(state.sceneIdx, 0, reducedMotion);
      }
      state.playing = true;
      state.lastTick = performance.now();
      state.raf = requestAnimationFrame(tick);
      updateChrome();
    }

    function pause() {
      state.playing = false;
      if (state.raf) cancelAnimationFrame(state.raf);
      updateChrome();
    }

    function goScene(i, ms) {
      pause();
      state.sceneIdx = Math.max(0, Math.min(spec.scenes.length - 1, i));
      renderSceneAt(state.sceneIdx, ms || 0, reducedMotion);
      emitScene();
    }

    // Wire controls.
    btnPlay.addEventListener('click', function () {
      if (state.playing) pause(); else play();
    });
    controls.querySelector('[data-a="prev"]').addEventListener('click', function () {
      goScene(state.sceneIdx - 1, 0);
    });
    controls.querySelector('[data-a="next"]').addEventListener('click', function () {
      goScene(state.sceneIdx + 1, 0);
    });
    scrub.addEventListener('input', function () {
      var scene = spec.scenes[state.sceneIdx];
      pause();
      renderSceneAt(state.sceneIdx, (Number(scrub.value) / 1000) * scene.duration_ms, true);
    });
    speedSel.addEventListener('change', function () {
      state.speed = Number(speedSel.value);
    });

    // Keyboard shortcuts. The container is focusable (tabindex="0") so the
    // keys work after clicking anywhere in the player; preventDefault()
    // stops Space from scrolling the page or re-activating a focused
    // control button, so each keydown produces exactly one action.
    container.setAttribute('tabindex', '0');
    container.addEventListener('keydown', function (e) {
      var action = keyAction(e);
      if (!action) return;
      e.preventDefault();
      if (action === 'toggle') { if (state.playing) pause(); else play(); }
      else if (action === 'prev') goScene(state.sceneIdx - 1, 0);
      else if (action === 'next') goScene(state.sceneIdx + 1, 0);
    });

    renderSceneAt(0, 0, reducedMotion);

    return {
      spec: spec,
      play: play,
      pause: pause,
      restart: function () { goScene(0, 0); play(); },
      nextScene: function () { goScene(state.sceneIdx + 1, 0); },
      prevScene: function () { goScene(state.sceneIdx - 1, 0); },
      seekScene: function (i, ms) { goScene(i, ms || 0); },
      setSpeed: function (x) { state.speed = x; speedSel.value = String(x); },
      on: function (evt, fn) {
        if (state.listeners[evt]) state.listeners[evt].push(fn);
      },
      destroy: function () {
        pause();
        container.innerHTML = '';
      }
    };
  }

  var api = { mount: mount, version: '0.1', katexAvailable: katexAvailable, latexFallbackText: latexFallbackText, stripLabels: stripLabels, keyAction: keyAction, prefersReducedMotion: prefersReducedMotion, interpFields: interpFields, applyPos: applyPos };
  global.AnimathPlayer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
