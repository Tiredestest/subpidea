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
 const results=await Promise.all([
  db.from('games').select('*').order('sort_order').order('id'),
  db.from('story_arcs').select('*').order('sort_order').order('id'),
  db.from('chapters').select('*').order('sort_order').order('id'),
  db.from('characters').select('*').order('sort_order').order('id'),
  db.from('appearances').select('chapter_id,character_id,sort_order').order('sort_order').order('character_id').limit(10000),
  db.from('rating_summary').select('*').limit(10000),
  db.from('site_settings').select('key,value'),
  db.from('game_rating_summary').select('*'),
  db.from('arc_rating_summary').select('*'),
  db.from('character_rating_summary').select('*'),
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
