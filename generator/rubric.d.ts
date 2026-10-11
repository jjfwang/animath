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
