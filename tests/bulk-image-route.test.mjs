import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import sharp from 'sharp';
let signedIn=true,uploaded=[],version='2026-09-22T00:00:00Z';
const db={from(table){return {select(){return this;},eq(){return this;},async single(){return {data:{id:'game',slug:'test'},error:null};},then(resolve){return Promise.resolve({data:table==='story_arcs'?[{id:'arc',title:'event',story_kind:'event',updated_at:version}]:[{id:'chapter',arc_id:'arc',title:'event',updated_at:version}],error:null}).then(resolve);}};},storage:{from(){return {async list(){return {data:[],error:null};},async upload(path,bytes,options){uploaded.push({path,bytes,options});return {error:null};}};}}};
globalThis.__bulkTestAdmin=async()=>{if(!signedIn)throw Error('denied');return {db};};
const hook=registerHooks({resolve(specifier,context,next){
 if(specifier==='@/lib/admin/server')return {url:'data:text/javascript,export const requireAdmin=()=>globalThis.__bulkTestAdmin();',shortCircuit:true};
 if(specifier.startsWith('@/'))return {url:new URL('../src/'+specifier.slice(2)+'.ts',import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
const {POST}=await import('../src/app/api/admin/bulk-images/route.ts');
hook.deregister();
const bytes=await sharp({create:{width:100,height:70,channels:3,background:'#f00'}}).png().toBuffer();
function request(mode,expected,origin='https://test.invalid'){
 const form=new FormData();form.set('image',new File([bytes],'EV1.png',{type:'image/png'}));form.set('game_id','game');form.set('kind','stories');form.set('mode',mode);if(expected)form.set('expected',JSON.stringify(expected));
 return new Request('https://test.invalid/api/admin/bulk-images',{method:'POST',headers:{origin},body:form});
}
test('route checks auth/origin, preview never writes, stale preview cannot upload, event upload returns paired updates',async()=>{
 signedIn=false;assert.equal((await POST(request('preview'))).status,403);signedIn=true;
 assert.equal((await POST(request('preview',null,'https://other.invalid'))).status,403);
 const response=await POST(request('preview'));assert.equal(response.status,200);const {preview}=await response.json();
 assert.equal(preview.targets.length,2);assert.equal(uploaded.length,0);
 version='2026-09-23T00:00:00Z';assert.equal((await POST(request('upload',preview))).status,409);assert.equal(uploaded.length,0);
 version='2026-09-22T00:00:00Z';const applied=await POST(request('upload',preview));assert.equal(applied.status,200);
 const {operations}=await applied.json();assert.equal(operations.length,2);assert.deepEqual(operations[0].patch,operations[1].patch);
 assert.equal(uploaded.length,2);assert.ok(uploaded.every(x=>x.options.upsert===false&&x.path.startsWith('test/stories/ASSET_')));
 assert.equal((await POST(request('upload',{...preview,sha256:'tampered'}))).status,409);
 delete globalThis.__bulkTestAdmin;
});
