---
name: Feature
about: A new capability slice, sample pack, or spec/implementation fix.
---

## Objective
What this adds and why it matters.

## Scope
What is in, and explicitly what is out. Zero-dependency, vanilla JS + SVG unless
stated otherwise; SPEC.md is the contract.

## Acceptance
- `node --test "tests/*.test.js"` green before and after; every new/changed JS line covered.
- `node --check` clean on every edited `.js` file.
- New/changed samples pass `player/validate.js` with zero errors.
- Docs (SPEC.md / README.md / CONTRIBUTING.md) updated if the contract or behavior changed.

Refs #1
