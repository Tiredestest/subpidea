begin;
create table public.game_follows (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 game_id uuid not null references public.games(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,game_id)
);
alter table public.game_follows enable row level security;
revoke all on public.game_follows from anon,authenticated;
grant select,insert,delete on public.game_follows to authenticated;
create policy follows_read on public.game_follows for select to authenticated using(user_id=(select auth.uid()));
create policy follows_insert on public.game_follows for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.games g where g.id=game_id and g.is_published));
create policy follows_delete on public.game_follows for delete to authenticated using(user_id=(select auth.uid()));
create index follows_game on public.game_follows(game_id);

alter table public.appearances add column is_active boolean not null default true;
alter policy appearances_read on public.appearances using(is_active and
 exists(select 1 from public.chapters c where c.id=appearances.chapter_id and c.is_published)
 and exists(select 1 from public.characters c where c.id=appearances.character_id and c.is_published));
create or replace function public.target_visible(chapter uuid,person uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.chapters c join public.story_arcs a on a.id=c.arc_id
 join public.games g on g.id=c.game_id where c.id=chapter and c.is_published and a.is_published and g.is_published)
 and (person is null or exists(select 1 from public.appearances ap join public.characters p on p.id=ap.character_id
 where ap.chapter_id=chapter and ap.character_id=person and ap.is_active and p.is_published));
$$;

-- Non-destructive removal: reviews stay attached to their original character.
create function public.admin_manage_appearance(chapter uuid,person uuid,new_person uuid,active boolean,sort_position integer,expected timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare old_row public.appearances; next_row public.appearances; game uuid;
begin
 if not public.is_content_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
 if sort_position is null or sort_position<0 or sort_position>100000 or active is null then raise exception '표시 순서를 확인해 주세요.'; end if;
 perform pg_advisory_xact_lock(73190422);
 select game_id into game from public.chapters where id=chapter;
 if game is null then raise exception '장이 없습니다.'; end if;
 select * into old_row from public.appearances where chapter_id=chapter and character_id=person for update;
 if old_row.chapter_id is not null then
  if expected is null or old_row.updated_at<>expected then raise exception '다른 변경이 있습니다. 새로고침해 주세요.' using errcode='40001'; end if;
 else
  if expected is not null then raise exception '대상이 변경되었습니다.' using errcode='40001'; end if;
 end if;
 if new_person is not null and new_person<>person then
  if old_row.chapter_id is null or not old_row.is_active then raise exception '교체할 등장 관계가 없습니다.'; end if;
  if exists(select 1 from public.appearances where chapter_id=chapter and character_id=new_person) then raise exception '이미 등록된 캐릭터입니다. 기존 연결을 복원해 주세요.'; end if;
  update public.appearances set is_active=false where chapter_id=chapter and character_id=person returning * into next_row;
  insert into public.admin_changes(table_name,record_key,before_value,after_value) values('appearances',jsonb_build_object('chapter_id',chapter,'character_id',person),to_jsonb(old_row),to_jsonb(next_row));
  insert into public.appearances(game_id,chapter_id,character_id,sort_order) values(game,chapter,new_person,sort_position) returning * into next_row;
  insert into public.admin_changes(table_name,record_key,before_value,after_value) values('appearances',jsonb_build_object('chapter_id',chapter,'character_id',new_person),null,to_jsonb(next_row));
 else
  if old_row.chapter_id is null then
   insert into public.appearances(game_id,chapter_id,character_id,sort_order,is_active) values(game,chapter,person,sort_position,active) returning * into next_row;
  else
   update public.appearances set sort_order=sort_position,is_active=active where chapter_id=chapter and character_id=person returning * into next_row;
  end if;
  insert into public.admin_changes(table_name,record_key,before_value,after_value) values('appearances',jsonb_build_object('chapter_id',chapter,'character_id',person),case when old_row.chapter_id is null then null else to_jsonb(old_row) end,to_jsonb(next_row));
 end if;
end; $$;
revoke all on function public.admin_manage_appearance(uuid,uuid,uuid,boolean,integer,timestamptz) from public,anon;
grant execute on function public.admin_manage_appearance(uuid,uuid,uuid,boolean,integer,timestamptz) to authenticated;

create policy admin_content_storage_read on storage.objects for select to authenticated
using(bucket_id='content' and (select public.is_content_admin()));
create policy admin_game_header_upload on storage.objects for insert to authenticated
with check(bucket_id='content' and (select public.is_content_admin())
 and name ~ '^[a-z0-9-]+/stories/GAME_HEADER_[a-f0-9]{64}\.webp$'
 and exists(select 1 from public.games g where g.slug=split_part(storage.objects.name,'/',1)));
commit;
