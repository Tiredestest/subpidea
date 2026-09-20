-- Disposable integration test. Every fixture is rolled back.
begin;
create temporary table test_context as
select (select id from public.chapters where is_published order by id limit 1) as chapter,
 (select id from public.chapters where not is_published order by id limit 1) as hidden,
 '11111111-1111-4111-8111-111111111111'::uuid as user_a,
 '22222222-2222-4222-8222-222222222222'::uuid as user_b;
grant select on test_context to anon,authenticated;
insert into auth.users(id,aud,role,email) values
('11111111-1111-4111-8111-111111111111','authenticated','authenticated','subpidea-test-a@example.invalid'),
('22222222-2222-4222-8222-222222222222','authenticated','authenticated','subpidea-test-b@example.invalid');
set local role anon;
do $$ begin
 if (select count(*) from public.chapters)<>24 then raise exception 'Published chapter count incorrect'; end if;
 if exists(select 1 from public.chapters where id=(select hidden from test_context)) then raise exception 'Hidden chapter leaked'; end if;
 if has_table_privilege('anon','public.games','INSERT') then raise exception 'Anonymous master write privilege'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
insert into public.profiles(id,display_name) values('11111111-1111-4111-8111-111111111111','테스트 독자');
select public.set_rating((select chapter from test_context),null,4.5);
select public.set_rating((select chapter from test_context),null,5.0);
select public.set_comment((select chapter from test_context),null,'테스트 한줄평',false);
select public.set_comment((select chapter from test_context),null,'수정된 테스트 한줄평',true);
insert into public.comment_likes(comment_id,user_id)
select id,'11111111-1111-4111-8111-111111111111' from public.comments where user_id='11111111-1111-4111-8111-111111111111';
do $$ begin
 if (select count(*) from public.ratings where user_id=(select user_a from test_context))<>1 then raise exception 'Rating upsert duplicated'; end if;
 if (select score from public.ratings where user_id=(select user_a from test_context))<>5 then raise exception 'Rating update failed'; end if;
 if (select count(*) from public.comments where user_id=(select user_a from test_context))<>1 then raise exception 'Comment upsert duplicated'; end if;
 begin
  perform public.set_rating((select chapter from test_context),null,0.49);
  raise exception 'Invalid score accepted';
 exception when check_violation then null; end;
 begin
  perform public.set_rating((select hidden from test_context),null,5);
  raise exception 'Hidden target write allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.comment_likes(comment_id,user_id) select id,(select user_a from test_context) from public.comments where user_id=(select user_a from test_context);
  raise exception 'Duplicate like allowed';
 exception when unique_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
do $$ declare affected integer; begin
 update public.ratings set score=1 where user_id=(select user_a from test_context);
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Other user rating modified'; end if;
 delete from public.comments where user_id=(select user_a from test_context);
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Other user comment deleted'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
delete from public.comment_likes where user_id=(select user_a from test_context);
delete from public.comments where user_id=(select user_a from test_context);
reset role;
select 'PASS: public visibility, private targets, ownership, atomic edits, exact scores, unique likes and cancellation' as result;
rollback;
