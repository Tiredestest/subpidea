"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {Row,Table} from '@/lib/admin/model';
import {manageAppearance} from '@/app/admin/actions';
export function AppearanceManager({data}:{data:Record<Table,Row[]>}){
 const [game,setGame]=useState(String(data.games[0]?.id??'')),[chapter,setChapter]=useState(''),[query,setQuery]=useState('');
 const chapters=data.chapters.filter(r=>r.game_id===game);const chars=data.characters.filter(r=>r.game_id===game);const appearances=data.appearances.filter(r=>r.chapter_id===chapter).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
 const available=chars.filter(c=>!appearances.some(a=>a.character_id===c.id));
 return <section className="admin-section"><h2>장의 등장 캐릭터 관리</h2><p>제외한 연결은 복원할 수 있습니다. 교체할 때 기존 평가·한줄평은 원래 캐릭터에 보존되며 새 캐릭터로 이동하지 않습니다.</p><div className="admin-filters"><label>게임<select value={game} onChange={e=>{setGame(e.target.value);setChapter('');}}>{data.games.map(g=><option value={String(g.id)} key={String(g.id)}>{String(g.title)}</option>)}</select></label><label>장<select value={chapter} onChange={e=>setChapter(e.target.value)}><option value="">장을 선택하세요</option>{chapters.map(c=><option key={String(c.id)} value={String(c.id)}>{String(c.source_id)} · {String(c.title)}</option>)}</select></label><label>등록된 캐릭터 검색<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="이름 또는 ID"/></label></div>
 {chapter&&<><AppearanceEditor key={`new-${chapter}-${appearances.length}`} chapter={chapter} available={available}/><div className="appearance-editor-list">{appearances.filter(a=>{const c=chars.find(c=>c.id===a.character_id);return `${c?.name} ${c?.source_id}`.toLowerCase().includes(query.toLowerCase());}).map(a=><AppearanceEditor key={`${a.character_id}-${a.updated_at}`} chapter={chapter} row={a} name={String(chars.find(c=>c.id===a.character_id)?.name??a.character_id)} available={available}/>)}</div></>}
 </section>;
}
function AppearanceEditor({chapter,row,name,available}:{chapter:string;row?:Row;name?:string;available:Row[]}){
 const router=useRouter();const [person,setPerson]=useState(''),[position,setPosition]=useState(Number(row?.sort_order??0)),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const run=async(active:boolean,replace=false)=>{setBusy(true);setMessage('');try{const result=await manageAppearance({chapter,person:String(row?.character_id??person),newPerson:replace?person:null,active,position,expected:row?String(row.updated_at):null});setMessage(result.ok?'반영했습니다.':result.error??'저장 실패');if(result.ok)router.refresh();}catch{setMessage('연결을 확인해 주세요.');}finally{setBusy(false);}};
 return <div className="appearance-editor"><h3>{row?name:'캐릭터 추가'}{row?.is_active===false&&<span className="muted"> · 제외됨</span>}</h3><label>표시 순서<input type="number" min={0} max={100000} value={position} disabled={busy} onChange={e=>setPosition(Number(e.target.value))}/></label>
 <label>{row?'교체할 새 캐릭터':'추가할 캐릭터'}<select value={person} disabled={busy} onChange={e=>setPerson(e.target.value)}><option value="">캐릭터 선택</option>{available.map(c=><option key={String(c.id)} value={String(c.id)}>{String(c.name)} · {String(c.source_id)}{!c.is_published?' (비공개)':''}</option>)}</select></label>
 <div className="appearance-actions">{row?<><button className="button small" disabled={busy} onClick={()=>run(row.is_active!==false)}>순서 저장</button><button className="button subtle" disabled={busy} onClick={()=>run(row.is_active===false)}>{row.is_active===false?'복원':'등장 목록에서 제외'}</button>{row.is_active!==false&&<button className="button subtle" disabled={busy||!person} onClick={()=>run(true,true)}>선택한 캐릭터로 교체</button>}</>:<button className="button small" disabled={busy||!person} onClick={()=>run(true)}>등장 캐릭터 추가</button>}</div><p role="status">{message}</p></div>;
}
