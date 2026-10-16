// TypeScript definitions for generator/pipeline.js — the automatic
// unpack -> author -> repair generate pipeline (issue #693). Model-agnostic:
// all LLM traffic goes through the caller-supplied deps.callChat.
export interface PipelineTransition {
  name: string;
  from_state: string;
  to_state: string;
  driver: string;
}
export interface GenerateAnimationOptions {
  topic: string;
  topicLabel?: string;
  level?: string;
  subject: string;
  kind?: string;
  focus?: string;
  facet?: string | null;
  /** Number of repair turns after the first attempt. Default 3; 0 disables repair. */
  maxRepairs?: number;
}
export type PipelineCallChat = (system: string, user: string) => Promise<string>;
export type PipelineValidate = (
  spec: Record<string, unknown>
) => string[] | Promise<string[]>;
/** Progress stages: 'unpack' and 'author' report (1, 1); 'repair' reports (attemptNumber, maxRepairs). */
export type PipelineProgress = (
  stage: 'unpack' | 'author' | 'repair',
  n: number,
  max: number
) => void;
export interface GenerateAnimationDeps {
  callChat: PipelineCallChat;
  validate: PipelineValidate;
  onProgress?: PipelineProgress;
}
// The parsed animath animation spec that validated clean.
export type AnimathSpecDocument = Record<string, unknown>;
export function generateAnimation(
  opts: GenerateAnimationOptions,
  deps: GenerateAnimationDeps
): Promise<AnimathSpecDocument>;
// generateSlides options (issue #747): the GenerateAnimationOptions fields
// minus kind/focus/facet, plus an optional worked example handed to the
// slide prompt builder.
export interface GenerateSlidesOptions {
  topic: string;
  topicLabel?: string;
  level?: string;
  subject: string;
  /** Optional worked example for this topic, adapted by the author prompt. */
  workedExample?: string;
  /** Number of repair turns after the first attempt. Default 3; 0 disables repair. */
  maxRepairs?: number;
}
export interface GenerateSlidesDeps {
  callChat: PipelineCallChat;
  /** Slide-deck validator; defaults to the built-in validateSlides when omitted. */
  validateSlides?: PipelineValidate;
  /** Fallback validator, used when validateSlides is not supplied. */
  validate?: PipelineValidate;
  onProgress?: PipelineProgress;
}
// The parsed animath slide deck that validated clean.
export type SlideDeckDocument = Record<string, unknown>;
export function generateSlides(
  opts: GenerateSlidesOptions,
  deps: GenerateSlidesDeps
): Promise<SlideDeckDocument>;
// generateWorksheet options (issue #760): the GenerateSlidesOptions shape
// — topic, optional topicLabel/level, subject, and an optional worked
// example handed to the worksheet prompt builder.
export interface GenerateWorksheetOptions {
  topic: string;
  topicLabel?: string;
  level?: string;
  subject: string;
  /** Optional worked example for this topic, adapted by the author prompt. */
  workedExample?: string;
  /** Number of repair turns after the first attempt. Default 3; 0 disables repair. */
  maxRepairs?: number;
}
export interface GenerateWorksheetDeps {
  callChat: PipelineCallChat;
  /** Worksheet validator; defaults to the built-in validateWorksheet when omitted. */
  validateWorksheet?: PipelineValidate;
  /** Fallback validator, used when validateWorksheet is not supplied. */
  validate?: PipelineValidate;
  onProgress?: PipelineProgress;
}
// The parsed animath worksheet that validated clean.
export type WorksheetDocument = Record<string, unknown>;
export function generateWorksheet(
  opts: GenerateWorksheetOptions,
  deps: GenerateWorksheetDeps
): Promise<WorksheetDocument>;
// generateExitTicket options (issue #760): the GenerateSlidesOptions shape
// — topic, optional topicLabel/level, subject, and an optional worked
// example handed to the exit-ticket prompt builder.
export interface GenerateExitTicketOptions {
  topic: string;
  topicLabel?: string;
  level?: string;
  subject: string;
  /** Optional worked example for this topic, adapted by the author prompt. */
  workedExample?: string;
  /** Number of repair turns after the first attempt. Default 3; 0 disables repair. */
  maxRepairs?: number;
}
export interface GenerateExitTicketDeps {
  callChat: PipelineCallChat;
  /** Exit-ticket validator; defaults to the built-in validateExitTicket when omitted. */
  validateExitTicket?: PipelineValidate;
  /** Fallback validator, used when validateExitTicket is not supplied. */
  validate?: PipelineValidate;
  onProgress?: PipelineProgress;
}
// The parsed animath exit ticket that validated clean.
export type ExitTicketDocument = Record<string, unknown>;
export function generateExitTicket(
  opts: GenerateExitTicketOptions,
  deps: GenerateExitTicketDeps
): Promise<ExitTicketDocument>;

