import Link from 'next/link';
import Image from 'next/image';
import {ChevronRight,Star,BookOpen} from 'lucide-react';
import {media} from '@/lib/catalog';

export function Breadcrumb({items}:{items:{label:string;href?:string}[]}){
 return <nav aria-label="현재 위치" className="breadcrumbs"><Link href="/">홈</Link>{items.map((item,i)=><span key={i}><ChevronRight size={13}/>{item.href?<Link href={item.href}>{item.label}</Link>:<span aria-current="page">{item.label}</span>}</span>)}</nav>;
}
export function Rating({average,count=0,label='개 평가'}:{average?:number|string|null;count?:number;label?:string}){
 return <span className={`rating ${count?'':'empty-rating'}`}><Star size={15} fill={count?'currentColor':'none'}/>{count?<><strong>{Number(average).toFixed(1)}</strong><span>· {count.toLocaleString()}{label}</span></>:<span>아직 평가 없음</span>}</span>;
}
export function Cover({path,title,large=false}:{path:string|null;title:string;large?:boolean}){
 return <div className="cover"><Image src={media(path)} alt={title} width={large?1280:640} height={large?900:450} sizes={large?'(max-width: 800px) 100vw, 60vw':'(max-width: 600px) 80vw, 320px'} priority={large}/></div>;
}
export function ContentCard({href,image,title,kicker,description,average,count}:{href:string;image:string|null;title:string;kicker?:string;description?:string;average?:number;count?:number}){
 return <Link href={href} className="content-card"><Cover path={image} title={title}/><div className="card-copy">{kicker&&<div className="eyebrow">{kicker}</div>}<h3>{title}</h3>{description&&<p>{description}</p>}<Rating average={average} count={count}/></div></Link>;
}
export function Empty({children}:{children:React.ReactNode}){return <div className="empty-state"><BookOpen size={30}/><p>{children}</p></div>;}
export function SectionTitle({title,href,linkLabel='전체 보기',count}:{title:string;href?:string;linkLabel?:string;count?:number}){
 return <div className="section-title"><h2>{title}{count!==undefined&&<span>{count}</span>}</h2>{href&&<Link href={href}>{linkLabel}<ChevronRight size={16}/></Link>}</div>;
}
