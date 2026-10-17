/** Experimental versioned storage for approved interactive teaching materials. */
export interface CurriculumContext {
  curriculum:string; curriculumRevision:string;level:string;track:string;subject:string;
  topic:string;locale:string;objectivesHash:string;difficulty:string;
  promptVersion:string;engineVersion:string;
}
export interface ObjectStore {
  get(key:string):Promise<string|null>;
  put(key:string,value:string):Promise<void>;
  compareAndSwap(key:string,expected:string|null,next:string):Promise<boolean>;
}
export interface AssetEntry {name:string;key:string;sha256:string;length:number;}
export interface AssetManifest {
  schema:'teachkit-approved-v1';approvalStatus:'approved';assetRevision:string;
  curriculum:Record<string,string>;promptVersion:string;engineVersion:string;
  difficulty:string;approvedBy:{type:'agent'|'human';reviewerId:string;confidence:number;checks:Record<string,string>};
  files:AssetEntry[];
}
export interface AssetVerdict {
  approved:boolean;status:'approved';automatic:{passed:true;errors:string[]};
  reviewer?:{type:'agent';status:'approve';reviewerId:string;confidence:number;
    checks:Record<string,'pass'>;findings:string[]};
  human?:{type:'human';status:'approve';reviewerId:string;confidence:number;
    checks:Record<string,'pass'>;findings:string[]};
}
export const version:string;
export function prefix(ctx:CurriculumContext):string;
export function canonical(value:unknown):string;
export function sha256(text:string):Promise<string>;
export function publish(store:ObjectStore,ctx:CurriculumContext,assets:Record<string,string>,
  verdict:AssetVerdict):Promise<{manifestKey:string;assetRevision:string;pointerKey:string}>;
export function read(store:ObjectStore,ctx:CurriculumContext,revision?:string|null):
  Promise<{manifest:AssetManifest;assets:Record<string,string>}>;
export function rollback(store:ObjectStore,ctx:CurriculumContext,revision:string):
  Promise<{pointerKey:string;assetRevision:string}>;
/** For local tests only; never production durable storage. */
export function createMemoryStore():ObjectStore;
