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
// A transition carrying the bank's wrong-turn beat for the scene where it
// plays out (issue #695): only the transition named by the entry's
// `transition` field gains `misconception`; the rest keep the plain shape.
export interface MisconceivedTransition extends UnpackTransition {
  misconception?: {
    wrongTurn: string;
    why: string;
    correctTurn: string;
  };
}
// Attaches the misconception beat to the named transition; returns a new
// array and never mutates the input. No entry or no matching transition
// name -> the input array is returned unchanged.
export function attachMisconceptions(
  transitions: UnpackTransition[],
  topicSlug: string
): MisconceivedTransition[];
// Full unpack parse: accepts the object form {shape, transitions} or the
// legacy bare array (staged as 'sequence'). Throws a descriptive Error on
// malformed input (issue #701).
export interface UnpackResponse {
  shape: string;
  transitions: UnpackTransition[];
}
export function parseUnpackResponse(text: string): UnpackResponse;
// The recognized animation shapes (issue #698): 'sequence', 'cycle', 'system'.
export const SHAPES: string[];
export const UNPACK_SYSTEM_TEMPLATE: string;
export const UNPACK_USER_TEMPLATE: string;
