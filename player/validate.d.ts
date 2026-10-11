// TypeScript definitions for player/validate.js — animath spec v0.1 validator.
// Returns an array of error strings; empty array = valid.
export function validateSpec(spec: unknown): string[];
// The admitted subject enum (issue #644, #671); tests derive sample-coverage
// requirements from this rather than hardcoding the list.
export const SUBJECTS: string[];
