# Circuit symbol library (electricity samples)

Standard component symbols for `phys-electricity` samples, drawn as
composites of SPEC.md v0.1 primitives on a **40px grid**. Every electricity
sample draws its circuits with these symbols so a battery looks like a
battery in every animation. New electricity samples must use this
convention; do not invent ad-hoc symbols.

## Grid and wires

- Symbols sit on a 40px module. The **slot center** `(cx, cy)` anchors the
  symbol; wires meet the slot's edges along the wire direction.
- Wire: `line`, `stroke: "#1a1a1a"`, `width: 3`.
- Symbol ink: `#1a1a1a`, stroke/line width 3 unless noted (matches the wire
  so symbols read as part of the circuit).
- When a symbol interrupts a wire, draw the wire as two segments that stop
  at the slot edges — never draw a full wire straight through a symbol.
- Conventional current flows from the positive (+) terminal to the negative
  (−) terminal around the loop.

## Symbols

All coordinates are relative to the slot center `(cx, cy)`; mirror
x/y for a vertical wire run.

### cell (single cell)

Two plates perpendicular to the wire, long plate = positive.

- Long plate (+): line 40px long, width 6, at 7px on the positive side of center.
- Short plate (−): line 16px long, width 8, at 7px on the negative side.
- Horizontal wire: long plate `line` from `(cx-7, cy-20)` to `(cx-7, cy+20)`,
  width 6; short plate from `(cx+7, cy-8)` to `(cx+7, cy+8)`, width 8.
- Slot: 14px along the wire. Mark `+`/`−` beside the plates (text, size 24).

### battery

Two cells head-to-tail (long–short–long–short):

- Plates at −21px (long), −7px (short), +7px (long), +21px (short) along the
  wire; long plates 40px × width 6, short plates 16px × width 8.
- Horizontal wire: plates are vertical lines at `cx-21`, `cx-7`, `cx+7`,
  `cx+21` with the lengths above.
- Slot: 42px along the wire. Label `+` at the outer long plate.

### resistor (IEC zigzag)

- `polygon` zigzag, stroke width 3, no fill, 80px run × 24px tall:
  `(cx-40,cy) (cx-30,cy-12) (cx-20,cy+12) (cx-10,cy-12) (cx,cy+12)`
  `(cx+10,cy-12) (cx+20,cy+12) (cx+30,cy-12) (cx+40,cy)`.
- Slot: 80px along the wire. Wire segments stop at `cx±40`.

### bulb

- `circle` r=20 centered on the wire, stroke width 3, fill `"#fff7d6"` when
  lit (white when unlit).
- Filament: X of two lines inset 6px from the circle edge —
  `(cx-14,cy-14)`–`(cx+14,cy+14)` and `(cx-14,cy+14)`–`(cx+14,cy-14)`,
  width 3.
- Slot: 40px along the wire; wire segments stop at `cy±20` (vertical run)
  or `cx±20` (horizontal run).

### switch

- Two terminal dots: filled circles r=4, 40px apart on the wire.
- Open: blade `line` from the left dot to `(cx+14, cy-24)` (blade lifted).
- Closed: blade `line` from the left dot to the right dot.
- Slot: 40px. Use the open state to show a broken circuit.

### ammeter

- `circle` r=20 on the wire, stroke width 3, fill white.
- Letter: `text` "A", size 28, `align: "middle"`, at `(cx, cy+10)`
  (baseline offset centers the glyph vertically).
- Slot: 40px. Always in series — it sits on the wire it measures.

### voltmeter

- Same construction as the ammeter with the letter "V".
- Always across a component (parallel branches to the two sides of the
  component), never in series.

## Current-flow markers (mechanism-first)

A circuit scene must show charge actually moving, not just arrows pointing:

- Markers: `circle` r=7, `fill: "#d33f2f"` (current red).
- At least 4 markers per loop, traveling along the wires via `move` steps
  in the conventional-current direction (+ to − around the loop).
- Chain moves across beats so markers visibly circulate; markers may pass
  through component slots (charge flows through the filament).

## Worked example: simple loop

Loop corners `(170,190)`–`(790,450)`; battery on the left wire at
`cy=320`, bulb on the right wire at `cy=320`, ammeter on the bottom wire
at `cx=480`. See `samples/secondary-science-electricity.json` scenes
s1/s2/s5 for the staged build (wires → battery → bulb → meter → flowing
markers). The series/parallel comparison (s3) reuses the same symbols on
two loops, and the misconception beat (s5) places three ammeters around
one loop to show the reading is identical everywhere.
