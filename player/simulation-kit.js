/* Safe, typed simulation registry for interactive:"0.2"; no arbitrary code in specs. */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.TeachkitSimulations = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var ids = {
    'water-cycle': ['solar','cooling','growth'],
    'fraction-bars': ['numerator','denominator'],
    'uniform-motion': ['speed','time']
  };
  var models = Object.freeze(Object.keys(ids));
  function obj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function text(x, limit) { return typeof x === 'string' && !!x.trim() && x.length <= limit; }
  function finite(x) { return Number.isFinite(x) && Math.abs(x) <= 1000; }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function validate(spec) {
    if (!obj(spec)) return ['simulation must be an object'];
    var err = [];
    if (spec.simulation !== '0.2') err.push('simulation version must be 0.2');
    if (!Object.prototype.hasOwnProperty.call(ids,spec.model)) err.push('unknown registered model');
    if (!text(spec.title,120) || !text(spec.level,40) || !text(spec.subject,40) || !text(spec.topic,90)) err.push('missing/bad syllabus identity');
    if (!text(spec.disclaimer,400)) err.push('missing model limitation');
    if (!Array.isArray(spec.parameters) || spec.parameters.length !== (ids[spec.model] || []).length) err.push('invalid parameter count');
    else {
      var seen = {};
      spec.parameters.forEach(function (p) {
        if (!obj(p) || (ids[spec.model] || []).indexOf(p.id) < 0 || seen[p.id]) { err.push('unknown/duplicate parameter');return; }
        seen[p.id] = true;
        if (!text(p.label,80) || !finite(p.min) || !finite(p.max) || !finite(p.step) ||
          !finite(p.default) || p.min > p.max || p.step <= 0 || p.default < p.min ||
          p.default > p.max || !Number.isInteger((p.default-p.min)/p.step)) err.push('invalid bounds/step');
      });
      (ids[spec.model] || []).forEach(function (id) { if (!seen[id]) err.push('missing parameter: '+id); });
    }
    if (!Array.isArray(spec.beats) || spec.beats.length < 2 || spec.beats.length > 10) err.push('invalid beats');
    else {
      var beats = {};
      spec.beats.forEach(function (b) {
        if (!obj(b) || !/^[a-z][a-z0-9-]{0,39}$/.test(b.id) || beats[b.id] ||
          !text(b.label,80) || !text(b.narration,600)) err.push('bad/duplicate beat');
        else beats[b.id] = true;
      });
    }
    var q=spec.check;
    if (!obj(q) || !text(q.question,280) || !Array.isArray(q.options) || q.options.length < 2 ||
      q.options.length > 4 || !q.options.every(function (x) { return text(x,150); }) ||
      !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length ||
      !text(q.explanation,500)) err.push('invalid comprehension checkpoint');
    if (spec.model === 'fraction-bars' && Array.isArray(spec.parameters)) {
      var n=spec.parameters.find(function (p) { return p.id==='numerator'; });
      var d=spec.parameters.find(function (p) { return p.id==='denominator'; });
      if (n && d && (n.default > d.default || d.min < 1 || n.min < 0 ||
        d.max > 12 || n.max > d.max || !Number.isInteger(n.step) || !Number.isInteger(d.step))) err.push('fraction parameter invariant');
    }
    if (spec.model === 'water-cycle' && !/not.*forecast|not.*prediction/i.test(spec.disclaimer)) err.push('water cycle must disclose non-forecast limitation');
    return err;
  }
  function validated(spec) {
    var errors=validate(spec);
    if (errors.length) throw new Error(errors.join('; '));
    return JSON.parse(JSON.stringify(spec));
  }
  function calculate(model, p) {
    if (!Object.prototype.hasOwnProperty.call(ids,model)) throw new Error('unknown model');
    if (!obj(p) || ids[model].some(function (id) { return !finite(p[id]); })) throw new Error('non-finite parameters');
    if (model==='water-cycle') {
      return {evaporation:p.solar, condensation:Math.min(p.solar,p.cooling),
        precipitation:Math.min(p.solar,p.cooling,p.growth), collection:Math.min(p.solar,p.cooling,p.growth)};
    }
    if (model==='fraction-bars') {
      if (!Number.isInteger(p.denominator) || p.denominator < 1 || !Number.isInteger(p.numerator) ||
        p.numerator < 0 || p.numerator > p.denominator) throw new Error('invalid fraction');
      return { numerator:p.numerator, denominator:p.denominator, fraction:p.numerator/p.denominator };
    }
    if (p.speed < 0 || p.time < 0) throw new Error('invalid motion');
    return {speed:p.speed, time:p.time, distance:p.speed*p.time};
  }
  function createSession(spec) {
    var document=validated(spec), params={}, beat=document.beats[0].id, answer=null;
    document.parameters.forEach(function (p) { params[p.id]=p.default; });
    calculate(document.model,params);
    var history=[], observers=[], dead=false;
    function live() { if (dead) throw new Error('session destroyed'); }
    function state() { live(); return {model:document.model, beat:beat, parameters:Object.assign({},params),
      output:calculate(document.model,params), answer:answer === null ? null : Object.assign({},answer)}; }
    function emit(type,source,detail) {
      var evt={sequence:history.length+1,type:type,source:source,detail:detail,state:state()};
      history.push(evt);var safe=JSON.parse(JSON.stringify(evt));
      observers.slice().forEach(function (fn) { try { fn(JSON.parse(JSON.stringify(safe))); } catch (_) {} });
      return safe;
    }
    function actor(source) {
      if (source===undefined) return 'student';
      if (source!=='student' && source!=='tutor') throw new Error('invalid actor');
      return source;
    }
    function setParameter(id,value,source) {
      live();var origin=actor(source), p=document.parameters.find(function (x) { return x.id===id; });
      if (!p || !finite(value) || value<p.min || value>p.max ||
        !Number.isInteger((value-p.min)/p.step)) throw new Error('invalid parameter');
      var next=Object.assign({},params);next[id]=value;calculate(document.model,next);
      params=next;return emit('parameter',origin,{id:id,value:value});
    }
    function playBeat(id,source) {
      live();var origin=actor(source);
      if (!document.beats.some(function (b) { return b.id===id; })) throw new Error('unknown beat');
      beat=id;return emit('beat',origin,{id:id});
    }
    function submitAnswer(index,source) {
      live();var origin=actor(source);
      if (!Number.isInteger(index) || index<0 || index>=document.check.options.length) throw new Error('invalid answer');
      answer={index:index,correct:index===document.check.correctIndex};
      return emit('checkpoint',origin,{index:index,correct:answer.correct});
    }
    function reset(source) {
      live();var origin=actor(source);
      params={};document.parameters.forEach(function (p) {params[p.id]=p.default;});
      beat=document.beats[0].id;answer=null;return emit('reset',origin,{});
    }
    return {spec:document, getState:state, getHistory:function(){live();return JSON.parse(JSON.stringify(history));},
      setParameter:setParameter,playBeat:playBeat,answer:submitAnswer,reset:reset,
      on:function(fn){live();if(typeof fn!=='function')throw new Error('listener required');
        observers.push(fn);return function(){observers=observers.filter(function(x){return x!==fn;});};},
      destroy:function(){dead=true;observers=[];} };
  }
  function svgFor(spec,state) {
    var doc=validated(spec);
    if (!obj(state) || state.model!==doc.model || !obj(state.parameters) ||
      !doc.beats.some(function(b){return b.id===state.beat;}))
      throw new Error('invalid visualization state');
    var p={};
    doc.parameters.forEach(function(param){
      var value=state.parameters[param.id];
      if (!finite(value) || value<param.min || value>param.max ||
        !Number.isInteger((value-param.min)/param.step))
        throw new Error('invalid visualization parameter '+param.id);
      p[param.id]=value;
    });
    var out=calculate(doc.model,p), body='', c='#144E70', fill='#67A5D8';
    if (spec.model==='fraction-bars') {
      var n=p.numerator,d=p.denominator,w=540/d;
      body='<text x="85" y="60" font-size="26" fill="'+c+'">'+n+' of '+d+' equal parts</text>';
      for(var i=0;i<d;i++)body+='<rect x="'+(85+i*w)+'" y="98" width="'+w+'" height="88" fill="'+(i<n?fill:'#EDF4F7')+'" stroke="'+c+'" stroke-width="2"/>';
      body+='<text x="85" y="252" font-size="28" fill="'+c+'">'+n+' / '+d+' = '+(out.fraction*100).toFixed(1)+'%</text>';
    } else if(spec.model==='uniform-motion') {
      var dist=Math.min(out.distance,1000),x=90+Math.min(510,dist/1000*510);
      body='<path d="M90 230 H630" stroke="'+c+'" stroke-width="5"/>'+
        '<path d="M90 220 V242 M630 220 V242" stroke="'+c+'" stroke-width="5"/>'+
        '<circle cx="'+x+'" cy="230" r="19" fill="'+fill+'" stroke="'+c+'" stroke-width="3"/>'+
        '<text x="90" y="85" font-size="25" fill="'+c+'">Distance = speed × time</text>'+
        '<text x="90" y="130" font-size="26" fill="'+c+'">'+p.speed+' m/s × '+p.time+' s = '+out.distance+' m</text>'+
        '<text x="90" y="300" font-size="18" fill="'+c+'">Scale is illustrative (1000 m maximum shown).</text>';
    } else {
      var labels=['Evaporation','Condensation','Precipitation','Collection'];
      var props=['evaporation','condensation','precipitation','collection'];
      for(var j=0;j<labels.length;j++){
        var y=46+j*70,val=out[props[j]];
        body+='<text x="35" y="'+(y+22)+'" font-size="20" fill="'+c+'">'+labels[j]+'</text>'+
          '<rect x="225" y="'+y+'" width="420" height="32" rx="7" fill="#D7E5ED"/>'+
          '<rect x="225" y="'+y+'" width="'+(val*4.2)+'" height="32" rx="7" fill="'+fill+'"/>'+
          '<text x="655" y="'+(y+23)+'" font-size="17" fill="'+c+'">'+val+'</text>';
      }
    }
    var label=esc(spec.title+'; current beat: '+state.beat);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 360" role="img" aria-label="'+label+'">'+
      '<rect x="0" y="0" width="740" height="360" fill="#F7FBFD" rx="12"/>'+body+'</svg>';
  }
  function mount(container,spec) {
    var doc=validated(spec);
    if(!container || typeof container.appendChild!=='function')throw new Error('DOM container required');
    var document=container.ownerDocument || (typeof globalThis!=='undefined'&&globalThis.document),session=createSession(doc);
    container.textContent='';
    function node(tag,txt) {var n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;return n;}
    var root=node('section');root.className='tki-simulation';
    var title=node('h2',doc.title),stage=node('div'),narration=node('p'),controls=node('div'),
      beats=node('div'),check=node('fieldset'),feedback=node('p'),disclaimer=node('p',doc.disclaimer);
    narration.setAttribute('aria-live','polite');feedback.setAttribute('aria-live','polite');
    root.appendChild(title);root.appendChild(stage);root.appendChild(narration);
    var inputs={};doc.parameters.forEach(function(p){
      var wrap=node('div'),lab=node('label',p.label),range=node('input'),output=node('output');
      range.type='range';range.min=String(p.min);range.max=String(p.max);range.step=String(p.step);
      range.id='tks-'+p.id;lab.htmlFor=range.id;
      range.addEventListener('input',function(){try{session.setParameter(p.id,Number(range.value));}
        catch(_){range.value=String(session.getState().parameters[p.id]);}});
      wrap.appendChild(lab);wrap.appendChild(range);wrap.appendChild(output);controls.appendChild(wrap);
      inputs[p.id]={range:range,output:output};
    });root.appendChild(controls);
    doc.beats.forEach(function(b){var button=node('button',b.label);button.type='button';
      button.addEventListener('click',function(){session.playBeat(b.id);});beats.appendChild(button);});
    root.appendChild(beats);check.appendChild(node('legend',doc.check.question));
    doc.check.options.forEach(function(option,i){var button=node('button',option);button.type='button';
      button.addEventListener('click',function(){session.answer(i);});check.appendChild(button);});
    check.appendChild(feedback);root.appendChild(check);root.appendChild(disclaimer);
    container.appendChild(root);
    function paint(){var s=session.getState();stage.innerHTML=svgFor(doc,s);
      narration.textContent=doc.beats.find(function(x){return x.id===s.beat;}).narration;
      doc.parameters.forEach(function(p){inputs[p.id].range.value=String(s.parameters[p.id]);
        inputs[p.id].output.textContent=String(s.parameters[p.id]);});
      feedback.textContent=s.answer===null?'':(s.answer.correct?'Correct. ':'Review: ')+doc.check.explanation;
    }
    var off=session.on(paint);paint();
    return {spec:doc,getState:session.getState,getHistory:session.getHistory,
      setParameter:session.setParameter,playBeat:session.playBeat,answer:session.answer,reset:session.reset,
      on:session.on,destroy:function(){off();session.destroy();container.textContent='';}};
  }
  return {version:'0.2',models:models,validate:validate,calculate:calculate,createSession:createSession,svgFor:svgFor,mount:mount,escapeText:esc};
});
