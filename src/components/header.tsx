import Link from 'next/link';
import {BookOpen,Search} from 'lucide-react';
import {userDb} from '@/lib/supabase/server';
export async function Header(){
 const db=await userDb();const {data:{user}}=await db.auth.getUser();
 return <header className="site-header"><div className="header-inner"><Link href="/" className="brand"><BookOpen size={28} strokeWidth={2.2}/><span>섭차피디아</span></Link><nav className="main-nav"><Link href="/games">게임</Link><Link href="/search">이야기 찾기</Link></nav><form action="/search" className="header-search"><Search size={18}/><input name="q" aria-label="게임, 편, 장, 캐릭터 검색" placeholder="어떤 이야기를 찾고 있나요?" maxLength={100}/></form>{user?<form action="/auth/signout" method="post"><button className="button subtle">로그아웃</button></form>:<Link className="button small" href="/login">로그인</Link>}</div></header>;
}
