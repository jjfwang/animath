// TypeScript definitions for generator/build_script_prompt.js - animath teacher script prompt builder.
export interface ScriptMisconceptionBeat {
  wrongTurn: string;
  why: string;
  correctTurn: string;
}
export interface ScriptTransition {
  name: string;
  from_state: string;
  to_state: string;
  driver: string;
  misconception?: ScriptMisconceptionBeat;
}
export interface ScriptPromptOptions {
  level?: string;
  subject: string;
  topic?: string;
  topicLabel?: string;
  focus?: string;
  facet?: string;
  transitions?: ScriptTransition[];
  misconceptions?: ScriptMisconceptionBeat[];
  workedExample?: string;
}
export interface ScriptPrompts {
  system: string;
  user: string;
}
export function buildScriptPrompts(opts: ScriptPromptOptions): ScriptPrompts;
export const SCRIPT_SYSTEM_TEMPLATE: string;
// Trimmed water-cycle gold script (issue #764): compact JSON string of
// the hand-authored samples/scripts/primary-science-water-cycle.json.
export const WATER_CYCLE_SCRIPT_EXEMPLAR: string;
