/* Node-only deterministic runtime benchmark for pilot simulations.
 * Measures local command + SVG string generation only, not device paint/audio/network.
 * Usage: node generator/tooling/benchmark-interactive.js
 */
'use strict';
const {performance}=require('node:perf_hooks');
const fs=require('node:fs');
const path=require('node:path');
const kit=require('../../player/simulation-kit.js');
const dir=path.join(__dirname,'../../samples/simulations');
const names=['secondary-water-cycle','primary-fractions','secondary-motion','ohms-law',
  'ideal-gas','quadratic-curve','transpiration','erosion'];
function p95(values){
 const sorted=values.slice().sort((a,b)=>a-b);
 return sorted[Math.ceil(sorted.length*0.95)-1];
}
function run(iterations=600){
 const results=[];
 for(const name of names){
  const spec=JSON.parse(fs.readFileSync(path.join(dir,name+'.json'),'utf8'));
  const session=kit.createSession(spec),samples=[];
  for(let i=0;i<iterations;i++){
   const start=performance.now();
   // Beat switch and render exercise UI change/simulation without LLM calls.
   session.playBeat(spec.beats[i%spec.beats.length].id,'tutor');
   kit.svgFor(spec,session.getState());
   samples.push(performance.now()-start);
  }
  results.push({model:spec.model,iterations:iterations,p95Ms:Number(p95(samples).toFixed(3)),
    maxMs:Number(Math.max(...samples).toFixed(3))});
  session.destroy();
 }
 return results;
}
if(require.main===module){
 const out=run();
 console.log(JSON.stringify({targetLocalP95Ms:50,
   note:'Host Node computation+SVG generation only. Browser paint/TTI and school mobile network are NOT measured.',
   results:out},null,2));
 if(out.some(x=>x.p95Ms>50))process.exitCode=1;
}
module.exports={p95,run};