// generateNotes options (issue #768): the GenerateSlidesOptions shape
// — topic, optional topicLabel/level, subject, and an optional worked
// example handed to the notes prompt builder.
export interface GenerateNotesOptions {
  topic: string;
  topicLabel?: string;
  level?: string;
  subject: string;
  /** Optional worked example for this topic, adapted by the author prompt. */
  workedExample?: string;
  /** Number of repair turns after the first attempt. Default 3; 0 disables repair. */
  maxRepairs?: number;
}
export interface GenerateNotesDeps {
  callChat: PipelineCallChat;
  /** Student-notes validator; defaults to the built-in validateNotes when omitted. */
  validateNotes?: PipelineValidate;
  /** Fallback validator, used when validateNotes is not supplied. */
  validate?: PipelineValidate;
  onProgress?: PipelineProgress;
}
// The parsed animath student notes that validated clean.
export type NotesDocument = Record<string, unknown>;
export function generateNotes(
  opts: GenerateNotesOptions,
  deps: GenerateNotesDeps
): Promise<NotesDocument>;
// generateScript options (issue #768): the GenerateSlidesOptions shape
// — topic, optional topicLabel/level, subject, and an optional worked
// example handed to the script prompt builder.
export interface GenerateScriptOptions {
  topic: string;
  topicLabel?: string;
  level?: string;
  subject: string;
  /** Optional worked example for this topic, adapted by the author prompt. */
  workedExample?: string;
  /** Number of repair turns after the first attempt. Default 3; 0 disables repair. */
  maxRepairs?: number;
}
export interface GenerateScriptDeps {
  callChat: PipelineCallChat;
  /** Teacher-script validator; defaults to the built-in validateScript when omitted. */
  validateScript?: PipelineValidate;
  /** Fallback validator, used when validateScript is not supplied. */
  validate?: PipelineValidate;
  onProgress?: PipelineProgress;
}
// The parsed animath teacher script that validated clean.
export type ScriptDocument = Record<string, unknown>;
export function generateScript(
  opts: GenerateScriptOptions,
  deps: GenerateScriptDeps
): Promise<ScriptDocument>;
// generateLessonPack (issue #768): one shared unpack authors all six
// materials; packs are cached in memory by topic slug.
export interface GenerateLessonPackOptions {
  topic: string;
  topicLabel?: string;
  level?: string;
  subject: string;
  kind?: string;
  focus?: string;
  facet?: string | null;
  /** Optional worked example handed to the material prompt builders. */
  workedExample?: string;
  /** Number of repair turns after the first attempt. Default 3; 0 disables repair. */
  maxRepairs?: number;
  /** Bypass the in-memory pack cache and regenerate, replacing the cached entry. */
  force?: boolean;
}
export interface GenerateLessonPackDeps {
  callChat: PipelineCallChat;
  validate?: PipelineValidate;
  validateSlides?: PipelineValidate;
  validateWorksheet?: PipelineValidate;
  validateNotes?: PipelineValidate;
  validateExitTicket?: PipelineValidate;
  validateScript?: PipelineValidate;
  onProgress?: PipelineProgress;
}
export interface LessonPackManifest {
  slug: string;
  topic: string;
  level?: string;
  subject: string;
  version: string;
  materials: string[];
}
export interface LessonPackResult {
  manifest: LessonPackManifest;
  animation: AnimathSpecDocument;
  slides: SlideDeckDocument;
  worksheet: WorksheetDocument;
  notes: NotesDocument;
  exitTicket: ExitTicketDocument;
  script: ScriptDocument;
}
export function generateLessonPack(
  opts: GenerateLessonPackOptions,
  deps: GenerateLessonPackDeps
): Promise<LessonPackResult>;
/** Clear the in-memory lesson-pack cache (issue #768). */
export function clearPackCache(): void;
