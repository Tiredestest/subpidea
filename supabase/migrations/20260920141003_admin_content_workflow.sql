begin;

create function public.is_content_admin() returns boolean language sql stable security invoker
set search_path='' as $$ select auth.uid() is not null and coalesce(auth.jwt()->'app_metadata'->>'role'='admin',false) $$;
revoke all on function public.is_content_admin() from public;
grant execute on function public.is_content_admin() to authenticated;

alter table public.site_settings add column updated_at timestamptz not null default now();
create trigger settings_updated before update on public.site_settings for each row execute function public.touch_content_updated_at();

do $$ declare t text; begin
 foreach t in array array['games','story_arcs','chapters','characters','appearances','site_settings'] loop
  execute format('create policy admin_read on public.%I for select to authenticated using ((select public.is_content_admin()))',t);
  execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select public.is_content_admin()))',t);
  execute format('create policy admin_update on public.%I for update to authenticated using ((select public.is_content_admin())) with check ((select public.is_content_admin()))',t);
  execute format('grant insert,update on public.%I to authenticated',t);
 end loop;
end $$;

create table public.admin_changes (
 id uuid primary key default gen_random_uuid(), actor uuid not null default auth.uid(),
 table_name text not null, record_key jsonb not null, before_value jsonb, after_value jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.admin_changes enable row level security;
revoke all on public.admin_changes from anon,authenticated;
grant select,insert on public.admin_changes to authenticated;
create policy admin_changes_read on public.admin_changes for select to authenticated using ((select public.is_content_admin()));
create policy admin_changes_insert on public.admin_changes for insert to authenticated with check ((select public.is_content_admin()) and actor=(select auth.uid()));
create index admin_changes_recent on public.admin_changes(created_at desc);

-- Caller privileges and RLS remain in effect. A failure rolls back the whole batch.
create function public.admin_apply_changes(operations jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare op jsonb; tab text; keys jsonb; patch jsonb; allowed text[]; key_fields text[];
 old_row jsonb; new_row jsonb; predicate text; cols text; vals text; assignments text; field text; total integer:=0;
begin
 if not public.is_content_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
 if jsonb_typeof(operations) <> 'array' or jsonb_array_length(operations)>3000 or jsonb_array_length(operations)=0 then
  raise exception '변경 건수는 1~3000개여야 합니다.';
 end if;
 perform pg_advisory_xact_lock(73190422);
 for op in select value from jsonb_array_elements(operations) loop
  tab:=op->>'table'; keys:=op->'key'; patch:=op->'patch';
  allowed:=case tab
   when 'games' then array['source_id','slug','title','description','cover_image','hero_image','sort_order','is_published']
   when 'story_arcs' then array['game_id','source_id','slug','title','summary','cover_image','detail_image','sort_order','is_published','release_date_kr','release_date_jp']
   when 'chapters' then array['game_id','arc_id','source_id','slug','title','summary','cover_image','detail_image','sort_order','is_published','release_date_kr','release_date_jp']
   when 'characters' then array['game_id','source_id','slug','name','description','image','thumbnail','sort_order','is_published']
   when 'appearances' then array['game_id','sort_order','is_featured']
   when 'site_settings' then array['value'] else null end;
  if allowed is null or jsonb_typeof(keys) is distinct from 'object' or jsonb_typeof(patch) is distinct from 'object' or patch='{}'::jsonb then raise exception '잘못된 변경 형식입니다.'; end if;
  key_fields:=case tab when 'appearances' then array['chapter_id','character_id'] when 'site_settings' then array['key'] else array['id'] end;
  if (select count(*) from jsonb_object_keys(keys)) <> cardinality(key_fields) or not keys ?& key_fields then raise exception '대상 키를 확인해 주세요.'; end if;
  for field in select jsonb_object_keys(patch) loop
   if not field=any(allowed) then raise exception '허용되지 않은 필드: %',field; end if;
  end loop;
  if tab='site_settings' then
   if keys->>'key' in ('ratings_enabled','comments_enabled') then
    if jsonb_typeof(patch->'value') is distinct from 'boolean' then raise exception '설정은 참/거짓이어야 합니다.'; end if;
   elsif keys->>'key' in ('home_recent_limit','home_popular_game_limit') then
    if jsonb_typeof(patch->'value') is distinct from 'number' or (patch->>'value')::numeric not between 1 and 24 or trunc((patch->>'value')::numeric)<>(patch->>'value')::numeric then raise exception '목록 수는 1~24 정수입니다.'; end if;
   else raise exception '알 수 없는 설정입니다.'; end if;
  end if;
  select string_agg(format('t.%I = (jsonb_populate_record(null::public.%I,$1)).%I',k,tab,k),' and ') into predicate from unnest(key_fields) k;
  old_row:=null;
  execute format('select to_jsonb(t) from public.%I t where %s for update',tab,predicate) into old_row using keys;
  if old_row is not null then
   if op->>'expected' is null or (old_row->>'updated_at')::timestamptz <> (op->>'expected')::timestamptz then raise exception '다른 작업에서 변경되었습니다. 다시 불러와 검토해 주세요.' using errcode='40001'; end if;
   if patch ?| array['source_id','slug','game_id','arc_id'] then raise exception '기존 식별자와 부모 연결은 변경할 수 없습니다.'; end if;
   select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$2)).%I',k,tab,k),',') into assignments from jsonb_object_keys(patch) k;
   execute format('update public.%I t set %s where %s returning to_jsonb(t)',tab,assignments,predicate) into new_row using keys,patch;
  else
   if op->>'expected' is not null then raise exception '대상이 사라졌습니다. 다시 검토해 주세요.' using errcode='40001'; end if;
   patch:=patch||keys;
   select string_agg(format('%I',k),','),string_agg(format('(jsonb_populate_record(null::public.%I,$1)).%I',tab,k),',') into cols,vals from jsonb_object_keys(patch) k;
   execute format('insert into public.%I as t (%s) select %s returning to_jsonb(t)',tab,cols,vals) into new_row using patch;
  end if;
  insert into public.admin_changes(table_name,record_key,before_value,after_value) values(tab,keys,old_row,new_row);
  total:=total+1;
 end loop;
 return total;
end $$;
revoke all on function public.admin_apply_changes(jsonb) from public,anon;
grant execute on function public.admin_apply_changes(jsonb) to authenticated;
commit;
