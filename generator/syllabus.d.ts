// TypeScript definitions for generator/syllabus.js — the embedded
// syllabus taxonomy and its id resolver (issue #770). Mirrors the shape
// of window.ANIMATH_SYLLABUS in web/syllabus.js.
export interface SyllabusTopic {
  slug: string;
  label: string;
}
export interface SyllabusTrack {
  id: string;
  label: string;
  subject: string;
  topics: SyllabusTopic[];
}
export interface SyllabusLevel {
  id: string;
  label: string;
  tracks: SyllabusTrack[];
}
export interface SyllabusData {
  levels: SyllabusLevel[];
}
export const SYLLABUS: SyllabusData;
export interface ResolvedSyllabusTopic {
  topic: string;
  topicLabel: string;
  level: string;
  subject: string;
  track: string;
}
/**
 * Resolve a bare topic slug ('water-cycle') or the composite
 * level/track/slug form ('primary/p-sci/water-cycle') against data
 * (default SYLLABUS). Throws synchronously on unknown, malformed, or
 * ambiguous ids, naming the raw id verbatim.
 */
export function resolveSyllabusTopic(
  id: string,
  data?: SyllabusData
): ResolvedSyllabusTopic;
