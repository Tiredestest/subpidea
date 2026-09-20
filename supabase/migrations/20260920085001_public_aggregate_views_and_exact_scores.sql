begin;
drop view public.rating_summary;
alter table public.ratings alter column score type numeric using score::numeric;
create view public.rating_summary with(security_invoker=true) as select chapter_id,character_id,avg(score)::numeric(3,2) as average,count(*)::int as count from public.ratings group by chapter_id,character_id;
grant select on public.rating_summary to anon,authenticated;
create view public.game_rating_summary with(security_invoker=true) as
select c.game_id as id,avg(r.score)::numeric(3,2) as average,count(*)::int as count,count(distinct r.user_id)::int as reviewers
from public.ratings r join public.chapters c on c.id=r.chapter_id where r.character_id is null group by c.game_id;
create view public.arc_rating_summary with(security_invoker=true) as
select c.arc_id as id,avg(r.score)::numeric(3,2) as average,count(*)::int as count,count(distinct r.user_id)::int as reviewers
from public.ratings r join public.chapters c on c.id=r.chapter_id where r.character_id is null group by c.arc_id;
create view public.character_rating_summary with(security_invoker=true) as
select character_id as id,avg(score)::numeric(3,2) as average,count(*)::int as count,count(distinct user_id)::int as reviewers
from public.ratings where character_id is not null group by character_id;
create view public.community_stats with(security_invoker=true) as
select (select count(*)::int from public.ratings) as ratings,(select count(*)::int from public.comments) as comments;
grant select on public.game_rating_summary,public.arc_rating_summary,public.character_rating_summary,public.community_stats to anon,authenticated;
commit;
