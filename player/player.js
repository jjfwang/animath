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

  function drawShape(shape) {
    var n;
    switch (shape.kind) {
      case 'text': {
        n = el('text', {
          x: shape.x, y: shape.y,
          'font-size': shape.size || 28,
          fill: shape.color || '#1a1a1a',
          'text-anchor': shape.align || 'start',
          'font-family': 'system-ui, -apple-system, sans-serif'
        });
        n.textContent = shape.text;
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

  // Position fields per shape kind, for move interpolation.
  var POS_FIELDS = {
    text: ['x', 'y'],
    rect: ['x', 'y'],
    circle: ['cx', 'cy'],
    line: ['x1', 'y1', 'x2', 'y2'],
    arrow: ['x1', 'y1', 'x2', 'y2']
  };

  function applyPos(node, shape, pos) {
    var fields = POS_FIELDS[shape.kind];
    if (!fields) return;
    fields.forEach(function (f) {
      if (pos[f] !== undefined) node.setAttribute(f, pos[f]);
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

    function updateChrome() {
      var scene = spec.scenes[state.sceneIdx];
      scrub.value = String(Math.round((state.sceneTime / scene.duration_ms) * 1000));
      tlabel.textContent = fmt(state.sceneTime) + ' / ' + fmt(scene.duration_ms);
      btnPlay.innerHTML = state.playing ? '&#10074;&#10074;' : '&#9654;';
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
          fireStep(step, false);
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
        var pos = {};
        for (var f in tw.to) {
          if (tw.from[f] !== undefined) pos[f] = tw.from[f] + (tw.to[f] - tw.from[f]) * p;
        }
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
        else renderSceneAt(state.sceneIdx, 0, false);
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
      renderSceneAt(state.sceneIdx, ms || 0, false);
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

    renderSceneAt(0, 0, false);

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

  var api = { mount: mount, version: '0.1' };
  global.AnimathPlayer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
