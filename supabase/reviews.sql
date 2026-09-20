begin;
create function public.set_rating(target_chapter uuid,target_character uuid,new_score numeric) returns void
language sql security invoker set search_path='' as $$
insert into public.ratings(user_id,chapter_id,character_id,score) values(auth.uid(),target_chapter,target_character,new_score)
on conflict(user_id,chapter_id,character_id) do update set score=excluded.score;
$$;
create function public.set_comment(target_chapter uuid,target_character uuid,new_body text,spoiler boolean) returns void
language sql security invoker set search_path='' as $$
insert into public.comments(user_id,chapter_id,character_id,body,is_spoiler) values(auth.uid(),target_chapter,target_character,new_body,spoiler)
on conflict(user_id,chapter_id,character_id) do update set body=excluded.body,is_spoiler=excluded.is_spoiler;
$$;
revoke all on function public.set_rating(uuid,uuid,numeric),public.set_comment(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.set_rating(uuid,uuid,numeric),public.set_comment(uuid,uuid,text,boolean) to authenticated;
create view public.comment_feed with(security_invoker=true) as
select c.id,c.user_id,c.chapter_id,c.character_id,c.body,c.is_spoiler,c.created_at,c.updated_at,p.display_name,count(l.user_id)::int as like_count
from public.comments c join public.profiles p on p.id=c.user_id left join public.comment_likes l on l.comment_id=c.id
group by c.id,p.display_name;
create view public.rating_distribution with(security_invoker=true) as
select chapter_id,character_id,score,count(*)::int as count from public.ratings group by chapter_id,character_id,score;
grant select on public.comment_feed,public.rating_distribution to anon,authenticated;
commit;
