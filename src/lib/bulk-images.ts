import type {Operation,Row} from './admin/model.ts';
export type ImageKind='stories'|'characters';
export type Variant='card'|'detail'|'avatar'|'portrait';
export type ImageTarget={table:'story_arcs'|'chapters'|'characters';id:string;label:string;expected:string;images:Record<string,string|null>};
export type ImagePreview={sourceId:string;variants:Variant[];targets:ImageTarget[];sha256:string;outputs:{variant:Variant;width:number;height:number;bytes:number}[]};
export const variantFields:Record<Variant,string>={card:'cover_image',detail:'detail_image',avatar:'thumbnail',portrait:'image'};
export function imageName(name:string,kind:ImageKind){
 const match=/^([A-Za-z0-9_-]+)\.(png|jpe?g|webp)$/i.exec(name);
 if(!match)throw Error('파일명은 ID.png / ID.jpg / ID.webp 형식이어야 합니다.');
 let sourceId=match[1];const suffix=/-(card|detail|avatar|portrait)$/.exec(sourceId);
 const defaults:Variant[]=kind==='stories'?['card','detail']:['avatar','portrait'];
 const variants:Variant[]=suffix?[suffix[1] as Variant]:defaults;
 if(suffix)sourceId=sourceId.slice(0,-suffix[0].length);
 if(!sourceId||sourceId.length>80||variants.some(v=>!defaults.includes(v)))throw Error('선택한 대상 종류와 파일명 접미사가 맞지 않습니다.');
 return {sourceId,variants};
}
export function resolveImageTargets(kind:ImageKind,arcs:Row[],chapters:Row[],characters:Row[]):ImageTarget[]{
 let matches:{table:ImageTarget['table'];row:Row}[];
 if(kind==='characters')matches=characters.map(row=>({table:'characters',row}));
 else {
  if(arcs.length&&chapters.length&&!(arcs.length===1&&chapters.length===1&&arcs[0].story_kind==='event'&&chapters[0].arc_id===arcs[0].id))throw Error('같은 ID가 여러 스토리에 있습니다. 연결 대상을 확인해 주세요.');
  matches=[...arcs.map(row=>({table:'story_arcs' as const,row})),...chapters.map(row=>({table:'chapters' as const,row}))];
 }
 if(!matches.length)throw Error('등록된 ID가 없습니다. Excel을 먼저 적용해 주세요.');
 if(kind==='characters'&&matches.length!==1)throw Error('캐릭터 ID가 중복입니다.');
 return matches.map(({table,row})=>({table,id:String(row.id),label:String(row.title??row.name),expected:String(row.updated_at),images:Object.fromEntries((kind==='stories'?['cover_image','detail_image']:['thumbnail','image']).map(f=>[f,typeof row[f]==='string'?row[f]:null]))}));
}
export function overlappingImages(previews:(ImagePreview|undefined)[]){
 const owners=new Map<string,number>();const conflicts=new Set<number>();
 previews.forEach((p,i)=>p?.targets.forEach(t=>p.variants.forEach(v=>{const key=`${t.table}:${t.id}:${variantFields[v]}`;const old=owners.get(key);if(old!==undefined){conflicts.add(old);conflicts.add(i);}else owners.set(key,i);})));return conflicts;
}
export function mergeImageOperations(groups:Operation[][]){
 const merged=new Map<string,Operation>();
 for(const op of groups.flat()){
  const key=`${op.table}:${op.key.id}`;const old=merged.get(key);
  if(!old){merged.set(key,{...op,patch:{...op.patch}});continue;}
  if(old.expected!==op.expected)throw Error('검사 이후 변경된 대상이 있습니다. 다시 검사해 주세요.');
  for(const field of Object.keys(op.patch))if(field in old.patch)throw Error('같은 이미지 용도가 중복되었습니다.');
  Object.assign(old.patch,op.patch);
 }
 return [...merged.values()];
}
