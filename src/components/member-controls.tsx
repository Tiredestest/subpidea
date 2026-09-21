"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {saveNickname,followGame} from '@/app/actions';
export function NicknameForm({initial}:{initial:string}){
 const [value,setValue]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const router=useRouter();
 return <form className="nickname-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const result=await saveNickname(value);setMessage(result.ok?'닉네임을 저장했습니다.':result.error??'저장 실패');if(result.ok)router.refresh();}catch{setMessage('연결을 확인하고 다시 시도해 주세요.');}finally{setBusy(false);}}}>
 <label>닉네임<input value={value} onChange={e=>setValue(e.target.value)} maxLength={48} minLength={2} required disabled={busy}/></label><button className="button small" disabled={busy}>{busy?'저장 중…':'닉네임 저장'}</button><p className="muted">2~24자 · 작성한 한줄평에도 변경된 이름이 표시됩니다.</p><p role="status">{message}</p></form>;
}
export function FollowButton({gameId,initial,signedIn}:{gameId:string;initial:boolean;signedIn:boolean}){
 const [following,setFollowing]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 if(!signedIn)return <Link href="/login" className="button subtle">로그인하고 팔로우</Link>;
 return <div className="follow-control"><button className="button subtle" aria-pressed={following} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const result=await followGame(gameId,!following);if(result.ok){setFollowing(!following);router.refresh();}else setError(result.error??'변경 실패');}catch{setError('연결을 확인해 주세요.');}finally{setBusy(false);}}}>{busy?'저장 중…':following?'팔로우 중 · 해제':'게임 팔로우'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
