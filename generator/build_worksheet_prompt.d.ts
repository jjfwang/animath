// TypeScript definitions for generator/build_worksheet_prompt.js - animath worksheet prompt builder.
export interface WorksheetMisconceptionBeat {
  wrongTurn: string;
  why: string;
  correctTurn: string;
}
// An unpack transition, in the build_prompt transition shape; an optional
// misconception beat rides through when the unpack layer attached one.
export interface WorksheetTransition {
  name: string;
  from_state: string;
  to_state: string;
  driver: string;
  misconception?: WorksheetMisconceptionBeat;
}
export interface WorksheetPromptOptions {
  level?: string;
  subject: string;
  topic?: string;
  topicLabel?: string;
  focus?: string;
  facet?: string;
  transitions?: WorksheetTransition[];
  misconceptions?: WorksheetMisconceptionBeat[];
  workedExample?: string;
}
export interface WorksheetPrompts {
  system: string;
  user: string;
}
export function buildWorksheetPrompts(opts: WorksheetPromptOptions): WorksheetPrompts;
export const WORKSHEET_SYSTEM_TEMPLATE: string;
// Trimmed water-cycle gold worksheet (issue #756): compact JSON string of
// the hand-authored samples/worksheets/primary-science-water-cycle.json.
export const WATER_CYCLE_WORKSHEET_EXEMPLAR: string;
