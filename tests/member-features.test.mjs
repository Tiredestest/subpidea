import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {nickname} from '../src/lib/member-validation.ts';
import {prepareHeader} from '../src/lib/header-image.ts';
test('nickname trims, normalizes and rejects control characters and invalid lengths',()=>{
 assert.equal(nickname('  독자 이름  '),'독자 이름');
 for(const invalid of ['', 'a','a'.repeat(25),'이름\n위조','숨김\u200b이름',null])assert.throws(()=>nickname(invalid));
});
test('header conversion preserves aspect ratio, limits size and removes metadata',async()=>{
 const source=await sharp({create:{width:2000,height:1000,channels:3,background:'#aaccff'}}).jpeg().toBuffer();
 const result=await prepareHeader(source);const meta=await sharp(result).metadata();
 assert.equal(meta.format,'webp');assert.equal(meta.width,1600);assert.equal(meta.height,800);assert.equal(meta.exif,undefined);
 const small=await sharp({create:{width:320,height:200,channels:3,background:'#ffffff'}}).png().toBuffer();
 assert.equal((await sharp(await prepareHeader(small)).metadata()).width,320);
});
test('header conversion rejects unsupported or oversized input',async()=>{
 await assert.rejects(()=>prepareHeader(Buffer.from('<svg width="20" height="20"></svg>')));
 await assert.rejects(()=>prepareHeader(Buffer.alloc(3_000_001)));
 await assert.rejects(()=>prepareHeader(Buffer.from('not an image')));
});
