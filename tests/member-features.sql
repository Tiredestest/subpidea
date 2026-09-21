begin;
create temporary table member_test as select g.id as game,c.id as chapter,gen_random_uuid() as first_person,gen_random_uuid() as second_person,gen_random_uuid() as private_game
from public.games g join public.chapters c on c.game_id=g.id where g.is_published and c.is_published order by c.id limit 1;
grant select on member_test to authenticated,anon;
insert into auth.users(id,aud,role,email) values
('55555555-5555-4555-8555-555555555555','authenticated','authenticated','member-test-a@example.invalid'),
('66666666-6666-4666-8666-666666666666','authenticated','authenticated','member-test-b@example.invalid');
insert into public.profiles(id,display_name) values('55555555-5555-4555-8555-555555555555','기존 이름');
insert into public.games(id,source_id,slug,title) select private_game,'MEMBER_PRIVATE_TEST','member-private-test','private' from member_test;
insert into public.characters(id,game_id,source_id,slug,name,is_published)
select first_person,game,'MEMBER_FIRST','member-first','first',true from member_test union all
select second_person,game,'MEMBER_SECOND','member-second','second',true from member_test;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',true);
set local role authenticated;
insert into public.game_follows(game_id) select game from member_test;
update public.profiles set display_name='새 닉네임' where id=auth.uid();
do $$ begin
 if not exists(select 1 from public.profiles where id=auth.uid() and display_name='새 닉네임') then raise exception 'Nickname update failed'; end if;
 begin insert into public.game_follows(game_id) select private_game from member_test; raise exception 'Private follow accepted'; exception when insufficient_privilege then null; end;
 begin insert into public.game_follows(game_id) select game from member_test; raise exception 'Duplicate follow accepted'; exception when unique_violation then null; end;
 begin perform public.admin_manage_appearance((select chapter from member_test),(select first_person from member_test),null,true,1,null);raise exception 'User admin RPC accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","user_metadata":{"role":"admin"}}',true);
set local role authenticated;
do $$ declare n integer; begin
 if exists(select 1 from public.game_follows) then raise exception 'Other follows leaked'; end if;
 update public.profiles set display_name='hacked' where id='55555555-5555-4555-8555-555555555555';get diagnostics n=row_count;if n<>0 then raise exception 'Other profile changed';end if;
 delete from public.game_follows where user_id='55555555-5555-4555-8555-555555555555';get diagnostics n=row_count;if n<>0 then raise exception 'Other follows changed';end if;
 begin insert into public.game_follows(user_id,game_id) select '55555555-5555-4555-8555-555555555555',game from member_test;raise exception 'Other follows created';exception when insufficient_privilege then null;end;
 begin insert into storage.objects(bucket_id,name) values('content','blue-archive/stories/GAME_HEADER_'||repeat('a',64)||'.webp');raise exception 'User uploaded header';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;
do $$ declare t record; stamp timestamptz; begin
 select * into t from member_test;
 perform public.admin_manage_appearance(t.chapter,t.first_person,null,true,1,null);
 perform public.set_rating(t.chapter,t.first_person,4.5);
 perform public.set_comment(t.chapter,t.first_person,'보존 확인',false);
 select updated_at into stamp from public.appearances where chapter_id=t.chapter and character_id=t.first_person;
 begin perform public.admin_manage_appearance(t.chapter,t.first_person,null,false,1,'2000-01-01');raise exception 'Stale change allowed';exception when serialization_failure then null;end;
 perform public.admin_manage_appearance(t.chapter,t.first_person,t.second_person,true,2,stamp);
 if public.target_visible(t.chapter,t.first_person) then raise exception 'Excluded appearance remains public';end if;
 if exists(select 1 from public.ratings where chapter_id=t.chapter and character_id=t.second_person) then raise exception 'Rating transferred';end if;
 if (select count(*) from public.admin_changes where record_key->>'chapter_id'=t.chapter::text and record_key->>'character_id' in(t.first_person::text,t.second_person::text))<>3 then raise exception 'Audit missing';end if;
 select updated_at into stamp from public.appearances where chapter_id=t.chapter and character_id=t.first_person;
 perform public.admin_manage_appearance(t.chapter,t.first_person,null,true,1,stamp);
 if not exists(select 1 from public.comment_feed where chapter_id=t.chapter and character_id=t.first_person and body='보존 확인' and score=4.5) then raise exception 'Restored review missing';end if;
 insert into storage.objects(bucket_id,name) values('content','blue-archive/stories/GAME_HEADER_'||repeat('a',64)||'.webp');
 delete from public.game_follows where user_id=auth.uid();
 if exists(select 1 from public.game_follows where user_id=auth.uid()) then raise exception 'Unfollow failed';end if;
end $$;
reset role;
set local role anon;
do $$ begin
 if exists(select 1 from storage.objects where name='blue-archive/stories/GAME_HEADER_'||repeat('a',64)||'.webp') then raise exception 'Unlinked upload leaked';end if;
 if has_table_privilege('anon','public.game_follows','select') then raise exception 'Anon follow access';end if;
end $$;
reset role;
select 'PASS: private follows, nickname ownership, admin-only reversible appearances, review preservation, storage restrictions' as result;
rollback;
