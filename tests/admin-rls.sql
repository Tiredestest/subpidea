begin;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","user_metadata":{"role":"admin"}}',true);
set local role authenticated;
do $$ begin
 if public.is_content_admin() then raise exception 'User metadata escalated privileges'; end if;
 begin
  perform public.admin_apply_changes('[{"table":"games","key":{"id":"44444444-4444-4444-8444-444444444444"},"expected":null,"patch":{"source_id":"ADMIN_TEST","slug":"admin-test","title":"test"}}]');
  raise exception 'Non-admin RPC allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.games(source_id,slug,title) values('ADMIN_DENIED','admin-denied','test');
  raise exception 'Non-admin direct write allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;
do $$ declare gid uuid:=gen_random_uuid(); row_json jsonb; n integer; audit_count integer; begin
 perform public.admin_apply_changes(jsonb_build_array(jsonb_build_object('table','games','key',jsonb_build_object('id',gid),'expected',null,'patch',jsonb_build_object('source_id','ADMIN_TEST','slug','admin-test','title','before','is_published',false))));
 select to_jsonb(g) into row_json from public.games g where id=gid;
 if row_json is null then raise exception 'Admin cannot read private record'; end if;
 perform public.admin_apply_changes(jsonb_build_array(jsonb_build_object('table','games','key',jsonb_build_object('id',gid),'expected',row_json->>'updated_at','patch',jsonb_build_object('title','after'))));
 if not exists(select 1 from public.games where id=gid and title='after') then raise exception 'Admin edit failed'; end if;
 select count(*) into audit_count from public.admin_changes where record_key->>'id'=gid::text;
 if audit_count<>2 then raise exception 'Audit missing'; end if;
 begin
  perform public.admin_apply_changes(jsonb_build_array(jsonb_build_object('table','games','key',jsonb_build_object('id',gid),'expected','2000-01-01T00:00:00Z','patch',jsonb_build_object('title','stale'))));
  raise exception 'Stale write accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.admin_apply_changes(jsonb_build_array(
   jsonb_build_object('table','games','key',jsonb_build_object('id',gid),'expected',row_json->>'updated_at','patch',jsonb_build_object('title','must rollback')),
   jsonb_build_object('table','games','key',jsonb_build_object('id',gen_random_uuid()),'expected',null,'patch',jsonb_build_object('source_id','ADMIN_TEST','slug','duplicate','title','duplicate'))));
  raise exception 'Invalid batch accepted';
 exception when unique_violation then null; end;
 if not exists(select 1 from public.games where id=gid and title='after') then raise exception 'Batch partially committed'; end if;
 select count(*) into n from public.admin_changes where record_key->>'id'=gid::text;
 if n<>audit_count then raise exception 'Failed batch audit persisted'; end if;
 begin
  perform public.admin_apply_changes(jsonb_build_array(jsonb_build_object('table','profiles','key',jsonb_build_object('id',gid),'expected',null,'patch',jsonb_build_object('display_name','injected'))));
  raise exception 'Unsupported table accepted' using errcode='23514';
 exception when raise_exception then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 if exists(select 1 from public.games where source_id='ADMIN_TEST') then raise exception 'Private admin data leaked'; end if;
 begin perform public.admin_apply_changes('[]'); raise exception 'Anon RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: admin isolation, metadata spoof rejection, insert/edit, optimistic conflict, atomic rollback, audit, private visibility' as result;
rollback;
