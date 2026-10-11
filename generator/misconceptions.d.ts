// TypeScript definitions for generator/misconceptions.js — per-topic
// misconception library. Keyed on the short topic slugs buildPrompts
// receives; see the file header for the slice history and prefix notes.
export interface MisconceptionBeat {
  wrongTurn: string;
  why: string;
  correctTurn: string;
}
// A faceted entry spans multiple syllabus facets (e.g. bio-nutrition):
// `primary` names the facet bare-topic lookups resolve to, `facets` maps
// facet name -> beat. Plain entries carry only the beat fields.
export interface MisconceptionEntry extends MisconceptionBeat {
  primary?: string;
  facets?: { [facet: string]: MisconceptionBeat };
}
export const MISCONCEPTIONS: { [slug: string]: MisconceptionEntry };
