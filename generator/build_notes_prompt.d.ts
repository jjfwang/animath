// TypeScript definitions for generator/build_notes_prompt.js - animath student notes prompt builder.
export interface NotesMisconceptionBeat {
  wrongTurn: string;
  why: string;
  correctTurn: string;
}
export interface NotesTransition {
  name: string;
  from_state: string;
  to_state: string;
  driver: string;
  misconception?: NotesMisconceptionBeat;
}
export interface NotesPromptOptions {
  level?: string;
  subject: string;
  topic?: string;
  topicLabel?: string;
  focus?: string;
  facet?: string;
  transitions?: NotesTransition[];
  misconceptions?: NotesMisconceptionBeat[];
  workedExample?: string;
}
export interface NotesPrompts {
  system: string;
  user: string;
}
export function buildNotesPrompts(opts: NotesPromptOptions): NotesPrompts;
export const NOTES_SYSTEM_TEMPLATE: string;
// Trimmed water-cycle gold notes (issue #764): compact JSON string of
// the hand-authored samples/notes/primary-science-water-cycle.json.
export const WATER_CYCLE_NOTES_EXEMPLAR: string;
