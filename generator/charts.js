/* animath zero-dep chart toolkit — R-charts (+#157): pure chart-construction helpers.
 *
 * pieSectors(cx, cy, r, values, opts) -> sector descriptors for a pie chart,
 * barLayout(x, y, w, h, values, opts) -> rect descriptors for a bar chart,
 * axisTicks(min, max, count) -> "nice" tick values for an axis,
 * numberLine(x1, x2, y, min, max, ticks, opts) -> baseline + tick marks + labels,
 * areaUnderCurve(points, opts) -> polygon points for a filled area,
 * gridLines(x, y, w, h, xTicks, yTicks) -> line descriptors for a chart grid.
 *
 * Every helper is pure (no DOM, no deps), UMD (browser + Node, same pattern
 * as generator/geometry.js and generator/rubric.js), and returns plain
 * spec-ready data: sector/rect/line/text descriptors carry their `kind`
 * and drop straight into `show` steps, so player/validate.js accepts them
 * unchanged. Never throws on invalid input: empty/degenerate inputs yield
 * [] or a degenerate-but-valid structure, documented per helper.
 *
 * DELEGATED DECISION (2026-10-05, per the issue body's own condition):
 * the issue asked for polygon point arrays "until the sector kind lands;
 * then sector descriptors" — the sector kind landed (#155), so pieSectors
 * returns first-class sector descriptors ({kind:'sector', cx, cy, r,
 * startAngle, endAngle}) instead of polygon approximations.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AnimathCharts = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function num(v, d) { return isNum(v) ? v : d; }
  function isObj(v) { return v !== null && typeof v === 'object'; }

  // Numeric contribution of one value entry: finite positive numbers count
  // as-is; anything else (non-number, NaN, zero, negative) contributes 0.
  function contribution(v) {
    return isNum(v) && v > 0 ? v : 0;
  }

  // Avoid FP noise like 359.99999999999994 in emitted coordinates/angles.
  function round6(v) {
    return Math.round(v * 1e6) / 1e6;
  }

  function fillsOf(opts) {
    var f = isObj(opts) ? opts.fills : null;
    return Array.isArray(f) && f.length > 0 ? f : null;
  }

  // Pie slices as first-class sector descriptors. Angles in degrees:
  // 0 = east, positive clockwise (SPEC.md). Values map 1:1 onto sectors,
  // so entries with no positive contribution still emit a zero-angle
  // sector (startAngle === endAngle) to keep index alignment with
  // labels/legends. opts: startAngle (default -90, north), fills (array
  // of CSS color strings). Empty values, a non-positive total, or a
  // non-positive/non-numeric r yield [].
  function pieSectors(cx, cy, r, values, opts) {
    var o = isObj(opts) ? opts : {};
    if (!isNum(cx) || !isNum(cy) || !isNum(r) || r <= 0) return [];
    if (!Array.isArray(values) || values.length === 0) return [];
    var total = 0;
    var i;
    for (i = 0; i < values.length; i++) total += contribution(values[i]);
    if (total <= 0) return [];
    var start = num(o.startAngle, -90);
    var fills = fillsOf(o);
    var out = [];
    var angle = start;
    for (i = 0; i < values.length; i++) {
      var sweep = 360 * contribution(values[i]) / total;
      var sector = {
        kind: 'sector',
        cx: cx, cy: cy, r: r,
        startAngle: round6(angle),
        endAngle: round6(angle + sweep)
      };
      if (fills) sector.fill = fills[i % fills.length];
      out.push(sector);
      angle += sweep;
    }
    return out;
  }

  // Bar chart as rect descriptors. Vertical bars (default) grow up from
  // the zero baseline; with orientation:'h' horizontal bars grow right
  // from it. The value range always spans 0 (unless opts.min/opts.max
  // override) so the zero baseline stays visible; values outside the
  // range are clamped to the plot rect. opts: orientation 'v' | 'h',
  // gap (fraction of one slot, default 0.25), fills, min, max.
  // Empty values or a degenerate plot rect yield [].
  function barLayout(x, y, w, h, values, opts) {
    var o = isObj(opts) ? opts : {};
    if (!isNum(x) || !isNum(y) || !isNum(w) || w <= 0 || !isNum(h) || h <= 0) return [];
    if (!Array.isArray(values) || values.length === 0) return [];
    var horizontal = o.orientation === 'h';
    var gap = num(o.gap, 0.25);
    if (!(gap >= 0) || gap >= 1) gap = 0.25;
    var n = values.length;
    var fills = fillsOf(o);
    var lo = o.min;
    var hi = o.max;
    var m;
    if (!isNum(lo)) {
      lo = 0;
      for (m = 0; m < n; m++) if (isNum(values[m]) && values[m] < lo) lo = values[m];
    }
    if (!isNum(hi)) {
      hi = 0;
      for (m = 0; m < n; m++) if (isNum(values[m]) && values[m] > hi) hi = values[m];
    }
    var span = hi - lo;
    // Value -> pixel along the value axis. Degenerate range: every value
    // maps to the baseline end (bottom for 'v', left for 'h').
    function pos(v) {
      if (!(span > 0)) return horizontal ? x : y + h;
      var cv = isNum(v) ? Math.min(hi, Math.max(lo, v)) : lo;
      var frac = (cv - lo) / span;
      return horizontal ? x + w * frac : y + h * (1 - frac);
    }
    var base = pos(lo >= 0 ? lo : (hi <= 0 ? hi : 0));
    var slotLen = (horizontal ? h : w) / n;
    var barLen = slotLen * (1 - gap);
    var out = [];
    for (var i = 0; i < n; i++) {
      var pv = pos(values[i]);
      var a = Math.min(pv, base);
      var rect;
      if (horizontal) {
        rect = {
          kind: 'rect',
          x: round6(a),
          y: round6(y + i * slotLen + (slotLen - barLen) / 2),
          w: round6(Math.abs(pv - base)),
          h: round6(barLen)
        };
      } else {
        rect = {
          kind: 'rect',
          x: round6(x + i * slotLen + (slotLen - barLen) / 2),
          y: round6(a),
          w: round6(barLen),
          h: round6(Math.abs(pv - base))
        };
      }
      if (fills) rect.fill = fills[i % fills.length];
      out.push(rect);
    }
    return out;
  }

  // "Nice" tick values for an axis: round numbers (1/2/2.5/5/10 x 10^k)
  // spanning [min, max], targeting `count` ticks (default 5).
  // min > max swaps to [max, min]; min === max yields [min]; count < 2
  // yields the endpoints only.
  // "Nice" step for a data range: 1/2/2.5/5/10 x 10^k, rounded toward the
  // requested tick density (Heckbert's nice-numbers-for-graph-labels).
  function niceNum(range) {
    var exp = Math.floor(Math.log10(range));
    var f = range / Math.pow(10, exp);
    var nf = f < 1.5 ? 1 : (f < 3 ? 2 : (f < 7 ? 5 : 10));
    return nf * Math.pow(10, exp);
  }

  function axisTicks(min, max, count) {
    if (!isNum(min) || !isNum(max)) return [];
    if (min > max) { var t = min; min = max; max = t; }
    if (min === max) return [min];
    var c = num(count, 5);
    if (!(c >= 2)) return [min, max];
    var step = niceNum((max - min) / (c - 1));
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var out = [];
    for (var v = lo; v <= hi + step / 2; v += step) {
      out.push(parseFloat(v.toPrecision(12))); // trims FP noise like 0.30000000000000004
    }
    return out;
  }

  // A number line: baseline + tick marks + centered text labels.
  // ticks is either an array of values or a tick count (uses axisTicks).
  // Returns { baseline, ticks, labels } — each a spec-ready descriptor.
  // opts: tickLen (default 8), labelOffset (default 26), size (default 24).
  // min === max draws everything at the midpoint (degenerate but valid).
  function numberLine(x1, x2, y, min, max, ticks, opts) {
    var o = isObj(opts) ? opts : {};
    var x1n = num(x1, 0);
    var x2n = num(x2, 100);
    var yn = num(y, 0);
    var tickLen = num(o.tickLen, 8);
    var labelOffset = num(o.labelOffset, 26);
    var size = num(o.size, 24);
    var lo = isNum(min) ? min : 0;
    var hi = isNum(max) ? max : 1;
    if (lo > hi) { var t = lo; lo = hi; hi = t; }
    var values = Array.isArray(ticks) ? ticks : axisTicks(lo, hi, ticks);
    var span = hi - lo;
    function px(v) {
      if (!(span > 0)) return (x1n + x2n) / 2;
      var cv = isNum(v) ? Math.min(hi, Math.max(lo, v)) : lo;
      return x1n + (x2n - x1n) * (cv - lo) / span;
    }
    var half = tickLen / 2;
    var out = {
      baseline: { kind: 'line', x1: x1n, y1: yn, x2: x2n, y2: yn },
      ticks: [],
      labels: []
    };
    for (var i = 0; i < values.length; i++) {
      if (!isNum(values[i])) continue;
      var tx = round6(px(values[i]));
      out.ticks.push({
        kind: 'line',
        x1: tx, y1: round6(yn - half),
        x2: tx, y2: round6(yn + half)
      });
      out.labels.push({
        kind: 'text',
        x: tx, y: round6(yn + labelOffset),
        text: String(parseFloat(values[i].toPrecision(12))),
        align: 'middle', size: size
      });
    }
    return out;
  }

  // Closed polygon points for the area between a polyline and a baseline:
  // the polyline's points followed by (last.x, baseY) and (first.x, baseY).
  // Points may be [x, y] pairs or {x, y} objects; non-numeric points are
  // skipped. baseY defaults to the lowest point (the drawn x-axis floor).
  // Fewer than 2 valid points yield [].
  function areaUnderCurve(points, opts) {
    var o = isObj(opts) ? opts : {};
    if (!Array.isArray(points)) return [];
    var pts = [];
    var i;
    for (i = 0; i < points.length; i++) {
      var p = points[i];
      var xy = Array.isArray(p) ? p : (isObj(p) ? [p.x, p.y] : null);
      if (xy && isNum(xy[0]) && isNum(xy[1])) pts.push([xy[0], xy[1]]);
    }
    if (pts.length < 2) return [];
    var baseY = o.baseY;
    if (!isNum(baseY)) {
      baseY = pts[0][1];
      for (i = 1; i < pts.length; i++) if (pts[i][1] > baseY) baseY = pts[i][1];
    }
    var out = [];
    for (i = 0; i < pts.length; i++) out.push([pts[i][0], pts[i][1]]);
    out.push([pts[pts.length - 1][0], baseY]);
    out.push([pts[0][0], baseY]);
    return out;
  }

  // Grid lines for a plot rect: vertical lines at each x in xTicks,
  // horizontal lines at each y in yTicks. Non-numeric entries are skipped;
  // empty tick arrays yield [].
  function gridLines(x, y, w, h, xTicks, yTicks) {
    if (!isNum(x) || !isNum(y) || !isNum(w) || !isNum(h)) return [];
    var xs = Array.isArray(xTicks) ? xTicks : [];
    var ys = Array.isArray(yTicks) ? yTicks : [];
    var out = [];
    var i;
    for (i = 0; i < xs.length; i++) {
      if (!isNum(xs[i])) continue;
      out.push({ kind: 'line', x1: xs[i], y1: y, x2: xs[i], y2: y + h });
    }
    for (i = 0; i < ys.length; i++) {
      if (!isNum(ys[i])) continue;
      out.push({ kind: 'line', x1: x, y1: ys[i], x2: x + w, y2: ys[i] });
    }
    return out;
  }

  return {
    pieSectors: pieSectors,
    barLayout: barLayout,
    axisTicks: axisTicks,
    numberLine: numberLine,
    areaUnderCurve: areaUnderCurve,
    gridLines: gridLines
  };
});
