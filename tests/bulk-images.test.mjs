import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {imageName,resolveImageTargets,overlappingImages,mergeImageOperations} from '../src/lib/bulk-images.ts';
import {prepareContentImage} from '../src/lib/prepare-content-image.ts';
test('filename rules support base IDs, chapter hyphens and explicit variants',()=>{
 assert.deepEqual(imageName('BA_CH1-1.JPG','stories'),{sourceId:'BA_CH1-1',variants:['card','detail']});
 assert.deepEqual(imageName('BA_EV001-card.png','stories'),{sourceId:'BA_EV001',variants:['card']});
 assert.deepEqual(imageName('BA_C_001.webp','characters'),{sourceId:'BA_C_001',variants:['avatar','portrait']});
 assert.deepEqual(imageName('BA_C_001-portrait.jpeg','characters'),{sourceId:'BA_C_001',variants:['portrait']});
 for(const name of ['../BA_EV001.png','BA_EV001.svg','BA_EV001 title.png','BA_EV001-avatar.png'])assert.throws(()=>imageName(name,'stories'));
});
const arc={id:'arc',title:'event',story_kind:'event',updated_at:'stamp',cover_image:'old.webp'};
const chapter={id:'chapter',arc_id:'arc',title:'event',updated_at:'stamp'};
test('event pairs match together and ambiguous or unknown IDs fail',()=>{
 assert.equal(resolveImageTargets('stories',[arc],[chapter],[]).length,2);
 assert.throws(()=>resolveImageTargets('stories',[{...arc,story_kind:'main'}],[chapter],[]));
 assert.throws(()=>resolveImageTargets('stories',[arc],[{...chapter,arc_id:'other'}],[]));
 assert.throws(()=>resolveImageTargets('characters',[],[],[]));
 const p=resolveImageTargets('stories',[arc],[],[]);assert.equal(p[0].images.cover_image,'old.webp');
});
test('overlapping files block both owners; separate variants merge with conflict detection',()=>{
 const targets=resolveImageTargets('stories',[arc],[chapter],[]);
 assert.deepEqual([...overlappingImages([{targets,variants:['card','detail']},{targets,variants:['card']}])].sort(),[0,1]);
 assert.equal(overlappingImages([{targets,variants:['card']},{targets,variants:['detail']}]).size,0);
 const op={table:'story_arcs',key:{id:'arc'},expected:'stamp',patch:{cover_image:'a.webp'}};
 assert.deepEqual(mergeImageOperations([[op],[{...op,patch:{detail_image:'b.webp'}}]])[0].patch,{cover_image:'a.webp',detail_image:'b.webp'});
 assert.throws(()=>mergeImageOperations([[op],[op]]));
 assert.throws(()=>mergeImageOperations([[op],[{...op,expected:'changed',patch:{detail_image:'b.webp'}}]]));
});
test('conversion pads without cropping or enlarging, strips metadata, rejects unsafe inputs',async()=>{
 const raw=await sharp({create:{width:200,height:100,channels:3,background:'#f00'}}).png().toBuffer();
 const results=await prepareContentImage(raw,['card','detail']);
 assert.deepEqual(results.map(r=>[r.width,r.height]),[[640,450],[1280,900]]);
 const meta=await sharp(results[0].data).metadata();assert.equal(meta.format,'webp');assert.equal(meta.exif,undefined);
 const {data,info}=await sharp(results[0].data).raw().toBuffer({resolveWithObject:true});
 const red=(x,y)=>data[(y*info.width+x)*info.channels]>220&&data[(y*info.width+x)*info.channels+1]<40;
 assert.ok(red(320,225));assert.ok(!red(100,225));assert.ok(!red(320,100));
 await assert.rejects(prepareContentImage(Buffer.from('<svg/>'),['card']));
 await assert.rejects(prepareContentImage(Buffer.alloc(3_000_001),['card']));
 const huge=await sharp({create:{width:5000,height:5000,channels:3,background:'#fff'}}).png().toBuffer();
 await assert.rejects(prepareContentImage(huge,['card']));
});
