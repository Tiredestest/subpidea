import {userDb} from '@/lib/supabase/server';
export async function GET(request:Request){
 const url=new URL(request.url);const chapter=url.searchParams.get('chapter')||'';const character=url.searchParams.get('character');const page=Math.max(0,Math.min(10000,Number(url.searchParams.get('page'))||0));const newest=url.searchParams.get('sort')==='new';
 const uuid=/^[0-9a-f-]{36}$/i;if(!uuid.test(chapter)||(character&&!uuid.test(character)))return Response.json({error:'잘못된 대상입니다.'},{status:400});
 const db=await userDb();const {data:{user}}=await db.auth.getUser();
 const {data:visible}=await db.from('chapters').select('id').eq('id',chapter).maybeSingle();if(!visible)return Response.json({error:'공개된 장이 아닙니다.'},{status:404});
 if(character){const {data:appearance}=await db.from('appearances').select('character_id').eq('chapter_id',chapter).eq('character_id',character).maybeSingle();if(!appearance)return Response.json({error:'이번 장의 공개된 캐릭터가 아닙니다.'},{status:404});}
 const targetQuery=(table:string,count=false)=>{const q=db.from(table).select('*',count?{count:'exact'}:{}).eq('chapter_id',chapter);return character?q.eq('character_id',character):q.is('character_id',null);};
 const queries=await Promise.all([
  targetQuery('comment_feed',true).order(newest?'created_at':'like_count',{ascending:false}).order('created_at',{ascending:false}).order('id').range(page*20,page*20+19),
  targetQuery('rating_summary').maybeSingle(),
  targetQuery('rating_distribution'),
  user?targetQuery('ratings').eq('user_id',user.id).maybeSingle():Promise.resolve({data:null,error:null}),
  user?targetQuery('comments').eq('user_id',user.id).maybeSingle():Promise.resolve({data:null,error:null}),
 ]);
 if(queries.some(x=>x.error))return Response.json({error:'감상을 불러오지 못했어요.'},{status:500});
 const comments=queries[0].data??[];let liked:string[]=[];
 if(user&&comments.length){const {data,error}=await db.from('comment_likes').select('comment_id').eq('user_id',user.id).in('comment_id',comments.map(x=>x.id));if(error)return Response.json({error:'좋아요를 불러오지 못했어요.'},{status:500});liked=(data??[]).map(x=>x.comment_id);}
 return Response.json({comments,total:'count' in queries[0]?queries[0].count:0,summary:queries[1].data,distribution:queries[2].data,myRating:queries[3].data?.score??null,myComment:queries[4].data,userId:user?.id??null,liked},{headers:{'Cache-Control':'private, no-store'}});
}
