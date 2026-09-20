import {notFound} from 'next/navigation';
import {getCatalog,gamePath,arcPath,chapterPath} from '@/lib/catalog';
import {Breadcrumb} from '@/components/content';
import {ChapterExperience} from '@/components/chapter-experience';
export default async function ChapterPage({params,searchParams}:{params:Promise<{gameSlug:string;arcSlug:string;chapterSlug:string}>;searchParams:Promise<{character?:string}>}){
 const {gameSlug,arcSlug,chapterSlug}=await params;const {character}=await searchParams;const data=await getCatalog();const game=data.games.find(x=>x.slug===gameSlug);const arc=data.arcs.find(x=>x.game_id===game?.id&&x.slug===arcSlug);const chapter=data.chapters.find(x=>x.arc_id===arc?.id&&x.slug===chapterSlug);if(!game||!arc||!chapter)notFound();const appearances=data.appearances.filter(x=>x.chapter_id===chapter.id);const characters=appearances.map(a=>data.characters.find(c=>c.id===a.character_id)).filter((c):c is NonNullable<typeof c>=>!!c);
 return <div className="page-shell chapter-page"><Breadcrumb items={[{label:game.title,href:gamePath(game)},{label:arc.title,href:arcPath(game,arc)},{label:`${chapter.sort_order}장`}]}/><ChapterExperience chapter={chapter} characters={characters} initialCharacter={character} chapters={data.chapters.filter(c=>c.arc_id===arc.id).map(c=>({id:c.id,title:c.title,url:chapterPath(data,c),order:c.sort_order}))} characterBase={`${gamePath(game)}/characters`} ratingsEnabled={data.settings.ratings_enabled===true} commentsEnabled={data.settings.comments_enabled===true}/></div>;
}
