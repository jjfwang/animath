/** Shared prepublication and approved live interactive-lesson integration. */
import type { SimulationSpec,SimulationController } from '../player/simulation-kit';
import type { CurriculumContext,ObjectStore,AssetManifest } from './approved-assets';
import type { ReviewBlueprint,ReviewReport,ReviewVerdict } from './interactive-review';
import type { TutorBridge } from '../player/tutor-bridge';
export interface PrepareRequest {
  spec:SimulationSpec;blueprint:ReviewBlueprint;context:CurriculumContext;store:ObjectStore;
  materials?:Record<string,string>;
  reviewers?:{
    agent?:(prompt:Record<string,unknown>)=>Promise<ReviewReport>;
    human?:(input:Record<string,unknown>)=>Promise<ReviewReport>;
  };
}
export const version:string;
export function prepareAndPublish(input:PrepareRequest):Promise<{
  status:'published'|'human_required'|'rejected';
  verdict:ReviewVerdict;
  publication:null|{manifestKey:string;assetRevision:string;pointerKey:string};
}>;
export function loadApproved(input:{store:ObjectStore;context:CurriculumContext;revision?:string}):
  Promise<{manifest:AssetManifest;spec:SimulationSpec;materials:Record<string,string>}>;
export function mountApproved(input:{store:ObjectStore;context:CurriculumContext;
  revision?:string;container:HTMLElement;clock?:()=>number}):Promise<{
  manifest:AssetManifest;controller:SimulationController;bridge:TutorBridge|null;destroy():void;
}>;
