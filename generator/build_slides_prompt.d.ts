// TypeScript definitions for generator/build_slides_prompt.js - animath slide prompt builder.
export interface SlideMisconceptionBeat {
  wrongTurn: string;
  why: string;
  correctTurn: string;
}
// An unpack transition, in the build_prompt transition shape; an optional
// misconception beat rides through when the unpack layer attached one.
export interface SlideTransition {
  name: string;
  from_state: string;
  to_state: string;
  driver: string;
  misconception?: SlideMisconceptionBeat;
}
export interface SlidePromptOptions {
  level?: string;
  subject: string;
  topic?: string;
  topicLabel?: string;
  focus?: string;
  facet?: string;
  transitions?: SlideTransition[];
  shape?: string;
  misconceptions?: SlideMisconceptionBeat[];
  workedExample?: string;
}
export interface SlidePrompts {
  system: string;
  user: string;
}
export function buildSlidePrompts(opts: SlidePromptOptions): SlidePrompts;
export const SLIDE_SYSTEM_TEMPLATE: string;
// Trimmed water-cycle gold deck (issue #745): compact JSON string of the
// hand-authored samples/decks/primary-science-water-cycle.json, under 3KB.
export const WATER_CYCLE_DECK_EXEMPLAR: string;
