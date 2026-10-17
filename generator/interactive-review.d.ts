/** Prepublication deterministic + injected independent agent/human review gates. */
export type CheckStatus = 'pass'|'fail'|'uncertain';
export interface ReviewReport {
  status:'approve'|'revise'|'uncertain'; reviewerId:string; confidence:number;
  findings:string[]; checks:Record<'scientific'|'curriculum'|'pedagogy'|'accessibility',CheckStatus>;
}
export interface ReviewBlueprint { syllabusId:string;objectives:string[];misconceptions?:string[]; }
export interface ReviewVerdict {
  automatic:{passed:boolean;errors:string[]}; status:'approved'|'rejected'|'human_required';
  approved:boolean;reviewer:null|ReviewReport; human:null|ReviewReport;
  agentError?:string;humanError?:string;
}
export const version:string;
export const categories:string[];
export function auditSvg(svg:string):string[];
export function audit(spec:unknown,svg:string,validator:(s:unknown)=>string[]):{passed:boolean;errors:string[]};
export function normalizeReview(report:unknown,type:'agent'|'human'):ReviewReport|null;
export function reviewerPrompt(spec:unknown,blueprint:ReviewBlueprint):Record<string,unknown>;
export function reviewAsset(spec:unknown,svg:string,validator:(s:unknown)=>string[],
  blueprint:ReviewBlueprint,providers?:{
    agent?:(prompt:Record<string,unknown>)=>Promise<ReviewReport>;
    human?:(context:Record<string,unknown>)=>Promise<ReviewReport>;
  }):Promise<ReviewVerdict>;
