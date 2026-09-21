import Link from 'next/link';
import {redirect} from 'next/navigation';
import {userDb} from '@/lib/supabase/server';
import {getCatalog,chapterPath,gamePath} from '@/lib/catalog';
import {NicknameForm,FollowButton} from '@/components/member-controls';
export const metadata={title:'마이페이지'};
export default async function MyPage({searchParams}:{searchParams:Promise<{tab?:string;page?:string}>}){
 const db=await userDb();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const params=await searchParams;const tab=params.tab==='comments'?'comments':params.tab==='follows'?'follows':'ratings';const page=Math.max(1,Math.min(10000,Math.floor(Number(params.page)||1)));const size=20;
 const [catalog,profile,ratingsCount,commentsCount,followsCount,items]=await Promise.all([
 getCatalog(),db.from('profiles').select('display_name').eq('id',user.id).maybeSingle(),
 db.from('ratings').select('id',{count:'exact',head:true}).eq('user_id',user.id),
 db.from('comments').select('id',{count:'exact',head:true}).eq('user_id',user.id),
 db.from('game_follows').select('game_id',{count:'exact',head:true}).eq('user_id',user.id),
 db.from(tab==='comments'?'comment_feed':tab==='follows'?'game_follows':'ratings').select('*',{count:'exact'}).eq('user_id',user.id).order('created_at',{ascending:false}).order(tab==='follows'?'game_id':'id').range((page-1)*size,page*size-1)
 ]);
 if([profile,ratingsCount,commentsCount,followsCount,items].some(r=>r.error))throw Error('내 기록을 불러오지 못했습니다.');
 const count=items.count??0;
 return <div className="page-shell member-page"><div className="page-heading"><h1>마이페이지</h1><p>내 평가와 한줄평, 관심 있는 게임을 모아보세요.</p></div>
 <NicknameForm initial={profile.data?.display_name??`독자 ${user.id.slice(0,6)}`}/>
 {user.app_metadata?.role==='admin'&&<Link className="text-button" href="/admin">관리자 화면 →</Link>}
 <nav className="tabs" aria-label="내 활동"><Link href="/me?tab=ratings" className={tab==='ratings'?'active':''}>평가 {ratingsCount.count??0}</Link><Link href="/me?tab=comments" className={tab==='comments'?'active':''}>한줄평 {commentsCount.count??0}</Link><Link href="/me?tab=follows" className={tab==='follows'?'active':''}>팔로우 {followsCount.count??0}</Link></nav>
 <p className="muted">평가·한줄평은 현재 공개 중인 대상의 기록을 표시합니다.</p>
 <div className="member-records">{!items.data?.length&&<p className="empty-state">아직 기록이 없습니다.</p>}{items.data?.map(row=>{
 if(tab==='follows'){const game=catalog.games.find(g=>g.id===row.game_id);return <article className="member-record" key={row.game_id}><div>{game?<Link href={gamePath(game)}>{game.title}</Link>:<span>현재 비공개인 게임</span>}</div><FollowButton gameId={row.game_id} initial signedIn/></article>;}
 const chapter=catalog.chapters.find(c=>c.id===row.chapter_id);const character=catalog.characters.find(c=>c.id===row.character_id);const url=chapter?chapterPath(catalog,chapter)+(character?`?character=${encodeURIComponent(character.slug)}`:''):null;
 return <article className="member-record" key={row.id}><div><span className="eyebrow">{row.character_id?'캐릭터 평가':'장 평가'}</span><h2>{url?<Link href={url}>{chapter?.title}{character?` · ${character.name}`:''}</Link>:'현재 비공개인 대상'}</h2><time>{row.created_at.slice(0,10)}</time>{tab==='comments'&&<p className="member-comment">{row.body}</p>}{url&&<Link className="text-button" href={url}>원문에서 수정하기 →</Link>}</div>{row.score!=null&&<strong className="member-score">★ {Number(row.score).toFixed(1)}</strong>}</article>;
 })}</div>
 {count>size&&<nav className="pagination" aria-label="내 기록 페이지">{page>1&&<Link href={`/me?tab=${tab}&page=${page-1}`}>이전</Link>}<span>{page} / {Math.ceil(count/size)}</span>{page*size<count&&<Link href={`/me?tab=${tab}&page=${page+1}`}>다음</Link>}</nav>}
 </div>;
}
