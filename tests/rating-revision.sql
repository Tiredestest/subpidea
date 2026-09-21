begin;
insert into auth.users(id,aud,role,email) values
('33333333-3333-4333-8333-333333333333','authenticated','authenticated','revision-test@example.invalid');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
set local role authenticated;
insert into public.profiles(id,display_name) values(auth.uid(),'검증 계정');
do $$ declare chapter uuid; comment_id uuid; begin
 select id into chapter from public.chapters where is_published order by id limit 1;
 begin
  perform public.set_comment(chapter,null,'별점 없는 글',false);
  raise exception 'Unrated comment accepted';
 exception when check_violation then null; end;
 perform public.set_rating(chapter,null,3.5);
 perform public.set_comment(chapter,null,'보존할 글',false);
 select id into comment_id from public.comments where user_id=auth.uid() and chapter_id=chapter and character_id is null;
 if (select score from public.comment_feed where id=comment_id)<>3.5 then raise exception 'Score missing'; end if;
 perform public.set_rating(chapter,null,4.5);
 if (select score from public.comment_feed where id=comment_id)<>4.5 then raise exception 'Score not refreshed'; end if;
 delete from public.ratings where user_id=auth.uid() and chapter_id=chapter and character_id is null;
 if not exists(select 1 from public.comment_feed where id=comment_id and score is null and body='보존할 글') then raise exception 'Withdrawal removed comment or retained score'; end if;
 begin
  perform public.set_comment(chapter,null,'별점 없이 수정',false);
  raise exception 'Unrated update accepted';
 exception when check_violation then null; end;
 perform public.set_rating(chapter,null,0.5);
 perform public.set_comment(chapter,null,'재평가 후 수정',false);
 delete from public.comments where id=comment_id;
end $$;
reset role;
select 'PASS: rating required, live score, withdrawal preserves comment, rerating permits edit' as result;
rollback;
