/** Tutor beat/speech/slide timeline adapter; host must authenticate and play audio. */
import type { SimulationController, SimulationState } from './simulation-kit';
export interface BeatAnchor { beatId: string; slideId: string; speechCue: string; }
export interface TutorBridgeState {
  beatId:string; slideId:string; speechCue:string; speechPosition:number;
  paused:boolean; ended:boolean; questionPending:boolean;
  attempts:number; needsAdaptation:boolean; visual:SimulationState;
}
export type TutorCommand =
 | {sequence:number;type:'play'|'seek';beatId:string}
 | {sequence:number;type:'pause'|'interrupt'|'resume'|'ask'|'end'}
 | {sequence:number;type:'parameter';parameterId:string;value:number};
export interface TutorBridgeEvent {
  seq:number;time:number;type:string;detail:Record<string,unknown>;state:TutorBridgeState;
}
export interface TutorBridge {
  state():TutorBridgeState;
  events():TutorBridgeEvent[];
  command(request:TutorCommand):TutorBridgeEvent|{status:'duplicate';highestCommand:number;state:TutorBridgeState};
  speech(cue:string,position:number):TutorBridgeEvent;
  answer(index:number):TutorBridgeEvent;
  setParameter(id:string,value:number):TutorBridgeEvent;
  on(handler:(event:TutorBridgeEvent)=>void):()=>void;
  dispose():void;
}
export const version:string;
export function createTutorBridge(controller:SimulationController, beats:BeatAnchor[],opts?:{clock?:()=>number}):TutorBridge;
