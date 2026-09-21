import 'server-only';
import {cache} from 'react';
import {publicDb} from './supabase/server';

export type Game={id:string;slug:string;title:string;description:string;cover_image:string|null;hero_image:string|null;sort_order:number};
export type Arc={id:string;game_id:string;slug:string;title:string;summary:string;cover_image:string|null;detail_image:string|null;sort_order:number;release_date_kr:string|null};
export type Chapter=Omit<Arc,'game_id'>&{game_id:string;arc_id:string;published_at:string|null};
export type Character={id:string;game_id:string;slug:string;name:string;description:string;image:string|null;thumbnail:string|null;sort_order:number};
export type Appearance={chapter_id:string;character_id:string;sort_order:number};
export type Summary={chapter_id:string;character_id:string|null;average:number;count:number};
export type Aggregate={id:string;average:number;count:number;reviewers:number};

export const getCatalog=cache(async()=>{
 const db=publicDb();
 async function all(table:string,orders:string[]){const rows:unknown[]=[];for(let start=0;;start+=500){let query=db.from(table).select('*');for(const column of orders)query=query.order(column,{ascending:true,nullsFirst:true});const {data,error}=await query.range(start,start+499);if(error)return {data:null,error};rows.push(...data);if(data.length<500)return {data:rows,error:null};if(rows.length>50000)throw Error('카탈로그 조회 범위를 초과했습니다.');}}
 const results=await Promise.all([
  all('games',['sort_order','id']),
  all('story_arcs',['sort_order','id']),
  all('chapters',['sort_order','id']),
  all('characters',['sort_order','id']),
  all('appearances',['chapter_id','sort_order','character_id']),
  all('rating_summary',['chapter_id','character_id']),
  db.from('site_settings').select('key,value'),
  all('game_rating_summary',['id']),
  all('arc_rating_summary',['id']),
  all('character_rating_summary',['id']),
  db.from('community_stats').select('*').single(),
 ]);
 const failure=results.find(r=>r.error);if(failure?.error)throw new Error('콘텐츠를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
 return {games:results[0].data as Game[],arcs:results[1].data as Arc[],chapters:results[2].data as Chapter[],characters:results[3].data as Character[],appearances:results[4].data as Appearance[],summaries:results[5].data as Summary[],settings:Object.fromEntries((results[6].data as {key:string;value:unknown}[]).map(x=>[x.key,x.value])),gameStats:results[7].data as Aggregate[],arcStats:results[8].data as Aggregate[],characterStats:results[9].data as Aggregate[],community:results[10].data as unknown as {ratings:number;comments:number}};
});
export type Catalog=Awaited<ReturnType<typeof getCatalog>>;
export function gamePath(game:Game){return `/games/${game.slug}`;}
export function arcPath(game:Game,arc:Arc){return `${gamePath(game)}/arcs/${arc.slug}`;}
export function chapterPath(data:Catalog,chapter:Chapter){const game=data.games.find(x=>x.id===chapter.game_id)!;const arc=data.arcs.find(x=>x.id===chapter.arc_id)!;return `${arcPath(game,arc)}/chapters/${chapter.slug}`;}
export function characterPath(game:Game,character:Character){return `${gamePath(game)}/characters/${character.slug}`;}
export function media(path:string|null){return path?`/media/${path.split('/').map(encodeURIComponent).join('/')}`:'/placeholder.svg';}
export function dateLabel(date:string|null){return date?date.replaceAll('-','.'): '공개일 미정';}
