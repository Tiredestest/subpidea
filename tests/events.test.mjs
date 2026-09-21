import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parseWorkbook,planImport} from '../src/lib/import/workbook.ts';
import {tables,cleanPatch} from '../src/lib/admin/model.ts';
const config={game:{source_id:'TEST',slug:'test',title:'test'},sheets:{
 characters:{name:'characters',headerRow:1,fields:{source_id:'id',work_number:'no',name:'name'}},
 stories:{name:'stories',headerRow:1,fields:{source_id:'id',kind:'kind',parent_id:'parent',title:'title',release_date_kr:'kr',release_date_jp:'jp',summary:'summary',published:'published'}},
 appearances:{name:'appearances',headerRow:1,fields:{story_id:'story',character_id:'person',work_number:'no',name:'name',sort_order:'order',note:'note'}}
},storyTypes:{arc:'VOL',chapter:'Chapter',event:'Event'},storyAliases:{},quarantineCharacters:{},allowEmptyAppearanceRows:[],storyImages:{EV1:{cover_image:'test/stories/EV1-card.webp',detail_image:'test/stories/EV1-detail.webp'}}};
const fixture=()=>[
 {sheet:'characters',data:[['id','no','name'],['PERSON',0,'person']]},
 {sheet:'stories',data:[['id','kind','parent','title','kr','jp','summary','published'],['EV1','Event',null,'released','2026-09-20',null,'summary'],['EV2','Event',null,'JP only',null,'2026-09-20'],['EV3','Event',null,'future','2026-10-20'],['RESERVED','Event']]},
 {sheet:'appearances',data:[['story','person','no','name','order','note'],['EV1','PERSON',0,'person'],['EV1','PERSON',0,'person']]}
];
test('events produce review targets, link images and appearances, and enforce KR visibility',()=>{
 const p=parseWorkbook(fixture(),config,'2026-09-22');assert.deepEqual(p.errors,[]);
 assert.equal(p.records.story_arcs.length,3);assert.equal(p.records.chapters.length,3);
 assert.deepEqual(p.records.story_arcs.map(x=>x.is_published),[true,false,false]);
 assert.ok(p.records.story_arcs.every(x=>x.story_kind==='event'));
 assert.equal(p.records.chapters[0].arc_source_id,'EV1');assert.equal(p.records.chapters[0].cover_image,'test/stories/EV1-card.webp');
 assert.equal(p.records.appearances.length,1);assert.equal(p.records.appearances[0].chapter_source_id,'EV1');
 assert.ok(p.warnings.some(x=>x.includes('동일한 중복')));assert.ok(p.warnings.some(x=>x.includes('빈 이벤트 예약')));
 const snapshot=Object.fromEntries(tables.map(t=>[t,[]]));const first=planImport(p,snapshot,randomUUID);
 for(const {operation:o} of first.plans)snapshot[o.table].push({...o.key,...o.patch,updated_at:'2026-09-22T00:00:00Z'});
 snapshot.story_arcs[0].is_published=false;snapshot.chapters[0].is_published=false;
 assert.deepEqual(planImport(p,snapshot,randomUUID).plans,[]);
 assert.equal(snapshot.characters[0].is_published,false);
});
test('partial events, event parents and conflicting duplicate appearances block import',()=>{
 for(const mutate of [s=>s[1].data[4][4]='2026-09-20',s=>s[1].data[1][2]='PARENT',s=>s[2].data[2][4]=99]){
  const s=fixture();mutate(s);const p=parseWorkbook(s,config,'2026-09-22');assert.ok(p.errors.length);
  assert.equal(planImport(p,Object.fromEntries(tables.map(t=>[t,[]])),randomUUID).plans.length,0);
 }
 assert.throws(()=>cleanPatch('story_arcs',{story_kind:'anything'}));
});
