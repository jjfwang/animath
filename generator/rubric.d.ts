// TypeScript definitions for generator/rubric.js — spec quality rubric.
export interface RubricDimension {
  name: string;
  score: number;
  max: number;
  notes: string[];
}
export interface RubricScore {
  score: number;
  maxScore: number;
  dimensions: RubricDimension[];
}
export function scoreSpec(spec: Record<string, unknown> | null): RubricScore;
export interface RubricBands {
  MIN_DURATION: number;
  MAX_DURATION: number;
  MAX_GAP: number;
  MAX_CAPTION: number;
  LATEX_BUDGET: number;
  STAGE_MS: number;
}
// Measured-band constants, re-derived live from samples/*.json by
// generator/tooling/measure-rubric-bands.js (issue #663); locked against
// the live corpus by tests/tooling-bands.test.js.
export const bands: RubricBands;
export function textBudget(size: unknown): number;
