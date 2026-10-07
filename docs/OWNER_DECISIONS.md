# Owner decisions

Decisions the owner delegated to Laowang under the standing delegation
(2026-09-28): when work stalls on an owner decision, decide by best practice,
record dated rationale through the issue-to-PR flow, keep it reversible, never
touch money/spend/provisioning. The owner can overturn any of these.

## OD-animath-1 (2026-10-07): compound-topic misconception schema

- Context: issue #360 (proposal). Syllabus topic `bio-nutrition` spans diet,
  digestion, and photosynthesis, but its misconception entry was
  digestion-only, so generating a photosynthesis animation injected
  off-topic digestion guidance, and the photosynthesis sample could never
  receive a content-fitting marker beat (stuck at 100/120).
- Options: A — facet sub-entries; B — sibling topic slugs (67 becomes 68);
  C — accept the cap at 100/120.
- Decision: **A — facet sub-entries.** B distorts the syllabus taxonomy to fix
  a modeling problem (and deliberately breaks the PR 154 regression test);
  C leaves the real wrong-guidance defect in place. A fixes the actual
  compound-topic modeling defect, keeps the 67-topic taxonomy intact, is
  backward-compatible (bare-topic lookups resolve the primary facet), and is
  reversible (additive schema change).
- Implemented: issue #367 / PR #368. Revisit if the owner prefers B or C.
