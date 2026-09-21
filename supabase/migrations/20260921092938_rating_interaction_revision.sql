begin;
create function public.require_comment_rating() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.ratings r where r.user_id=new.user_id
   and r.chapter_id=new.chapter_id and r.character_id is not distinct from new.character_id) then
   raise exception 'Rate this target before writing a comment' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function public.require_comment_rating() from public,anon,authenticated;
create trigger comments_require_rating before insert or update of body,is_spoiler,user_id,chapter_id,character_id
on public.comments for each row execute function public.require_comment_rating();
create or replace view public.comment_feed with(security_invoker=true) as
select c.id,c.user_id,c.chapter_id,c.character_id,c.body,c.is_spoiler,c.created_at,c.updated_at,
p.display_name,count(l.user_id)::int as like_count,r.score
from public.comments c join public.profiles p on p.id=c.user_id
left join public.comment_likes l on l.comment_id=c.id
left join public.ratings r on r.user_id=c.user_id and r.chapter_id=c.chapter_id
and r.character_id is not distinct from c.character_id
group by c.id,p.display_name,r.score;
commit;
