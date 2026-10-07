/* animath misconception library — per-topic wrong-turn beats for the generator.
 * Slice 1 (issue #101): the 12 Primary Math topics. Each entry is grounded in
 * the matching sample's misconception scene (samples/primary-math-*.json).
 * Slice 2 (issue #103): the 8 Primary Science topics (human-body-systems,
 * plant-systems, life-cycles, water-cycle, energy-forms, photosynthesis,
 * forces-magnets, adaptations), grounded in the matching misconception scenes
 * in samples/primary-science-*.json.
 * Slice 3 (issue #105): the 14 Secondary Math topics, grounded in the
 * matching misconception scenes in samples/secondary-e-*.json and
 * samples/secondary-a-*.json.
 * Slice 4 (issue #107): the 14 Secondary Science topics (bio-cells,
 * bio-ecology, bio-nutrition, bio-reproduction, bio-transport, chem-acids,
 * chem-atomic, chem-bonding, chem-mole, phys-electricity, phys-energy,
 * phys-forces, phys-kinematics, phys-waves), grounded in the matching
 * misconception/myth scenes in samples/secondary-science-*.json,
 * samples/secondary-physics-*.json and
 * samples/secondary-science-electricity.json.
 * Slice 5 (issue #109): the 19 H2 (JC) topics (h2-functions-graphs,
 * h2-sequences, h2-vectors, h2-complex, h2-differentiation, h2-integration,
 * h2-probability, h2-statistics, h2-mechanics, h2-em, h2-thermal,
 * h2-quantum, h2-physical, h2-inorganic, h2-organic, h2-cell-bio,
 * h2-genetics, h2-energetics, h2-ecology), grounded in the matching
 * misconception scenes in samples/jc-h2-*.json. jc-h2-organic.json carries
 * no misconception beat, so its entry uses the canonical H2 organic
 * misconception (curly arrows drawn against the electron flow),
 * cross-checked against the sample's mechanism scenes.
 *
 * Prefix note (slices 3-5): no key in the map is a prefix of another key,
 * so the longest-prefix ordering inside misconceptionFor() cannot be
 * shadowed — e.g. 'phys-energy' and 'energy-forms' coexist safely, no
 * slice-4 key prefixes any slice 1-3 key, and no h2- key prefixes any
 * other h2- key ('h2-em' and 'h2-energetics' are distinct keys).
 *
 * Slug naming note: the map is keyed on the short topic slugs that
 * buildPrompts receives (the issue's slugs), which match the samples' topic
 * fields exactly: *   decimals-place-value.json -> topic "decimals"  (key: decimals)
 *   fractions-addition.json   -> topic "fractions" (key: fractions)
 *   percentage-of-quantity.json -> topic "percentage" (key: percentage)
 *   ratio-sharing.json        -> topic "ratio"     (key: ratio)
 *   photosynthesis-intro.json -> topic "photosynthesis" (key: photosynthesis)
 *   jc-h2-em.json             -> topic "h2-em"    (key: h2-em)
 * Callers sometimes pass the longer file-style slug (e.g. "fractions-addition"
 * or "percentage-of-quantity"); misconceptionFor() in build_prompt.js also
 * tries the longest matching key prefix so those still resolve.
 * Run-105-class trap (documented, not a code change): the file-style JC
 * slugs "jc-h2-*" (with the "jc-" file prefix) do NOT resolve — the lookup
 * is key-prefix only, so a caller passing "jc-h2-em" falls to the generic
 * line. Callers pass the topic field, which matches the short "h2-*" slugs,
 * so this is expected.
 *
 * Facet sub-entries (issue #367): an entry may be faceted when its syllabus
 * topic spans multiple facets (e.g. bio-nutrition covers digestion and
 * photosynthesis). A faceted entry carries `primary` (the facet bare-topic
 * lookups resolve to, preserving pre-facet behavior) and `facets`, a map of
 * facet name -> {wrongTurn, why, correctTurn}. misconceptionFor() in
 * build_prompt.js takes an optional facet hint; unknown hints fall back to
 * the primary facet. Entries without `facets` behave exactly as before.
 *
 * Works in browser and Node.
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; /* node:coverage ignore next */
  else global.AnimathMisconceptions = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Each entry: the wrong turn students take, why they slip, and the correct
  // turn the animation should show. Plain strings only (ASCII).
  var MISCONCEPTIONS = {
    'whole-numbers': {
      wrongTurn: 'Reading 5 0 6 7 as 567, skipping the zero.',
      why: 'Learners read the digits left to right and drop the 0, losing the hundreds place.',
      correctTurn: 'Zero holds its place: 5 0 6 7 is five thousand and sixty-seven, with the 0 keeping the hundreds empty.'
    },
    'fractions': {
      wrongTurn: 'Adding tops and bottoms: 1/2 + 1/4 = 2/6.',
      why: 'The bottom number names the piece size, so it cannot be added like the tops.',
      correctTurn: 'The bottom number stays 4 because the piece size never changed: 1/2 + 1/4 = 2/4 + 1/4 = 3/4.'
    },
    'decimals': {
      wrongTurn: 'Comparing decimals by digit count: 0.25 looks bigger than 0.4 because 25 > 4.',
      why: 'Longer digit strings feel larger, but place value decides, not digit count.',
      correctTurn: 'Match the place values first: 0.4 is 0.40, then tenths under tenths and hundredths under hundredths.'
    },
    'percentage': {
      wrongTurn: '25% of 60 is just 25.',
      why: 'The 25 is read as a raw count instead of 25 out of 100.',
      correctTurn: 'Percent means per hundred, and the whole here is 60: 25% of 60 is a quarter of 60, which is 15.'
    },
    'ratio': {
      wrongTurn: 'A ratio of 3:2 means 3/2 of the whole.',
      why: 'The ratio parts are mistaken for a fraction of the whole.',
      correctTurn: 'The whole is 5 parts, so 3 parts is 3 fifths of the whole.'
    },
    'rate-speed': {
      wrongTurn: '60 km/h means the bus has travelled 60 km.',
      why: 'A rate is read as a total instead of an amount per unit of time.',
      correctTurn: 'Speed is distance per hour: after half an hour at 60 km/h the bus has gone 30 km, not 60.'
    },
    'algebra-intro': {
      wrongTurn: 'Treating x as a label for things, so 3x + 2x cannot be combined.',
      why: 'Letters are first met as labels, so x feels like a name tag rather than a number.',
      correctTurn: 'x stands for a number: 3x + 2x is 5x, like 3 mystery boxes plus 2 mystery boxes.'
    },
    'geometry-angles': {
      wrongTurn: 'The angle with longer arms is bigger.',
      why: 'Longer arms look more impressive, and size is judged by the drawing rather than the turn.',
      correctTurn: 'An angle measures the turn between the arms: same turn, same angle, whatever the arm lengths.'
    },
    'area-perimeter': {
      wrongTurn: 'The area of the L-shape is the length times the width of its bounding box.',
      why: 'The eye completes the L into a rectangle and measures the imaginary corner.',
      correctTurn: 'The empty corner of the L was never filled, so it adds no area; count only what is there.'
    },
    'volume': {
      wrongTurn: 'The taller container holds more.',
      why: 'Height dominates the eye, so taller looks like more.',
      correctTurn: 'Count the unit cubes: six cubes is six cubes; shape never changes the amount.'
    },
    'data-graphs': {
      wrongTurn: 'A steeper line always means a bigger increase.',
      why: 'Steepness is judged by the drawing rather than the axis scale behind it.',
      correctTurn: 'Slope depends on the axis scale: two graphs can have the same rise but look different.'
    },
    'model-method': {
      wrongTurn: 'Drawing unit boxes in any lengths, guessing the sizes.',
      why: 'The bar is treated as a rough sketch rather than a scale model.',
      correctTurn: 'Every unit box must be exactly the same length: two units is exactly twice one unit.'
    },
    'human-body-systems': {
      wrongTurn: 'The heart uses up the blood it pumps, so the body must keep making fresh blood.',
      why: 'A pump feels like it burns fuel, so the blood seems to disappear as it travels.',
      correctTurn: 'Blood is never used up: it keeps going round in a loop, coming back to the heart to be pushed around again.'
    },
    'plant-systems': {
      wrongTurn: 'Plants take food from the soil through their roots, like we eat food.',
      why: 'We eat through our mouths, so the roots look like a mouth for the plant.',
      correctTurn: 'Roots drink water and minerals; the leaves make the food with sunlight. The plant does not eat food like we do.'
    },
    'life-cycles': {
      wrongTurn: 'The flower is the end of the life of the plant.',
      why: 'The flower is the biggest, showiest and last part to appear, so it looks like the finish.',
      correctTurn: 'The flower is not the end: inside the flower new seeds are forming, and the cycle starts again.'
    },
    'water-cycle': {
      wrongTurn: 'Water disappears for good once it evaporates.',
      why: 'The water turns invisible as vapour, so it looks like it has gone away.',
      correctTurn: 'It is still there as invisible vapour; cooled into clouds it falls back as rain and returns to the sea.'
    },
    'energy-forms': {
      wrongTurn: 'Energy is used up, like fuel disappearing from a tank.',
      why: 'A lamp or a toy runs out, so the energy feels consumed.',
      correctTurn: 'Energy is never used up: it changes form and moves somewhere else.'
    },
    'photosynthesis': {
      wrongTurn: 'Only animals breathe; plants do not.',
      why: 'Plants have no nose and no moving chest, so breathing is never seen.',
      correctTurn: 'Plants take in and give out gases too: they respire all the time, day and night, just like us.'
    },
    'forces-magnets': {
      wrongTurn: 'A magnet attracts every kind of metal.',
      why: 'Magnets grab some metals so strongly that they feel like they grab all of them.',
      correctTurn: 'Magnets ignore most things: they only pull iron and a few metals.'
    },
    'adaptations': {
      wrongTurn: 'An animal can decide to grow a new feature when it needs one.',
      why: 'The feature fits the animal so well that it looks chosen on purpose.',
      correctTurn: 'These features did not appear overnight: they developed over many, many generations, not by choice.'
    },
    'e-numbers': {
      wrongTurn: 'Adding powers: 2^3 + 2^4 = 2^7.',
      why: 'The same-base index rule is for multiplying, but it gets misapplied to addition.',
      correctTurn: 'The index rule is for multiplying, never adding: 8 + 16 = 24, not 128.'
    },
    'e-algebra': {
      wrongTurn: '(a + b)^2 = a^2 + b^2.',
      why: 'The power looks like it lands on each term of the sum.',
      correctTurn: 'The full expansion has three terms: check a = 2, b = 3, and 25 is not 13.'
    },
    'e-functions-graphs': {
      wrongTurn: 'The line with the bigger intercept is steeper.',
      why: 'The intercept is the visible height, so it feels like the climb.',
      correctTurn: 'Steepness is the gradient, not the intercept: compare m, never c.'
    },
    'e-geometry': {
      wrongTurn: 'Two shapes with the same area are congruent.',
      why: 'Equal measure feels like equal shape.',
      correctTurn: 'Equal area says nothing about shape: congruence needs every matching side and angle.'
    },
    'e-trigonometry': {
      wrongTurn: 'tan = adjacent / opposite.',
      why: 'Opposite and adjacent swap places under pressure.',
      correctTurn: 'Always read TOA: tan is opposite over adjacent.'
    },
    'e-mensuration': {
      wrongTurn: 'Doubling the radius doubles the area of a circle.',
      why: 'Doubling a length doubles lengths, so area feels like it doubles too.',
      correctTurn: 'Area scales with the square of the radius: double the radius and the area quadruples.'
    },
    'e-statistics': {
      wrongTurn: 'The mean always describes the typical score.',
      why: 'One extreme score drags the mean away from the bulk of the data.',
      correctTurn: 'The mean follows the outlier, the median resists it: report both when an outlier is present.'
    },
    'e-probability': {
      wrongTurn: 'After three heads, tails is due.',
      why: 'A streak feels like it must balance out.',
      correctTurn: 'The coin has no memory: the next toss is still 1/2.'
    },
    'a-quadratic-functions': {
      wrongTurn: 'A negative discriminant means the equation has no solution.',
      why: 'No real roots is read as no solutions at all.',
      correctTurn: 'No real roots is not no solution: the equation still has two complex roots.'
    },
    'a-binomial': {
      wrongTurn: '(a + b)^2 = a^2 + b^2.',
      why: 'The power is distributed over the sum and the middle term is dropped.',
      correctTurn: 'The missing middle term 2ab is the whole trap: (1 + 2)^2 is 9, not 5.'
    },
    'a-trigonometry': {
      wrongTurn: 'cos(A + B) = cos A + cos B.',
      why: 'Cosine looks like it splits across the sum.',
      correctTurn: 'Use cos A cos B - sin A sin B: cos 60 is 0.5 but cos 30 + cos 30 is about 1.73.'
    },
    'a-differentiation': {
      wrongTurn: 'dy/dx = 0 means a maximum or minimum.',
      why: 'Zero gradient is always tied to turning points.',
      correctTurn: 'Stationary is not always max or min: check the sign change. y = x^3 at x = 0 is stationary and still climbing.'
    },
    'a-integration': {
      wrongTurn: 'The integral of 2x is x^2.',
      why: 'The constant term is forgotten.',
      correctTurn: 'Never drop the +C: differentiating x^2 + 5 and x^2 + 7 both give 2x.'
    },
    'a-kinematics': {
      wrongTurn: 'A straight s-t graph means constant acceleration.',
      why: 'Straight-line growth reads as speeding up.',
      correctTurn: 'The gradient of s-t is velocity: a straight s-t graph has constant velocity and zero acceleration.'
    },
    'bio-cells': {
      wrongTurn: 'The cell membrane is a solid wall that blocks everything from entering or leaving.',
      why: 'A wall feels like protection, so the membrane is read as a barrier that stops everything.',
      correctTurn: 'The membrane is selectively permeable: it lets some things through and keeps others out.'
    },
    'bio-ecology': {
      wrongTurn: 'Energy is recycled around the food chain like nutrients are.',
      why: 'The "cycle of life" language makes energy sound like something that loops round forever.',
      correctTurn: 'Energy is not recycled: only about a tenth passes to the next level, the rest is lost as heat.'
    },
    'bio-nutrition': {
      // Faceted entry (issue #367, decided option A of #360): the SYLLABUS.md
      // label "Nutrition: diet, digestion, photosynthesis" spans facets.
      // `primary` names the facet bare-topic lookups resolve to, preserving
      // the pre-facet behavior; callers may pass a facet hint to reach a
      // non-primary facet (e.g. the photosynthesis sample).
      primary: 'digestion',
      facets: {
        digestion: {
          wrongTurn: 'Digestion finishes in the stomach.',
          why: 'The stomach gets all the attention, so it feels like the last stop.',
          correctTurn: 'Digestion does not end in the stomach: it continues in the small intestine, where most absorption happens.'
        },
        photosynthesis: {
          wrongTurn: 'The oxygen released in photosynthesis comes from carbon dioxide.',
          why: 'Carbon dioxide goes in and oxygen comes out, so the oxygen looks like it comes from the CO2.',
          correctTurn: 'The released oxygen comes from water: splitting water gives the oxygen, while carbon dioxide supplies the carbon for glucose.'
        }
      }
    },
    'bio-reproduction': {
      wrongTurn: 'Pollination is fertilisation.',
      why: 'The two words appear together in every story about flowers, so they merge into one event.',
      correctTurn: 'Pollination is delivery: the male gamete must still fuse with the ovule for fertilisation.'
    },
    'bio-transport': {
      wrongTurn: 'Arteries always carry oxygenated blood.',
      why: 'Arteries are drawn in red and carry blood away from the heart, so they feel like the oxygen pipe.',
      correctTurn: 'The pulmonary artery is the exception: it carries deoxygenated blood from the heart to the lungs.'
    },
    'chem-acids': {
      wrongTurn: 'All acids are strong acids.',
      why: 'Acid sounds dangerous, so every acid is treated like it fully burns through everything.',
      correctTurn: 'Weak acids only partly release their hydrogen ions: vinegar is still acidic, just not strong.'
    },
    'chem-atomic': {
      wrongTurn: 'Atoms are solid balls.',
      why: 'The ball-and-stick model is everywhere, so atoms look like tiny solid marbles.',
      correctTurn: 'Atoms are mostly empty space: the electrons sit far from a tiny dense nucleus.'
    },
    'chem-bonding': {
      wrongTurn: 'Table salt is made of NaCl molecules.',
      why: 'The formula NaCl looks like one joined unit, like the formulas of real molecules.',
      correctTurn: 'Salt is a giant ionic lattice: NaCl just gives the ratio, there are no separate NaCl molecules.'
    },
    'chem-mole': {
      wrongTurn: 'One mole of anything weighs the same.',
      why: 'A mole feels like a fixed bag of the same size, so every mole feels equally heavy.',
      correctTurn: 'Mass = moles x molar mass: one mole of hydrogen is 1 g but one mole of oxygen is 16 g.'
    },
    'phys-electricity': {
      wrongTurn: 'The bulb uses up the current.',
      why: 'The bulb glows and gets hot, so it looks like it consumes the electricity flowing through it.',
      correctTurn: 'Current is not used up: an ammeter reads the same 0.5 amps on both sides of the bulb.'
    },
    'phys-energy': {
      wrongTurn: 'Energy gets used up when work is done.',
      why: 'The car runs out of petrol and stops, so the energy feels destroyed.',
      correctTurn: 'Energy is never used up: it changes form, like chemical energy becoming kinetic energy plus heat.'
    },
    'phys-forces': {
      wrongTurn: 'The same push gives the same pressure whether you stand flat or on tiptoes.',
      why: 'The push feels the same, so the effect on the ground feels like it should be the same.',
      correctTurn: 'Pressure is force over area: tiptoes spread the same force over a smaller area, so the pressure is higher.'
    },
    'phys-kinematics': {
      wrongTurn: 'A flat line on a velocity-time graph means the object has stopped.',
      why: 'Flat reads as "nothing is happening", so the line feels like zero movement.',
      correctTurn: 'A flat v-t line means constant velocity: the object keeps moving at the same speed.'
    },
    'phys-waves': {
      wrongTurn: 'Sound travels faster than light.',
      why: 'A thunderclap feels so powerful that it seems to arrive before the flash.',
      correctTurn: 'Light is far faster: the lightning flash arrives first and the thunder follows.'
    },
    'h2-functions-graphs': {
      wrongTurn: 'f(x + 3) shifts the graph 3 units to the right.',
      why: 'Plus looks like a move to the right, but the shift undoes the change to x.',
      correctTurn: 'Inside the brackets means shift LEFT: f(x + 3) is zero where x = -3, to the left of the original.'
    },
    'h2-sequences': {
      wrongTurn: 'u_10 needs ten jumps of d, so u_n = u_1 + n*d.',
      why: 'The n feels like the number of jumps, but the first jump lands on u_2, not u_1.',
      correctTurn: 'Exponents count the jumps, not the terms: u_10 = u_1 + 9d, and a geometric sum counts every term, not the last term times n.'
    },
    'h2-vectors': {
      wrongTurn: 'Moving a vector to a new start point changes it.',
      why: 'Position vectors are pinned to the origin, so every vector feels pinned.',
      correctTurn: 'Free vectors slide: the same arrow drawn anywhere is the same vector. Only position vectors are pinned to the origin.'
    },
    'h2-complex': {
      wrongTurn: 'If arg(z) = 100 degrees then arg(z^3) = 300 degrees.',
      why: 'Multiplying the angle can overshoot 180 degrees, which breaks the principal range.',
      correctTurn: 'Angles wrap around: the principal Arg must land in -180 to 180 degrees, so arg(z^3) = -60 degrees.'
    },
    'h2-differentiation': {
      wrongTurn: 'Cancelling the d symbols in dy/dx.',
      why: 'dy/dx looks like a fraction, so the d symbols look like they can cancel.',
      correctTurn: 'dy/dx is one symbol for a limit, not a fraction: cancelling the d symbols breaks the mathematics.'
    },
    'h2-integration': {
      wrongTurn: 'A definite integral still needs the +C in the answer.',
      why: 'The habit of writing +C carries over from indefinite integrals.',
      correctTurn: 'Only indefinite integrals need +C: it cancels at the two limits, so from 1 to 2 the answer is simply 7/3.'
    },
    'h2-probability': {
      wrongTurn: 'After five heads in a row, tails is due.',
      why: 'A long run feels like it must balance out.',
      correctTurn: 'The coin never remembers: after five heads the next toss is still 1/2.'
    },
    'h2-statistics': {
      wrongTurn: 'A p-value of 0.03 means there is a 3% chance the null hypothesis is true.',
      why: 'The p-value is read as a probability about the hypothesis itself.',
      correctTurn: 'The p-value is about the data given the null: if H0 were true, 3% of experiments would give data this extreme.'
    },
    'h2-mechanics': {
      wrongTurn: 'A centrifugal force flings you outward in a sharp turn.',
      why: 'Being thrown sideways feels like an outward push.',
      correctTurn: 'No outward fling exists: your body wants to keep going straight while the seat pushes you inward - the inward push is the real force.'
    },
    'h2-em': {
      wrongTurn: 'An emf flows as long as the magnet sits inside the coil.',
      why: 'The flux looks large inside the coil, so voltage feels like it should be there.',
      correctTurn: 'No change in flux, no emf: the magnet sitting still gives zero - only motion makes the meter kick.'
    },
    'h2-thermal': {
      wrongTurn: 'In a hotter gas every molecule moves faster.',
      why: 'Hotter means faster, so every molecule feels faster.',
      correctTurn: 'Hotter means a higher average: the whole spread of speeds shifts up, but some molecules still crawl.'
    },
    'h2-quantum': {
      wrongTurn: 'Brighter light ejects faster electrons.',
      why: 'Brightness feels like strength, so more light looks like harder hits.',
      correctTurn: 'Brightness means more photons, not stronger ones: a dim violet beam ejects faster electrons than a bright red one.'
    },
    'h2-physical': {
      wrongTurn: 'A catalyst pushes the equilibrium toward the products.',
      why: 'A faster forward reaction looks like the products are winning.',
      correctTurn: 'A catalyst speeds the forward and reverse reactions equally: the position of equilibrium is unchanged.'
    },
    'h2-inorganic': {
      wrongTurn: 'Zinc is a transition metal because it sits in the d-block.',
      why: 'The d-block label reads as the definition of a transition metal.',
      correctTurn: 'Zinc(II) has a full 3d subshell: no partially filled d orbitals, so zinc is not a transition metal.'
    },
    'h2-organic': {
      wrongTurn: 'Curly arrows point from the electron-poor atom toward the electron-rich one.',
      why: 'The arrow is read like a direction pointer instead of tracking the electrons themselves.',
      correctTurn: 'Curly arrows follow the electrons: they start at an electron-rich region (a lone pair or pi bond) and point to where the electrons go.'
    },
    'h2-cell-bio': {
      wrongTurn: 'Plant cells have no mitochondria.',
      why: 'Mitochondria feel like animal-cell equipment, and the chloroplast looks like the plant replacement.',
      correctTurn: 'Plant cells respire too, day and night: they have mitochondria as well - only the chloroplast is plant-only.'
    },
    'h2-genetics': {
      wrongTurn: 'Every mutation harms the organism.',
      why: 'Mutation sounds like damage.',
      correctTurn: 'Most mutations are neutral: only some are harmful, and a rare few are the raw material of evolution.'
    },
    'h2-energetics': {
      wrongTurn: 'Plants only respire at night.',
      why: 'During the day photosynthesis dominates, so respiration looks switched off.',
      correctTurn: 'Plants respire around the clock: at night there is simply no photosynthesis to hide it.'
    },
    'h2-ecology': {
      wrongTurn: 'Energy is recycled through the ecosystem.',
      why: 'The "cycle of life" language makes energy sound like it loops round forever.',
      correctTurn: 'Energy flows one way - sunlight in, heat out: what is recycled is matter - carbon, nitrogen and water.'
    }
  };

  return {
    MISCONCEPTIONS: MISCONCEPTIONS
  };
});
