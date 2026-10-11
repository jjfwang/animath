// TypeScript definitions for web/embed.js — one-call player embedding.
// A string slug fetches the sample JSON under opts.baseUrl; a spec object
// mounts directly. Always returns a Promise resolving to the controller.
import type { AnimathSpec, PlayerContainer, PlayerController } from '../player/player';
export interface EmbedOptions {
  baseUrl?: string;
  autoplay?: boolean;
}
export interface ResolvedEmbedOptions {
  baseUrl: string;
  autoplay: boolean;
}
export function applyDefaults(opts?: EmbedOptions): ResolvedEmbedOptions;
export function resolveSampleUrl(slug: string, baseUrl?: string): string;
export function mount(
  container: PlayerContainer,
  specOrSlug: AnimathSpec | string,
  opts?: EmbedOptions
): Promise<PlayerController>;
export const version: string;
