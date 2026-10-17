/* Node-only local durable object adapter; no third-party dependencies.
 * Staging and single-host use. For distributed production use S3 + DB CAS.
 * Do not serve user-provided keys; accepted characters are deliberately strict.
 */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
async function existsRead(p) {
  try{return await fs.readFile(p,'utf8');}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
}
function createFileStore(root) {
  if(typeof root!=='string'||!root.trim())throw new Error('absolute root path required');
  const base=path.resolve(root);
  function filepath(key){
    if(typeof key!=='string'||key.length>1400 ||
      key.split('/').some(s=>!/^[a-z0-9][a-z0-9._-]{0,100}$/.test(s)||s==='..'))
      throw new Error('invalid storage key');
    const full=path.resolve(base,key);
    if(full===base||!full.startsWith(base+path.sep))throw new Error('key escapes storage root');
    return full;
  }
  async function put(key,value){
    if(typeof value!=='string')throw new Error('text value required');
    const dest=filepath(key),parent=path.dirname(dest);
    await fs.mkdir(parent,{recursive:true});
    const tmpdir=await fs.mkdtemp(path.join(parent,'.teachkit-asset-'));
    const temp=path.join(tmpdir,'object');
    try{
      await fs.writeFile(temp,value,'utf8');
      try{await fs.link(temp,dest);}
      catch(error){
        if(error.code!=='EEXIST')throw error;
        const old=await existsRead(dest);
        if(old!==value)throw new Error('immutable object collision: '+key);
      }
    }finally{await fs.rm(tmpdir,{recursive:true,force:true});}
  }
  async function compareAndSwap(key,expected,next){
    if(typeof next!=='string')throw new Error('string pointer required');
    const dest=filepath(key),parent=path.dirname(dest);
    await fs.mkdir(parent,{recursive:true});
    const lock=dest+'.lock';
    try{await fs.mkdir(lock);}
    catch(e){if(e.code==='EEXIST')return false;throw e;}
    try{
      const cur=await existsRead(dest);
      if(cur!==expected)return false;
      const tmpdir=await fs.mkdtemp(path.join(parent,'.teachkit-pointer-'));
      const tmp=path.join(tmpdir,'pointer');
      try{await fs.writeFile(tmp,next,'utf8');await fs.rename(tmp,dest);}
      finally{await fs.rm(tmpdir,{recursive:true,force:true});}
      return true;
    }finally{await fs.rmdir(lock);}
  }
  return {get:key=>existsRead(filepath(key)),put,compareAndSwap};
}
module.exports={createFileStore};
