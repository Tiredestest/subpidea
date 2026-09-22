import {requireAdmin} from '@/lib/admin/server';
import {imageName,resolveImageTargets,variantFields,type ImageKind,type ImagePreview} from '@/lib/bulk-images';
import {prepareContentImage} from '@/lib/prepare-content-image';
import {createHash} from 'node:crypto';
export const runtime='nodejs';
export const maxDuration=60;
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 let admin;try{admin=await requireAdmin();}catch{return reply({error:'관리자 로그인이 필요합니다.'},403);}
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'요청 출처를 확인해 주세요.'},403);
 try{
  if(Number(request.headers.get('content-length'))>3_100_000)throw Error('파일 하나당 3MB 이하로 선택해 주세요.');
  const form=await request.formData();const file=form.get('image');const kind=form.get('kind') as ImageKind;const mode=form.get('mode');
  if(!(file instanceof File)||file.size>3_000_000||!['stories','characters'].includes(kind)||!['preview','upload'].includes(String(mode)))throw Error('파일·대상 종류·요청을 확인해 주세요.');
  const {sourceId,variants}=imageName(file.name,kind);
  const {data:game,error:gameError}=await admin.db.from('games').select('id,slug').eq('id',String(form.get('game_id'))).single();
  if(gameError||!game)throw Error('등록된 게임을 선택해 주세요.');
  const tables=kind==='stories'?['story_arcs','chapters']:['characters'];
  const results=await Promise.all(tables.map(t=>admin.db.from(t).select('*').eq('game_id',game.id).eq('source_id',sourceId)));
  if(results.some(r=>r.error))throw Error('연결 대상을 조회하지 못했습니다.');
  const targets=resolveImageTargets(kind,kind==='stories'?results[0].data??[]:[],kind==='stories'?results[1].data??[]:[],kind==='characters'?results[0].data??[]:[]);
  const bytes=Buffer.from(await file.arrayBuffer());const sha256=createHash('sha256').update(bytes).digest('hex');
  if(mode==='upload'){
   const expected=JSON.parse(String(form.get('expected')??'null')) as ImagePreview|null;
   if(!expected||expected.sha256!==sha256||expected.sourceId!==sourceId||JSON.stringify(expected.targets)!==JSON.stringify(targets)||JSON.stringify(expected.variants)!==JSON.stringify(variants))return reply({error:'파일 또는 연결 대상이 검사 이후 변경되었습니다. 다시 검사해 주세요.'},409);
  }
  const outputs=await prepareContentImage(bytes,variants);
  const preview:ImagePreview={sourceId,variants,targets,sha256,outputs:outputs.map(o=>({variant:o.variant,width:o.width,height:o.height,bytes:o.data.length}))};
  if(mode==='preview')return reply({preview});
  const paths:Record<string,string>={};
  for(const output of outputs){
   const filename=`ASSET_${createHash('sha256').update(output.data).digest('hex')}_${output.variant}.webp`;const folder=`${game.slug}/${kind}`;const path=`${folder}/${filename}`;
   const {data:existing,error:lookupError}=await admin.db.storage.from('content').list(folder,{search:filename,limit:10});
   if(lookupError)throw Error('이미지 저장소를 확인하지 못했습니다.');
   if(!existing?.some(x=>x.name===filename)){
    const {error}=await admin.db.storage.from('content').upload(path,output.data,{contentType:'image/webp',upsert:false});
    if(error){const check=await admin.db.storage.from('content').list(folder,{search:filename,limit:10});if(check.error||!check.data?.some(x=>x.name===filename))throw Error('이미지 저장에 실패했습니다. 다시 시도해 주세요.');}
   }
   paths[variantFields[output.variant]]=path;
  }
  return reply({operations:targets.map(t=>({table:t.table,key:{id:t.id},expected:t.expected,patch:paths}))});
 }catch(e){return reply({error:e instanceof Error?e.message:'이미지 처리에 실패했습니다.'},400);}
}
