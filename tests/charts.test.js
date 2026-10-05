/* Tests for generator/charts.js — zero-dep chart toolkit (+#157).
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  pieSectors, barLayout, axisTicks, numberLine, areaUnderCurve, gridLines
} = require('../generator/charts.js');
const { validateSpec } = require('../player/validate.js');

function closeTo(actual, expected, eps) {
  assert.ok(
    Math.abs(actual - expected) <= (eps || 1e-6),
    'expected ' + actual + ' to be within ' + (eps || 1e-6) + ' of ' + expected
  );
}

// ---- pieSectors ----

test('pieSectors: equal values split the circle evenly', () => {
  const s = pieSectors(480, 270, 200, [1, 1, 1, 1]);
  assert.equal(s.length, 4);
  closeTo(s[0].startAngle, -90);
  closeTo(s[0].endAngle, 0);
  closeTo(s[1].startAngle, 0);
  closeTo(s[3].endAngle, 270);
  for (const sec of s) {
    assert.equal(sec.kind, 'sector');
    assert.equal(sec.cx, 480);
    assert.equal(sec.cy, 270);
    assert.equal(sec.r, 200);
  }
});

test('pieSectors: single value spans the full circle', () => {
  const s = pieSectors(100, 100, 50, [5]);
  assert.equal(s.length, 1);
  closeTo(s[0].startAngle, -90);
  closeTo(s[0].endAngle, 270);
});

test('pieSectors: sweep angles are proportional to values', () => {
  const s = pieSectors(0, 0, 10, [1, 2, 3]);
  closeTo(s[0].endAngle - s[0].startAngle, 60);
  closeTo(s[1].endAngle - s[1].startAngle, 120);
  closeTo(s[2].endAngle - s[2].startAngle, 180);
});

test('pieSectors: startAngle opt shifts the wheel, fills cycle', () => {
  const s = pieSectors(0, 0, 10, [1, 1], { startAngle: 0, fills: ['#a00', '#0a0'] });
  closeTo(s[0].startAngle, 0);
  closeTo(s[1].endAngle, 360);
  assert.equal(s[0].fill, '#a00');
  assert.equal(s[1].fill, '#0a0');
});

test('pieSectors: zero-contribution entries emit zero-angle sectors', () => {
  const s = pieSectors(0, 0, 10, [2, 0, -1, 2]);
  assert.equal(s.length, 4);
  assert.equal(s[1].startAngle, s[1].endAngle);
  assert.equal(s[2].startAngle, s[2].endAngle);
  closeTo(s[3].endAngle - s[3].startAngle, 180);
});

test('pieSectors: empty values / non-positive total / bad radius yield []', () => {
  assert.deepEqual(pieSectors(0, 0, 10, []), []);
  assert.deepEqual(pieSectors(0, 0, 10, [0, -2]), []);
  assert.deepEqual(pieSectors(0, 0, 0, [1, 2]), []);
  assert.deepEqual(pieSectors(0, 0, -5, [1, 2]), []);
  assert.deepEqual(pieSectors(0, 0, NaN, [1, 2]), []);
});

// ---- barLayout ----

test('barLayout: vertical bars grow up from the zero baseline', () => {
  const bars = barLayout(100, 50, 400, 200, [1, 2]);
  assert.equal(bars.length, 2);
  closeTo(bars[0].x, 100 + 200 * 0.25 / 2); // slot 200 wide, gap 0.25
  closeTo(bars[0].w, 200 * 0.75);
  closeTo(bars[0].h, 100); // max 2 fills the plot, value 1 is half
  closeTo(bars[1].h, 200);
  closeTo(bars[1].y + bars[1].h, 250); // baseline at plot bottom
  closeTo(bars[0].y + bars[0].h, 250);
  for (const b of bars) assert.equal(b.kind, 'rect');
});

test('barLayout: negative values hang below the baseline', () => {
  const bars = barLayout(0, 0, 300, 200, [10, -5]);
  // range spans -5..10, so the zero baseline sits at y + 200*(1 - 5/15)
  closeTo(bars[0].y, 0);              // value 10 reaches the plot top
  closeTo(bars[1].y, bars[0].y + bars[0].h); // negative bar starts at baseline
  closeTo(bars[1].h, 200 / 3, 1e-4);
  closeTo(bars[1].y + bars[1].h, 200); // value -5 reaches the plot bottom
});

test('barLayout: horizontal bars grow right from the baseline', () => {
  const bars = barLayout(0, 0, 400, 200, [1, 2], { orientation: 'h' });
  closeTo(bars[0].h, 100 * 0.75);
  closeTo(bars[0].w, 200);
  closeTo(bars[1].w, 400);
  assert.equal(bars[0].x, 0); // baseline at plot left
});

test('barLayout: explicit min/max clamps out-of-range values', () => {
  const bars = barLayout(0, 0, 200, 100, [50, 250], { min: 0, max: 100 });
  closeTo(bars[0].h, 50);
  closeTo(bars[1].h, 100); // clamped to the plot top
});

test('barLayout: gap and fills opts apply; empty values yield []', () => {
  const bars = barLayout(0, 0, 200, 100, [1, 2, 3], { gap: 0.5, fills: ['#123'] });
  closeTo(bars[0].w, 200 / 3 * 0.5);
  assert.equal(bars[2].fill, '#123');
  assert.deepEqual(barLayout(0, 0, 200, 100, []), []);
  assert.deepEqual(barLayout(0, 0, 0, 100, [1]), []);
  assert.deepEqual(barLayout(0, 0, 200, 100, [1], { gap: 2 }), barLayout(0, 0, 200, 100, [1]));
});

// ---- axisTicks ----

test('axisTicks: nice values spanning the range', () => {
  // classic nice-number grid (2.5 rounds to 2, not 2.5)
  assert.deepEqual(axisTicks(0, 100, 5), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(axisTicks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
});

test('axisTicks: range edges are rounded out to the nice grid', () => {
  const t = axisTicks(3, 97, 5);
  assert.ok(t[0] <= 3);
  assert.ok(t[t.length - 1] >= 97);
  for (let i = 1; i < t.length; i++) {
    closeTo(t[i] - t[i - 1], t[1] - t[0], 1e-9); // uniform step
  }
});

test('axisTicks: negative ranges and edge cases', () => {
  assert.deepEqual(axisTicks(-10, 10, 5), [-10, -5, 0, 5, 10]);
  assert.deepEqual(axisTicks(100, 0, 5), axisTicks(0, 100, 5)); // swapped
  assert.deepEqual(axisTicks(7, 7), [7]);
  assert.deepEqual(axisTicks(0, 10, 1), [0, 10]); // count < 2 -> endpoints
  assert.deepEqual(axisTicks(NaN, 10), []);
});

// ---- numberLine ----

test('numberLine: baseline spans x1..x2 with ticks and centered labels', () => {
  const nl = numberLine(100, 500, 300, 0, 10, [0, 5, 10]);
  assert.equal(nl.baseline.kind, 'line');
  assert.equal(nl.baseline.x1, 100);
  assert.equal(nl.baseline.x2, 500);
  assert.equal(nl.ticks.length, 3);
  assert.equal(nl.labels.length, 3);
  assert.equal(nl.ticks[1].x1, 300);
  assert.equal(nl.ticks[1].y1, 300 - 4);
  assert.equal(nl.ticks[1].y2, 300 + 4);
  assert.equal(nl.labels[1].kind, 'text');
  assert.equal(nl.labels[1].text, '5');
  assert.equal(nl.labels[1].align, 'middle');
  assert.equal(nl.labels[0].x, 100);
  assert.equal(nl.labels[2].x, 500);
});

test('numberLine: count form delegates to axisTicks; opts apply', () => {
  const nl = numberLine(0, 100, 50, 0, 100, 5, { tickLen: 10, labelOffset: 30, size: 20 });
  assert.deepEqual(nl.labels.map((l) => l.text), ['0', '20', '40', '60', '80', '100']);
  assert.equal(nl.ticks[0].y1, 50 - 5);
  assert.equal(nl.labels[0].y, 50 + 30);
  assert.equal(nl.labels[0].size, 20);
});

test('numberLine: min > max swaps; degenerate range centers ticks', () => {
  const nl = numberLine(0, 100, 50, 10, 0, [0, 10]);
  assert.equal(nl.ticks[0].x1, 0); // value 0 maps to x1 after the swap
  const flat = numberLine(0, 100, 50, 5, 5, [5]);
  assert.equal(flat.ticks[0].x1, 50);
  assert.equal(flat.labels[0].text, '5');
});

// ---- areaUnderCurve ----

test('areaUnderCurve: closes the polyline down to the baseline', () => {
  const pts = areaUnderCurve([[0, 10], [50, 30], [100, 10]]);
  assert.deepEqual(pts, [[0, 10], [50, 30], [100, 10], [100, 30], [0, 30]]);
});

test('areaUnderCurve: explicit baseY and object points', () => {
  const pts = areaUnderCurve([{ x: 0, y: 5 }, { x: 10, y: 5 }], { baseY: 100 });
  assert.deepEqual(pts, [[0, 5], [10, 5], [10, 100], [0, 100]]);
});

test('areaUnderCurve: skips non-numeric points; < 2 valid points yield []', () => {
  const pts = areaUnderCurve([[0, 1], ['a', 'b'], null, [4, 3]]);
  assert.deepEqual(pts, [[0, 1], [4, 3], [4, 3], [0, 3]]);
  assert.deepEqual(areaUnderCurve([[0, 1]]), []);
  assert.deepEqual(areaUnderCurve([]), []);
  assert.deepEqual(areaUnderCurve(null), []);
});

// ---- gridLines ----

test('gridLines: vertical and horizontal lines across the plot rect', () => {
  const lines = gridLines(10, 20, 100, 80, [10, 60, 110], [20, 60, 100]);
  assert.equal(lines.length, 6);
  assert.deepEqual(lines[0], { kind: 'line', x1: 10, y1: 20, x2: 10, y2: 100 });
  assert.deepEqual(lines[3], { kind: 'line', x1: 10, y1: 20, x2: 110, y2: 20 });
});

test('gridLines: skips non-numeric ticks; empty yields []', () => {
  const lines = gridLines(0, 0, 10, 10, [5, NaN, 'a'], [3]);
  assert.equal(lines.length, 2);
  assert.deepEqual(gridLines(0, 0, 10, 10, [], []), []);
});

// ---- integration: helper output is spec-valid ----

test('charts helpers compose into a spec that passes validateSpec', () => {
  const pie = pieSectors(480, 270, 200, [30, 70], { fills: ['#315FD6', '#89ABFF'] });
  const bars = barLayout(100, 340, 760, 140, [3, 7, 5]);
  const nl = numberLine(100, 860, 500, 0, 10, 6);
  const area = areaUnderCurve([[100, 400], [300, 300], [500, 380]]);
  const grid = gridLines(100, 340, 760, 140, [100, 480, 860], [340, 480]);
  const steps = [];
  let at = 0;
  let n = 0;
  // The toolkit returns shape bodies; the author assigns ids at show time.
  function withId(shape) {
    return Object.assign({ id: 'sh' + (n++) }, shape);
  }
  for (const s of pie) steps.push({ at_ms: (at += 100), do: 'show', shape: withId(s) });
  for (const b of bars) steps.push({ at_ms: (at += 100), do: 'show', shape: withId(b) });
  steps.push({ at_ms: (at += 100), do: 'show', shape: withId(nl.baseline) });
  for (const tk of nl.ticks) steps.push({ at_ms: (at += 50), do: 'show', shape: withId(tk) });
  for (const lb of nl.labels) steps.push({ at_ms: (at += 50), do: 'show', shape: withId(lb) });
  steps.push({
    at_ms: (at += 100), do: 'show',
    shape: withId({ kind: 'polygon', points: area, fill: '#89ABFF' })
  });
  for (const g of grid) steps.push({ at_ms: (at += 50), do: 'show', shape: withId(g) });
  function scene(id, caption, sceneSteps) {
    return {
      id: id, caption: caption,
      narration: 'A charts-toolkit smoke test scene.',
      duration_ms: 6000, steps: sceneSteps
    };
  }
  const errors = validateSpec({
    animath: '0.1', id: 'charts-smoke', title: 'charts smoke', kind: 'concept',
    topic: 'charts', level: 'secondary', subject: 'math',
    canvas: { width: 960, height: 540 },
    scenes: [scene('s1', 'Charts toolkit smoke test', steps), scene('s2', 'Tail', [
      { at_ms: 0, do: 'show', shape: withId({ kind: 'text', x: 10, y: 30, text: 'done', size: 24 }) }
    ])]
  });
  assert.deepEqual(errors, []);
});
