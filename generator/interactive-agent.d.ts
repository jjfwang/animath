/** Optional independent agent review via the existing OpenAI-compatible client. */
import type { ReviewReport } from './interactive-review';
export interface AgentReviewerConfig {
  reviewerId:string;model:string;apiKey?:string;baseUrl?:string;
}
export function createAgentReviewer(config:AgentReviewerConfig,
  transport?:(system:string,user:string,config:AgentReviewerConfig)=>Promise<string|object>):
  (prompt:Record<string,unknown>)=>Promise<ReviewReport>;
