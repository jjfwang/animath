// TypeScript definitions for player/validate.js — animath spec v0.1 validator.
// Returns an array of error strings; empty array = valid.
export function validateSpec(spec: unknown): string[];
export function validateSlides(spec: unknown): string[];
export function validateWorksheet(spec: unknown): string[];
export function validateExitTicket(spec: unknown): string[];
export function validateNotes(spec: unknown): string[];
export function validateScript(spec: unknown): string[];
// Syllabus-known subjects; validateSpec accepts any non-empty subject string.
export const SUBJECTS: string[];
