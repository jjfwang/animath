/* Deterministic tutor timeline adapter. Host owns authentication and voice playback.
 * No timers or LLM calls; every command maps to a validated teaching beat.
 */
(function (global, factory) {
  var api=factory();
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else global.TeachkitTutorBridge=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function validText(s){return typeof s==='string' && /^[a-zA-Z0-9_:./-]{1,120}$/.test(s);}
  function createTutorBridge(controller,map,opts){
    if(!controller || typeof controller.getState!=='function' ||
       typeof controller.playBeat!=='function' || typeof controller.on!=='function')
      throw new Error('a Teachkit controller is required');
    if(!Array.isArray(map) || map.length<2 || map.length>24)throw new Error('beat map required');
    var ids={},slides={},cues={};
    map.forEach(function(entry){
      if(!entry || !validText(entry.beatId) || !validText(entry.slideId) || !validText(entry.speechCue) ||
        ids[entry.beatId] || slides[entry.slideId] || cues[entry.speechCue])throw new Error('invalid or duplicate beat mapping');
      ids[entry.beatId]=entry;slides[entry.slideId]=true;cues[entry.speechCue]=true;
    });
    var spec=controller.spec;
    if(spec && Array.isArray(spec.beats)){
      if(map.length!==spec.beats.length || !spec.beats.every(function(b){return !!ids[b.id];}))
        throw new Error('every tutor beat must have a slide and speech cue');
    }
    var clock=opts && opts.clock;
    if(clock!==undefined && typeof clock!=='function')throw new Error('clock must be a function');
    var now=clock || function(){return 0;};
    var listeners=[],events=[],seq=0,paused=true,ended=false,questionPending=false,attempts=0;
    var current=map[0],speechPosition=0,highestCommand=0;
    if(controller.getState().beat && ids[controller.getState().beat])current=ids[controller.getState().beat];
    function snapshot(){
      return {beatId:current.beatId,slideId:current.slideId,speechCue:current.speechCue,
        speechPosition:speechPosition,paused:paused,ended:ended,
        questionPending:questionPending,attempts:attempts,needsAdaptation:attempts>=2&&questionPending,
        visual:controller.getState()};
    }
    function event(type,data){
      var t=now();
      if(!Number.isFinite(t) || t<0)throw new Error('invalid clock');
      var evt={seq:++seq,time:t,type:type,detail:data,state:snapshot()};
      events.push(evt);
      listeners.slice().forEach(function(fn){try{fn(JSON.parse(JSON.stringify(evt)));}catch(_){}});
      return JSON.parse(JSON.stringify(evt));
    }
    function ensure(){if(ended)throw new Error('lesson bridge ended');}
    function setBeat(id){
      if(!ids[id])throw new Error('unmapped beat');
      current=ids[id];speechPosition=0;questionPending=false;attempts=0;
      controller.playBeat(id,'tutor');
    }
    function command(req){
      ensure();
      if(!req || !Number.isSafeInteger(req.sequence) || req.sequence<1 ||
        !validText(req.type))throw new Error('invalid command envelope');
      if(req.sequence<=highestCommand)return {status:'duplicate',highestCommand:highestCommand,state:snapshot()};
      if(req.sequence!==highestCommand+1)throw new Error('out of order tutor command');
      var type=req.type;
      if(type==='play' || type==='seek'){
        if(!ids[req.beatId])throw new Error('unmapped beat');
        setBeat(req.beatId);paused=false;
      }else if(type==='pause' || type==='interrupt'){
        paused=true;
      }else if(type==='resume'){
        if(questionPending)throw new Error('checkpoint pending');
        paused=false;
      }else if(type==='ask'){
        if(questionPending)throw new Error('checkpoint already pending');
        paused=true;questionPending=true;attempts=0;
      }else if(type==='parameter'){
        if(typeof req.parameterId!=='string')throw new Error('missing parameter id');
        controller.setParameter(req.parameterId,req.value,'tutor');
      }else if(type==='end'){
        paused=true;ended=true;
      }else throw new Error('unknown tutor command');
      highestCommand=req.sequence;
      return event('tutor:'+type,{sequence:req.sequence,beatId:req.beatId||null,
        parameterId:req.parameterId||null});
    }
    function speech(cue,position){
      ensure();
      if(cue!==current.speechCue || paused || questionPending)throw new Error('speech cue not active');
      if(!Number.isFinite(position)||position<speechPosition||position>3600000)throw new Error('invalid speech progress');
      speechPosition=position;return event('speech',{cue:cue,position:position});
    }
    function answer(index){
      ensure();
      if(!questionPending)throw new Error('no pending checkpoint');
      var result=controller.answer(index,'student'),correct=result.detail.correct;
      attempts++;
      if(correct)questionPending=false;
      // Avoid a repetitive infinite question loop: after two attempts,
      // flag teaching adaptation instead of automatically re-asking.
      return event('student:answer',{index:index,correct:correct,attempts:attempts});
    }
    function setParameter(id,value){
      ensure();controller.setParameter(id,value,'student');
      return event('student:parameter',{id:id,value:value});
    }
    function on(fn){
      if(typeof fn!=='function')throw new Error('listener must be function');
      listeners.push(fn);
      return function(){listeners=listeners.filter(function(f){return f!==fn;});};
    }
    return {state:function(){return JSON.parse(JSON.stringify(snapshot()));},
      events:function(){return JSON.parse(JSON.stringify(events));},
      command:command,speech:speech,answer:answer,setParameter:setParameter,on:on,
      dispose:function(){listeners=[];}};
  }
  return {version:'0.1',createTutorBridge:createTutorBridge};
});
