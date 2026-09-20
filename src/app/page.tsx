import Link from 'next/link';
import Image from 'next/image';
import {ArrowUpRight,BookOpen,MessageCircle,Star,Users} from 'lucide-react';
import {getCatalog,chapterPath,gamePath,media} from '@/lib/catalog';
import {ContentCard,SectionTitle,Empty} from '@/components/content';

export default async function Home(){
 const data=await getCatalog();
 const recent=[...data.chapters].sort((a,b)=>(b.release_date_kr??'').localeCompare(a.release_date_kr??'')||a.id.localeCompare(b.id)).slice(0,Number(data.settings.home_recent_limit)||6);
 const featured=recent[0];
 return <div className="page-shell home"><section className="home-hero"><div className="hero-copy"><div className="eyebrow blue">게임 속 이야기의 기록</div><h1>끝난 이야기에도<br/><em>감상은 계속되니까.</em></h1><p>마음에 남은 장면, 오래 기억할 캐릭터.<br/>좋아하는 이야기를 만나고 나만의 감상을 남겨보세요.</p><Link href="/games" className="button">이야기 둘러보기 <ArrowUpRight size={18}/></Link><div className="hero-caption"><span/> 한국 공개 스토리를 기준으로 만나요</div></div>{featured?<Link href={chapterPath(data,featured)} className="hero-feature"><Image src={media(featured.detail_image)} alt={featured.title} fill sizes="(max-width:800px) 100vw, 55vw" priority/><div className="hero-feature-copy"><span>지금 만날 수 있는 이야기</span><h2>{featured.title}</h2><span>{data.arcs.find(x=>x.id===featured.arc_id)?.title} <ArrowUpRight size={17}/></span></div></Link>:<Empty>아직 공개된 이야기가 없어요.</Empty>}</section>
 <section className="home-section"><SectionTitle title="최근 공개된 이야기" href="/search" linkLabel="이야기 찾기"/><div className="card-grid three">{recent.map(chapter=>{const rating=data.summaries.find(x=>x.chapter_id===chapter.id&&!x.character_id);return <ContentCard key={chapter.id} href={chapterPath(data,chapter)} image={chapter.cover_image} title={chapter.title} kicker={data.arcs.find(x=>x.id===chapter.arc_id)?.title} average={rating?.average} count={rating?.count}/>;})}</div></section>
 <section className="home-section"><SectionTitle title="게임으로 둘러보기" href="/games"/><div className="game-list">{[...data.games].sort((a,b)=>(data.gameStats.find(x=>x.id===b.id)?.count??0)-(data.gameStats.find(x=>x.id===a.id)?.count??0)).slice(0,Number(data.settings.home_popular_game_limit)||6).map(game=><Link href={gamePath(game)} className="game-list-card" key={game.id}><Image src={media(game.cover_image)} alt="" width={160} height={112}/><div><span className="eyebrow">GAME STORIES</span><h3>{game.title}</h3><p>{data.arcs.filter(x=>x.game_id===game.id).length}개 편 · {data.chapters.filter(x=>x.game_id===game.id).length}개 장</p></div><ArrowUpRight size={22}/></Link>)}</div></section>
 <section className="community-strip"><div><BookOpen size={26}/><h2>함께 쌓아가는<br/>이야기의 기록</h2></div><div><Star size={20}/><strong>{data.community.ratings.toLocaleString()}</strong><span>남겨진 평가</span></div><div><MessageCircle size={20}/><strong>{data.community.comments.toLocaleString()}</strong><span>나누는 감상</span></div><div><Users size={20}/><strong>{data.characters.length}</strong><span>만날 수 있는 캐릭터</span></div></section></div>;
}
