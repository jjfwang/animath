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
