'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="page-shell empty-state"><h1>잠시 이야기를 불러오지 못했어요</h1><p>연결 상태를 확인한 뒤 다시 시도해 주세요.</p><button className="button" onClick={reset}>다시 불러오기</button></div>;}
