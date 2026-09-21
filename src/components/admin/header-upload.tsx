"use client";
import {useState} from 'react';
export function HeaderUpload({games}:{games:{id:string;title:string}[]}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[path,setPath]=useState('');
 return <section className="admin-section"><h2>게임 헤더 이미지 준비</h2><p>이미지를 업로드한 뒤 아래 경로를 Excel의 GAMES 시트에 넣어 반영합니다. 업로드만으로 현재 헤더가 바뀌지는 않습니다.</p>
 <form className="admin-upload" onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);setBusy(true);setPath('');setMessage('');try{const response=await fetch('/api/admin/images',{method:'POST',body:data});const result=await response.json();if(!response.ok)throw Error(result.error);setPath(result.path);setMessage(`업로드 완료 · ${Math.round(result.bytes/1024)}KB`);}catch(e){setMessage(e instanceof Error?e.message:'업로드 실패');}finally{setBusy(false);}}}><fieldset disabled={busy}><label>게임<select name="game_id" required>{games.map(g=><option value={g.id} key={g.id}>{g.title}</option>)}</select></label><label>헤더 이미지 (3MB 이하)<input type="file" name="image" accept="image/jpeg,image/png,image/webp" required/></label><button className="button">{busy?'이미지 처리 중…':'업로드하고 경로 만들기'}</button></fieldset></form>
 <p role="status">{message}</p>{path&&<label>Excel에 넣을 이미지 경로<input className="image-path-result" readOnly value={path} onFocus={e=>e.currentTarget.select()}/></label>}
 <h3>Excel GAMES 시트</h3><p>1행에 아래 세 열을 만들고, 2행에 현재 게임 정보를 넣습니다. 비워 둔 이미지 열은 기존 값을 유지합니다.</p><div className="table-scroll"><table><thead><tr><th>source_id</th><th>hero_image</th><th>cover_image</th></tr></thead><tbody><tr><td>BA</td><td>위에서 생성한 경로</td><td>비워 두면 유지</td></tr></tbody></table></div><p>Excel 가져오기에서 파일 검사 → 이미지 경로 변경 확인 → 일괄 적용 순서로 진행합니다. 원본 이미지 파일은 별도로 보관해 주세요.</p>
 </section>;
}
