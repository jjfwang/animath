// TypeScript definitions for player/validate.js — animath spec v0.1 validator.
// Returns an array of error strings; empty array = valid.
export function validateSpec(spec: unknown): string[];
// Syllabus-known subjects; validateSpec accepts any non-empty subject string.
export const SUBJECTS: string[];
