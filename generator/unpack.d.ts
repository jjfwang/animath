// TypeScript definitions for generator/unpack.js — animath topic unpack layer.
export interface UnpackTransition {
  name: string;
  from_state: string;
  to_state: string;
  driver: string;
}
export interface UnpackPromptOptions {
  level?: string;
  subject: string;
}
export interface UnpackPrompts {
  system: string;
  user: string;
}
export function buildUnpackPrompts(
  topic: string,
  opts: UnpackPromptOptions
): UnpackPrompts;
export function parseTransitions(text: string): UnpackTransition[];
export function unpackTopic(
  topic: string,
  opts: UnpackPromptOptions,
  llmCall: (prompts: UnpackPrompts) => Promise<string> | string
): Promise<UnpackTransition[]>;
export const UNPACK_SYSTEM_TEMPLATE: string;
export const UNPACK_USER_TEMPLATE: string;
