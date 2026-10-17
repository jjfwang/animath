/* End-to-end approved interactive lesson preparation and preloaded playback.
 * Node/browser compatible; host owns cloud storage, authentication and LLM provider.
 */
(function(root,factory){
  var api;
  if(typeof module!=='undefined'&&module.exports){
    api=factory(require('../player/simulation-kit.js'),require('./interactive-review.js'),
      require('./approved-assets.js'),require('../player/tutor-bridge.js'));
    module.exports=api;
  }else{
    api=factory(root.TeachkitSimulations,root.TeachkitReview,
      root.TeachkitAssetStore,root.TeachkitTutorBridge);
    root.TeachkitInteractiveService=api;
  }
})(typeof window!=='undefined'?window:globalThis,function(sim,review,assets,tutor){
  'use strict';
  function requireServices(){
    if(!sim||!review||!assets||!tutor)throw new Error('missing interactive service modules');
  }
  function checkIdentity(spec,context,blueprint){
    assets.prefix(context); // validates all required curriculum and version fields
    if (!spec || context.level!==spec.level || context.subject!==spec.subject ||
        context.topic!==spec.topic)
      throw new Error('lesson specification does not match curriculum storage path');
    if (blueprint && blueprint.syllabusId !==
      [context.curriculum,context.curriculumRevision,context.level,
       context.subject,context.topic].join('/'))
      throw new Error('lesson blueprint does not match curriculum storage path');
  }
  async function prepareAndPublish(request){
    requireServices();
    if(!request||!request.spec||!request.context||!request.blueprint||!request.store)
      throw new Error('missing lesson preparation inputs');
    var spec=request.spec,errors=sim.validate(spec);
    if(errors.length)throw new Error('invalid lesson spec: '+errors.join('; '));
    checkIdentity(spec,request.context,request.blueprint);
    var session=sim.createSession(spec),svg=sim.svgFor(spec,session.getState());
    session.destroy();
    var verdict=await review.reviewAsset(spec,svg,sim.validate,request.blueprint,request.reviewers);
    if(!verdict.approved)return {status:verdict.status,verdict:verdict,publication:null};
    var provided=request.materials||{};
    var pack=Object.assign({},provided,{
      'interactive.json':JSON.stringify(spec),
      'preview.svg':svg
    });
    var publication=await assets.publish(request.store,request.context,pack,verdict);
    return {status:'published',verdict:verdict,publication:publication};
  }
  async function loadApproved(request){
    requireServices();
    if(!request||!request.store||!request.context)throw new Error('missing approved asset lookup');
    var pack=await assets.read(request.store,request.context,request.revision);
    var data=pack.assets['interactive.json'];
    if(typeof data!=='string')throw new Error('approved pack missing interactive spec');
    var spec;
    try{spec=JSON.parse(data);}catch(_){throw new Error('approved interactive JSON invalid');}
    var errs=sim.validate(spec);
    if(errs.length)throw new Error('approved interactive spec invalid: '+errs.join('; '));
    checkIdentity(spec,request.context);
    return {manifest:pack.manifest,spec:spec,materials:pack.assets};
  }
  async function mountApproved(request){
    if(!request||!request.container)throw new Error('DOM container required');
    var approved=await loadApproved(request);
    var controller=sim.mount(request.container,approved.spec),bridge=null;
    try{
      if(approved.materials['anchors.json']){
        var map=JSON.parse(approved.materials['anchors.json']);
        bridge=tutor.createTutorBridge(controller,map,{clock:request.clock});
      }
    }catch(err){controller.destroy();throw err;}
    return {manifest:approved.manifest,controller:controller,bridge:bridge,
      destroy:function(){if(bridge)bridge.dispose();controller.destroy();}};
  }
  return {version:'0.1',prepareAndPublish:prepareAndPublish,
    loadApproved:loadApproved,mountApproved:mountApproved};
});
