'use client';
import {useState} from 'react';
import {browserDb} from '@/lib/supabase/client';
export function LoginButton({enabled}:{enabled:boolean}){const [error,setError]=useState('');const [busy,setBusy]=useState(false);return <><button className="button google-button" disabled={!enabled||busy} onClick={async()=>{setBusy(true);setError('');try{const {error}=await browserDb().auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/auth/callback'}});if(error)throw error;}catch{setError('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');setBusy(false);}}}>{busy?'Google로 이동 중…':'Google 계정으로 계속하기'}</button>{!enabled&&<p className="form-message">Google 로그인을 준비하고 있어요. 이야기 둘러보기는 바로 이용할 수 있습니다.</p>}{error&&<p role="alert" className="form-error">{error}</p>}</>;}
