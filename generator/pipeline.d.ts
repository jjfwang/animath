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
