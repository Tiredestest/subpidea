import {requireAdmin} from '@/lib/admin/server';
import {prepareHeader} from '@/lib/header-image';
import {createHash} from 'node:crypto';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
 let admin;try{admin=await requireAdmin();}catch{return Response.json({error:'관리자 로그인이 필요합니다.'},{status:403});}
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'요청 출처를 확인해 주세요.'},{status:403});
 try{
  if(Number(request.headers.get('content-length'))>3_100_000)throw Error('이미지는 3MB 이하여야 합니다.');
  const form=await request.formData();const file=form.get('image');const gameId=String(form.get('game_id')??'');
  if(!(file instanceof File)||file.size>3_000_000)throw Error('3MB 이하 이미지를 선택해 주세요.');
  const {data:game,error}=await admin.db.from('games').select('slug').eq('id',gameId).single();
  if(error||!game)throw Error('등록된 게임을 선택해 주세요.');
  const bytes=await prepareHeader(Buffer.from(await file.arrayBuffer()));
  const filename=`GAME_HEADER_${createHash('sha256').update(bytes).digest('hex')}.webp`;const folder=`${game.slug}/stories`;const path=`${folder}/${filename}`;
  const {data:existing,error:lookupError}=await admin.db.storage.from('content').list(folder,{search:filename,limit:100});
  if(lookupError)throw Error('이미지 저장소를 확인하지 못했습니다.');
  if(!existing?.some(item=>item.name===filename)){
   const {error:uploadError}=await admin.db.storage.from('content').upload(path,bytes,{contentType:'image/webp',upsert:false});
   if(uploadError)throw Error('이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  return Response.json({path,bytes:bytes.length},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'이미지를 처리하지 못했습니다.'},{status:400});}
}
