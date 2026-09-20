import Link from 'next/link';
import {BookOpen} from 'lucide-react';
import {LoginButton} from '@/components/login-button';
export const metadata={title:'로그인'};
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){let enabled=false;try{const response=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!},cache:'no-store'});if(response.ok)enabled=(await response.json()).external?.google===true;}catch{}const {error}=await searchParams;return <div className="login-page"><div className="login-box"><BookOpen size={36}/><span className="eyebrow blue">섭차피디아</span><h1>당신의 감상도<br/>이야기가 됩니다.</h1><p>장과 캐릭터에 별점을 남기고,<br/>마음에 남은 순간을 함께 나눠보세요.</p><LoginButton enabled={enabled}/>{error&&<p className="form-error">로그인을 완료하지 못했어요. 다시 시도해 주세요.</p>}<Link href="/games" className="text-button">먼저 이야기 둘러보기 →</Link></div></div>;}
