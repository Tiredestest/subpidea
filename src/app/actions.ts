'use server';
import {userDb} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
import {nickname} from '@/lib/member-validation';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function signedIn(){const db=await userDb();const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('로그인 후 이용해 주세요.');return {db,user};}
function target(chapter:string,character:string|null){if(!uuid.test(chapter)||(character&&!uuid.test(character)))throw new Error('평가 대상을 확인해 주세요.');}
export async function saveRating(chapter:string,character:string|null,score:number){
 try{target(chapter,character);if(!Number.isFinite(score)||score<0.5||score>5||score*2%1!==0)throw new Error('별점은 0.5~5점, 0.5점 단위로 선택해 주세요.');const {db}=await signedIn();const {error}=await db.rpc('set_rating',{target_chapter:chapter,target_character:character,new_score:score});if(error)throw new Error('평가를 저장하지 못했어요. 대상 공개 상태와 연결을 확인해 주세요.');return {ok:true};}catch(e){return {ok:false,error:e instanceof Error?e.message:'저장하지 못했어요.'};}
}
export async function saveComment(chapter:string,character:string|null,body:string,spoiler:boolean){
 try{target(chapter,character);const text=body.trim();if(!text||Array.from(text).length>300)throw new Error('한줄평은 1~300자로 작성해 주세요.');const {db,user}=await signedIn();const {data:profile}=await db.from('profiles').select('id').eq('id',user.id).maybeSingle();if(!profile){const {error}=await db.from('profiles').insert({id:user.id,display_name:'독자 '+user.id.slice(0,6)});if(error&&error.code!=='23505')throw new Error('프로필을 준비하지 못했어요.');}const {error}=await db.rpc('set_comment',{target_chapter:chapter,target_character:character,new_body:text,spoiler});if(error)throw new Error('한줄평을 저장하지 못했어요. 먼저 별점을 남기고 대상 공개 상태를 확인해 주세요.');return {ok:true};}catch(e){return {ok:false,error:e instanceof Error?e.message:'저장하지 못했어요.'};}
}
export async function deleteComment(id:string){try{if(!uuid.test(id))throw new Error('대상을 확인해 주세요.');const {db,user}=await signedIn();const {error}=await db.from('comments').delete().eq('id',id).eq('user_id',user.id);if(error)throw new Error('삭제하지 못했어요.');return {ok:true};}catch(e){return {ok:false,error:e instanceof Error?e.message:'삭제하지 못했어요.'};}}
export async function likeComment(id:string,liked:boolean){try{if(!uuid.test(id))throw new Error('대상을 확인해 주세요.');const {db,user}=await signedIn();const response=liked?await db.from('comment_likes').delete().eq('comment_id',id).eq('user_id',user.id):await db.from('comment_likes').insert({comment_id:id,user_id:user.id});if(response.error&&response.error.code!=='23505')throw new Error('좋아요를 반영하지 못했어요.');return {ok:true};}catch(e){return {ok:false,error:e instanceof Error?e.message:'반영하지 못했어요.'};}}

export async function removeRating(chapter:string,character:string|null){
 try{target(chapter,character);const {db,user}=await signedIn();let query=db.from('ratings').delete().eq('user_id',user.id).eq('chapter_id',chapter);query=character?query.eq('character_id',character):query.is('character_id',null);const {error}=await query;if(error)throw new Error('평가를 취소하지 못했어요.');return {ok:true};}catch(e){return {ok:false,error:e instanceof Error?e.message:'취소하지 못했어요.'};}
}
export async function saveNickname(value:string){
 try{const name=nickname(value);const {db,user}=await signedIn();
 const {data:profile,error:readError}=await db.from('profiles').select('id').eq('id',user.id).maybeSingle();
 if(readError)throw Error('프로필을 읽지 못했습니다.');
 const result=profile?await db.from('profiles').update({display_name:name}).eq('id',user.id):await db.from('profiles').insert({id:user.id,display_name:name});
 if(result.error)throw Error('닉네임을 저장하지 못했습니다. 새로고침 후 다시 시도해 주세요.');
 revalidatePath('/','layout');return {ok:true};
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'저장하지 못했습니다.'};}
}
export async function followGame(gameId:string,following:boolean){
 try{if(!uuid.test(gameId)||typeof following!=='boolean')throw Error('게임을 확인해 주세요.');const {db,user}=await signedIn();
 const result=following?await db.from('game_follows').insert({game_id:gameId,user_id:user.id}):await db.from('game_follows').delete().eq('game_id',gameId).eq('user_id',user.id);
 if(result.error&&result.error.code!=='23505')throw Error('팔로우를 변경하지 못했습니다.');
 revalidatePath('/me');return {ok:true};
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'변경하지 못했습니다.'};}
}
