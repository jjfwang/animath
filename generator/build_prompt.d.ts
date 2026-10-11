// TypeScript definitions for generator/build_prompt.js — animath prompt builder.
export interface BuildPromptOptions {
  level?: string;
  subject?: string;
  topic?: string;
  topicLabel?: string;
  kind?: string;
  focus?: string;
  facet?: string;
}
export interface Prompts {
  system: string;
  user: string;
}
export function buildPrompts(opts: BuildPromptOptions): Prompts;

// One misconception beat: the wrong turn, why students slip, the correct turn.
export interface MisconceptionBeat {
  wrongTurn: string;
  why: string;
  correctTurn: string;
}
// A faceted library entry (e.g. h2-organic): primary names the facet that
// bare-topic lookups resolve to; facets maps facet name -> beat.
export interface MisconceptionEntry extends MisconceptionBeat {
  primary?: string;
  facets?: { [facet: string]: MisconceptionBeat };
}
export function misconceptionFor(
  topicSlug: string, facetHint?: string
): MisconceptionEntry | null;
export const LEVEL_LABELS: { [level: string]: string };
export const SYSTEM_TEMPLATE: string;
