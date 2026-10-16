// TypeScript definitions for player/printable.js - printable worksheet
// and exit-ticket renderer: student sheets and teacher answer keys
// (issue #758), plus student notes and teacher script (issue #766).
export interface Choice {
  text: string;
  correct?: boolean;
  [key: string]: unknown;
}
export interface Question {
  id: string;
  prompt: string;
  kind: string;
  choices?: Choice[];
  answer?: string;
  explanation?: string;
  feedback?: string;
  misconception?: string;
  [key: string]: unknown;
}
export interface WorksheetSpec {
  title: string;
  level: string;
  subject: string;
  topic: string;
  questions: Question[];
  [key: string]: unknown;
}
export interface ExitTicketSpec {
  title: string;
  level: string;
  subject: string;
  topic: string;
  questions: Question[];
  [key: string]: unknown;
}
export interface Definition {
  term: string;
  meaning: string;
  [key: string]: unknown;
}
export interface Trap {
  misconception: string;
  explanation: string;
  [key: string]: unknown;
}
export interface NotesSpec {
  title: string;
  level: string;
  subject: string;
  topic: string;
  instructions?: string;
  objectives: string[];
  definitions: Definition[];
  mechanismSteps: string[];
  workedExample: string;
  trap: Trap;
  [key: string]: unknown;
}
export interface Segment {
  minutes: number;
  say: string;
  cue?: string;
  questions?: string[];
  watchFor?: string;
  [key: string]: unknown;
}
export interface ScriptSpec {
  title: string;
  level: string;
  subject: string;
  topic: string;
  instructions?: string;
  segments: Segment[];
  [key: string]: unknown;
}
export function renderWorksheet(spec: WorksheetSpec): string;
export function renderWorksheetAnswerKey(spec: WorksheetSpec): string;
export function renderExitTicket(spec: ExitTicketSpec): string;
export function renderExitTicketAnswerKey(spec: ExitTicketSpec): string;
export function renderNotes(spec: NotesSpec): string;
export function renderScript(spec: ScriptSpec): string;
export function escapeHtml(s: string): string;
