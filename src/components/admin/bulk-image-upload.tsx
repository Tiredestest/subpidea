'use client';
import {useEffect,useState} from 'react';
import Image from 'next/image';
import {applyAdminBatch} from '@/app/admin/actions';
import {mergeImageOperations,overlappingImages,variantFields,type ImageKind,type ImagePreview} from '@/lib/bulk-images';
import type {Operation} from '@/lib/admin/model';
type Entry={file:File;preview?:ImagePreview;error?:string};
const labels:Record<string,string>={card:'목록',detail:'상세',avatar:'썸네일',portrait:'상세'};
function LocalImage({file}:{file:File}){
 const [url,setUrl]=useState('');
 useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return ()=>URL.revokeObjectURL(next);},[file]);
 return url?<Image src={url} alt="업로드할 원본" width={96} height={72} unoptimized className="bulk-image-preview"/>:null;
}
export function BulkImageUpload({games}:{games:{id:string;title:string}[]}){
 const [game,setGame]=useState(games[0]?.id??'');const [kind,setKind]=useState<ImageKind>('stories');
 const [rows,setRows]=useState<Entry[]>([]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [confirmed,setConfirmed]=useState(false);
 const conflicts=overlappingImages(rows.map(r=>r.preview));
 const valid=rows.filter((r,i)=>r.preview&&!r.error&&!conflicts.has(i));
 const unchecked=rows.some(r=>!r.preview&&!r.error);
 function reset(){setRows([]);setConfirmed(false);setMessage('');}
 function addFiles(files:File[]){
  if(busy)return;
  if(rows.length+files.length>100){setMessage('한 번에 최대 100개 파일을 선택해 주세요.');return;}
  if([...rows.map(r=>r.file),...files].reduce((sum,f)=>sum+f.size,0)>100_000_000){setMessage('선택한 원본의 합계는 100MB 이하여야 합니다. 나누어 올려 주세요.');return;}
  setRows(old=>[...old,...files.map(file=>({file}))]);setConfirmed(false);setMessage('');
 }
 async function send(row:Entry,mode:'preview'|'upload'){
  const form=new FormData();form.set('image',row.file);form.set('game_id',game);form.set('kind',kind);form.set('mode',mode);
  if(mode==='upload')form.set('expected',JSON.stringify(row.preview));
  const response=await fetch('/api/admin/bulk-images',{method:'POST',body:form});
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('요청을 처리하지 못했습니다. 로그인 상태와 파일 크기를 확인해 주세요.');
  const result=await response.json();if(!response.ok)throw Error(result.error??'처리 실패');return result;
 }
 async function inspect(){
  setBusy(true);setConfirmed(false);const next:Entry[]=[];
  try{for(const [index,row] of rows.entries()){
   setMessage(`파일 검사 ${index+1} / ${rows.length}`);
   try{if(!row.file.size||row.file.size>3_000_000)throw Error('파일 하나당 3MB 이하로 선택해 주세요.');const result=await send(row,'preview');next.push({file:row.file,preview:result.preview});}
   catch(e){next.push({file:row.file,error:e instanceof Error?e.message:'검사 실패'});}
  }setRows(next);setMessage('검사가 끝났습니다. 연결 대상과 교체 여부를 확인해 주세요.');}finally{setBusy(false);}
 }
 async function apply(){
  if(busy||!confirmed||unchecked||!valid.length)return;
  setBusy(true);setConfirmed(false);
  try{
   const groups:Operation[][]=[];
   for(const [index,row] of valid.entries()){setMessage(`이미지 준비 ${index+1} / ${valid.length} · 완료 전에는 연결이 바뀌지 않습니다.`);const result=await send(row,'upload');groups.push(result.operations);}
   setMessage('이미지 연결을 저장하는 중…');const result=await applyAdminBatch(mergeImageOperations(groups));
   if(!result.ok)throw Error(result.error);
   setRows(rows.filter(r=>!valid.includes(r)));setMessage(`${valid.length}개 파일의 이미지 연결을 완료했습니다. 제외된 오류 파일은 목록에 남겨 두었습니다.`);
  }catch(e){setMessage(`${e instanceof Error?e.message:'적용 실패'} 연결 완료가 확인되지 않았습니다. 다시 검사한 후 재시도해 주세요.`);}
  finally{setBusy(false);}
 }
 return <section className="admin-section">
  <h2>이미지 일괄 업로드</h2><p>Excel을 먼저 적용한 뒤, ID로 이름 붙인 이미지를 선택하세요. 파일 검사 → 연결·교체 확인 → 정상 항목 적용 순서로 진행합니다.</p>
  <fieldset disabled={busy} className="bulk-image-controls">
   <label>게임<select value={game} onChange={e=>{setGame(e.target.value);reset();}}>{games.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
   <label>대상 종류<select value={kind} onChange={e=>{setKind(e.target.value as ImageKind);reset();}}><option value="stories">스토리 (메인·이벤트)</option><option value="characters">캐릭터</option></select></label>
   <div className="bulk-image-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addFiles(Array.from(e.dataTransfer.files));}}>
    <label>이미지 여러 장 선택 또는 여기에 끌어 놓기<input key={`${game}:${kind}`} type="file" multiple accept=".png,.jpg,.jpeg,.webp" onChange={e=>{addFiles(Array.from(e.target.files??[]));e.target.value='';}}/></label>
    <p>PNG·JPG·JPEG·WebP / 파일당 3MB / 최대 100개·총 100MB</p>
   </div>
   <p>{kind==='stories'?'BA_EV001.png → 목록·상세 생성. 각각 지정하려면 BA_EV001-card.png / BA_EV001-detail.png':'BA_C_001.png → 썸네일·상세 생성. 각각 지정하려면 BA_C_001-avatar.png / BA_C_001-portrait.png'}</p>
   <button className="button" type="button" disabled={!rows.length||!game} onClick={inspect}>파일 검사</button>{rows.length>0&&<button className="button secondary" type="button" onClick={reset}>목록 비우기</button>}
  </fieldset>
  <p role="status" aria-live="polite">{message}</p>
  {!!rows.length&&<>
   <p>선택 {rows.length}개 · 정상 {valid.length}개 · 오류·중복 {rows.filter((r,i)=>r.error||conflicts.has(i)).length}개</p>
   <div className="table-scroll"><table className="bulk-image-table"><thead><tr><th>파일</th><th>연결 대상</th><th>적용 내용</th><th>상태</th></tr></thead><tbody>{rows.map((row,index)=><tr key={`${row.file.name}:${index}`}>
    <td><LocalImage file={row.file}/><div>{row.file.name}</div><small>{Math.ceil(row.file.size/1024)}KB</small></td>
    <td>{row.preview?<>{row.preview.targets[0].label}<br/><code>{row.preview.sourceId}</code>{row.preview.targets.length===2&&<p>이벤트 목록·상세에 함께 연결</p>}</>:'—'}</td>
    <td>{row.preview?.outputs.map(o=><p key={o.variant}>{labels[o.variant]} {o.width}×{o.height} · {Math.ceil(o.bytes/1024)}KB · <strong>{row.preview!.targets.some(t=>t.images[variantFields[o.variant]])?'기존 이미지 교체':'신규 연결'}</strong></p>)}</td>
    <td>{row.error?<span className="form-error">{row.error}</span>:conflicts.has(index)?<span className="form-error">같은 대상·용도의 파일이 중복됩니다. 하나를 제거하세요.</span>:row.preview?'정상':'검사 전'}<br/><button className="text-button" type="button" disabled={busy} onClick={()=>{setRows(old=>old.filter((_,i)=>i!==index));setConfirmed(false);}}>제거</button></td>
   </tr>)}</tbody></table></div>
   <label className="bulk-image-confirm"><input type="checkbox" checked={confirmed} disabled={busy||unchecked||!valid.length} onChange={e=>setConfirmed(e.target.checked)}/>정상 {valid.length}개 파일의 연결 대상과 기존 이미지 교체를 확인했습니다. 오류·중복 파일은 제외합니다.</label>
   <button className="button" type="button" disabled={busy||unchecked||!confirmed||!valid.length} onClick={apply}>{busy?'처리 중…':`정상 ${valid.length}개 적용`}</button>
  </>}
  <p className="admin-help">원본 비율을 유지하며 WebP로 변환합니다. 같은 용도의 파일이 겹치면 적용에서 제외합니다. 공개 여부는 변경하지 않습니다. 교체 전 이미지 파일과 변경 기록은 보존됩니다.</p>
 </section>;
}
