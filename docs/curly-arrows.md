# Curly-arrow convention (h2-organic samples)

Electron-pushing arrows for `h2-organic` samples, drawn as composites of
SPEC.md v0.1 primitives. Every organic mechanism sample draws its curly
arrows with this convention so an electron pair looks like an electron
pair in every animation. New h2-organic samples must use this
convention; do not invent ad-hoc arrows.

## Meaning

- **Double-barbed curly arrow** = one electron PAIR moves from the tail to
  the head. The tail starts exactly at the electron pair being moved (a
  lone pair, a pi bond, a sigma bond) — never in empty space. The head
  points at the atom or bond the pair is going to (the acceptor).
- **Single-barbed (fish-hook) arrow** = one electron moves (radical
  mechanisms). Reserved — no h2-organic sample currently uses it; add a
  note here when the first one does.

## Construction

- The shaft: a `polygon` polyline with **no fill**, 8 points approximating
  a quadratic bezier from P0 (donor pair) through control point P1 to P2
  (acceptor). `stroke: "#c0392b"`, `width: 4`.
- Standard curvature: place the control point so the arc clears every
  atom and label — the arrow must not pass through any atom, bond, or
  text except where it starts and ends. Eight points is the house
  standard (smooth at the stage scale).
- The head: two short `line`s, length 14px, at ±150° to the end tangent
  (the segment from point 7 to point 8), same stroke and width. Two barbs
  = electron pair.
- Color: `#c0392b` is the electron-flow ink across all organic samples.
  Never render curly arrows in the carbon grey (`#2c3e50`) or the
  annotation red would clash with.

## Electron-pair dots (mechanism-first)

A mechanism scene must show the electrons actually travelling, not just
an arrow pointing:

- Dots: two `circle`s, r=5, `fill: "#c0392b"`, shown at the tail offset
  ±8px perpendicular to the start tangent — the visible "pair".
- Movement: staged `move` steps (circle `cx`/`cy` `to` fields) through the
  1/3 and 2/3 polyline waypoints to the head, then a `hide` the moment the
  arrival beat stages in — the pair is consumed into the new bond or ion.
- Rule: atoms never move along the arrow; only the electron-pair dots
  travel. The s7 misconception beat in `samples/jc-h2-organic.json` is the
  worked counterexample: the dot rides the arrow while both Br labels stay
  exactly where they are.

## Worked example

Electrophilic addition of HBr to ethene (`samples/jc-h2-organic.json`
scene s3): arrow 1's tail sits on the pi bond and its head lands on the
δ+ H; the pair dots ride the curve, then hide as the product stages in.
Arrow 2 carries the H–Br pair onto Br− the same way. SN1 (s4) and SN2
(s5) reuse the same composite for the bond-breaking and backside-attack
steps.
