import Link from 'next/link';
import Image from 'next/image';
import {notFound} from 'next/navigation';
import {getCatalog,gamePath,characterPath,media} from '@/lib/catalog';
import {Breadcrumb,Rating} from '@/components/content';
export default async function Characters({params,searchParams}:{params:Promise<{gameSlug:string}>;searchParams:Promise<{q?:string}>}){
 const {gameSlug}=await params;const {q=''}=await searchParams;const data=await getCatalog();const game=data.games.find(x=>x.slug===gameSlug);if(!game)notFound();const characters=data.characters.filter(x=>x.game_id===game.id&&x.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()));
 return <div className="page-shell"><Breadcrumb items={[{label:game.title,href:gamePath(game)},{label:'캐릭터'}]}/><div className="page-heading"><span className="eyebrow blue">CHARACTERS</span><h1>이야기를 빛내는 얼굴들</h1><p>{game.title}의 공개된 장에서 만나는 캐릭터입니다.</p></div><form className="search-form"><input name="q" defaultValue={q} aria-label="캐릭터 이름 검색" placeholder="캐릭터 이름을 검색하세요" maxLength={100}/><button className="button">검색</button></form><div className="character-grid">{characters.map(character=>{const stats=data.characterStats.find(x=>x.id===character.id);return <Link key={character.id} href={characterPath(game,character)} className="character-card"><Image src={media(character.image)} alt={character.name} width={512} height={512}/><h3>{character.name}</h3><Rating average={stats?.average} count={stats?.count}/></Link>;})}</div>{!characters.length&&<p className="empty-state">검색된 캐릭터가 없어요.</p>}</div>;
}
