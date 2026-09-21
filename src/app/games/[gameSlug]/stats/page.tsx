import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getCatalog,gamePath,chapterPath} from '@/lib/catalog';
import {Breadcrumb,Rating} from '@/components/content';
export const metadata={title:'평가 통계'};
export default async function Stats({params}:{params:Promise<{gameSlug:string}>}){
 const {gameSlug}=await params;const data=await getCatalog();const game=data.games.find(g=>g.slug===gameSlug);if(!game)notFound();const overall=data.gameStats.find(g=>g.id===game.id);const arcs=data.arcs.filter(a=>a.game_id===game.id);
 return <div className="page-shell"><Breadcrumb items={[{label:game.title,href:gamePath(game)},{label:'평가 통계'}]}/><div className="page-heading"><span className="eyebrow blue">STORY RATINGS</span><h1>{game.title} 평가 통계</h1><p>공개된 장에 남긴 평가를 기준으로 집계합니다. 캐릭터 평가는 별도로 집계합니다.</p></div><div className="admin-stats"><div><span>장 전체 평균</span><strong>{overall?.count?Number(overall.average).toFixed(2):'—'}</strong></div><div><span>평가 건수</span><strong>{overall?.count??0}</strong></div><div><span>평가한 사람</span><strong>{overall?.reviewers??0}</strong></div></div><p className="muted">한 사람이 여러 장을 평가하면 평가 건수에는 각각 포함되며, 평가한 사람 수는 한 번만 셉니다. 전체 평균은 개별 별점을 모두 합산한 평균입니다.</p>{arcs.map(arc=><section className="home-section" key={arc.id}><h2>{arc.title}</h2><div className="stats-chapters">{data.chapters.filter(c=>c.arc_id===arc.id).map(chapter=>{const summary=data.summaries.find(r=>r.chapter_id===chapter.id&&r.character_id===null);return <Link href={chapterPath(data,chapter)} key={chapter.id}><span>{chapter.sort_order}장 · {chapter.title}</span><div className="stats-track" aria-hidden="true"><i style={{width:`${Number(summary?.average??0)/5*100}%`}}/></div><Rating average={summary?.average} count={summary?.count}/></Link>;})}</div></section>)}</div>;
}
