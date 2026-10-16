// TypeScript definitions for generator/build_exit_ticket_prompt.js - animath exit-ticket prompt builder.
export interface ExitTicketMisconceptionBeat {
  wrongTurn: string;
  why: string;
  correctTurn: string;
}
// An unpack transition, in the build_prompt transition shape; an optional
// misconception beat rides through when the unpack layer attached one.
export interface ExitTicketTransition {
  name: string;
  from_state: string;
  to_state: string;
  driver: string;
  misconception?: ExitTicketMisconceptionBeat;
}
export interface ExitTicketPromptOptions {
  level?: string;
  subject: string;
  topic?: string;
  topicLabel?: string;
  focus?: string;
  facet?: string;
  transitions?: ExitTicketTransition[];
  misconceptions?: ExitTicketMisconceptionBeat[];
  workedExample?: string;
}
export interface ExitTicketPrompts {
  system: string;
  user: string;
}
export function buildExitTicketPrompts(opts: ExitTicketPromptOptions): ExitTicketPrompts;
export const EXIT_TICKET_SYSTEM_TEMPLATE: string;
// Trimmed water-cycle gold exit ticket (issue #756): compact JSON string
// of the hand-authored samples/tickets/primary-science-water-cycle.json.
export const WATER_CYCLE_TICKET_EXEMPLAR: string;
