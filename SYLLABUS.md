# Singapore Syllabus Topic Map

The topic taxonomy for animath's picker and generator prompts, following the
MOE syllabus bands: Primary (PSLE), Secondary (O/N-level), Junior College
(H2). Slugs are stable identifiers used in specs' `topic` field.

## Primary — Mathematics (PSLE)

| slug | topic |
|---|---|
| `whole-numbers` | Whole numbers: place value, four operations |
| `fractions` | Fractions: equivalence, addition/subtraction, of a quantity |
| `decimals` | Decimals: place value, four operations |
| `percentage` | Percentage: of a quantity, increase/decrease |
| `ratio` | Ratio: simplest form, sharing in a ratio |
| `rate-speed` | Rate and speed: distance–time |
| `algebra-intro` | Algebra: letters for unknowns, simple equations |
| `geometry-angles` | Geometry: angles, triangles, quadrilaterals |
| `area-perimeter` | Area and perimeter of composite figures |
| `volume` | Volume of cubes, cuboids, liquids |
| `data-graphs` | Data: pie charts, line graphs |
| `model-method` | Word problems via the bar model method |

## Primary — Science (PSLE)

| slug | topic |
|---|---|
| `human-body-systems` | Human systems: digestive, respiratory, circulatory |
| `plant-systems` | Plant parts and functions |
| `life-cycles` | Life cycles of plants and animals |
| `water-cycle` | The water cycle |
| `energy-forms` | Forms and uses of energy |
| `photosynthesis` | Photosynthesis and respiration (intro) |
| `forces-magnets` | Forces, friction, magnets |
| `adaptations` | Adaptations and man-made environment interactions |

## Secondary — Mathematics

E-Math:

| slug | topic |
|---|---|
| `e-numbers` | Numbers: primes, indices, standard form |
| `e-algebra` | Algebra: expansion, factorisation, formulae |
| `e-functions-graphs` | Functions and graphs |
| `e-geometry` | Geometry: congruence, similarity, circle properties |
| `e-trigonometry` | Trigonometry: ratios, sine/cosine rule |
| `e-mensuration` | Mensuration: arc, sector, pyramids, spheres |
| `e-statistics` | Statistics: mean/median/mode, cumulative frequency |
| `e-probability` | Probability: single and combined events |

A-Math:

| slug | topic |
|---|---|
| `a-quadratic-functions` | Quadratic functions and inequalities |
| `a-binomial` | Binomial theorem |
| `a-trigonometry` | Further trigonometry: identities, R-formulae |
| `a-differentiation` | Differentiation: rules, tangents, rates, max/min |
| `a-integration` | Integration: indefinite/definite, area |
| `a-kinematics` | Kinematics: displacement, velocity, acceleration |

## Secondary — Science

Physics:

| slug | topic |
|---|---|
| `phys-kinematics` | Kinematics: speed, velocity, acceleration, graphs |
| `phys-forces` | Forces: friction, moments, pressure |
| `phys-energy` | Energy: work, power, conservation |
| `phys-electricity` | Electricity: current, circuits, Ohm's law |
| `phys-waves` | Waves: light, sound |

Chemistry:

| slug | topic |
|---|---|
| `chem-atomic` | Atomic structure and the periodic table |
| `chem-bonding` | Chemical bonding: ionic, covalent, metallic |
| `chem-acids` | Acids, bases, salts |
| `chem-mole` | The mole concept and stoichiometry |

Biology:

| slug | topic |
|---|---|
| `bio-cells` | Cells: structure, organisation |
| `bio-transport` | Transport in humans and plants |
| `bio-nutrition` | Nutrition: diet, digestion, photosynthesis |
| `bio-reproduction` | Reproduction in humans and plants |
| `bio-ecology` | Ecology: food webs, cycles |

## Junior College — H2

Mathematics:

| slug | topic |
|---|---|
| `h2-functions-graphs` | Functions and graphs: transformations, asymptotes |
| `h2-sequences` | Sequences and series: AP, GP, summation |
| `h2-vectors` | Vectors: 3D lines and planes |
| `h2-complex` | Complex numbers: Argand diagram, de Moivre |
| `h2-differentiation` | Differentiation: parametric, connected rates |
| `h2-integration` | Integration: techniques, volumes of revolution |
| `h2-probability` | Probability: distributions |
| `h2-statistics` | Statistics: sampling, hypothesis testing |

Physics:

| slug | topic |
|---|---|
| `h2-mechanics` | Mechanics: circular motion, gravitation |
| `h2-em` | Electromagnetism: fields, induction |
| `h2-thermal` | Thermal physics: kinetic theory |
| `h2-quantum` | Quantum physics: photoelectric effect |

Chemistry:

| slug | topic |
|---|---|
| `h2-physical` | Physical chemistry: energetics, kinetics, equilibria |
| `h2-inorganic` | Inorganic chemistry: periodicity, transition metals |
| `h2-organic` | Organic chemistry: mechanisms, synthesis |

Biology:

| slug | topic |
|---|---|
| `h2-cell-bio` | Cell biology and biomolecules |
| `h2-genetics` | Genetics: inheritance, gene expression |
| `h2-energetics` | Energetics: respiration, photosynthesis |
| `h2-ecology` | Ecology and conservation |

## Notes for the generator

- `level` + `subject` on a spec are coarse (`primary|secondary|jc`,
  `math|science`); the `topic` slug carries the precise syllabus point.
- The web UI groups topics by track (E-Math, Physics, …) for usability but
  emits `subject: "math"` or `"science"` per `SPEC.md`.
- New topics: add the slug here first, then teach the prompt builder about any
  level-specific wording. The validator only checks that `topic` is a
  non-empty string.
