'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createFileStore}=require('../generator/fs-object-store.js');
test('durable filesystem objects and atomic current pointer',async(t)=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'teachkit-fs-test-'));
 t.after(async()=>{await fs.rm(dir,{recursive:true,force:true});});
 const store=createFileStore(dir);
 a.equal(await store.get('teaching/sg-moe/2026/current.json'),null);
 await store.put('teaching/sg-moe/2026/abc.json','{"version":1}');
 await store.put('teaching/sg-moe/2026/abc.json','{"version":1}');
 a.equal(await store.get('teaching/sg-moe/2026/abc.json'),'{"version":1}');
 await a.rejects(store.put('teaching/sg-moe/2026/abc.json','{"version":2}'),/immutable/);
 a.equal(await store.compareAndSwap('teaching/sg-moe/2026/current.json',null,'v1'),true);
 a.equal(await store.compareAndSwap('teaching/sg-moe/2026/current.json',null,'v2'),false);
 a.equal(await store.compareAndSwap('teaching/sg-moe/2026/current.json','v1','v2'),true);
 const reopen=createFileStore(dir);
 a.equal(await reopen.get('teaching/sg-moe/2026/current.json'),'v2');
});
test('filesystem adapter rejects path traversal and unsafe key segments',async()=>{
 const s=createFileStore('/tmp/teachkit-safe-root');
 a.throws(()=>s.get('../../etc/passwd'),/invalid storage key/);
 a.throws(()=>s.get('/etc/passwd'),/invalid storage key/);
 a.throws(()=>s.get('a//b'),/invalid storage key/);
 await a.rejects(s.put('a/../b','bad'),/invalid storage key/);
});
