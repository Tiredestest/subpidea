begin;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","user_metadata":{"role":"admin"}}',true);
set local role authenticated;
do $$ begin
 begin insert into storage.objects(bucket_id,name) values('content','blue-archive/stories/ASSET_'||repeat('b',64)||'_card.webp');raise exception 'Non-admin upload accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"role":"admin"}}',true);
set local role authenticated;
insert into storage.objects(bucket_id,name) values('content','blue-archive/stories/ASSET_'||repeat('b',64)||'_card.webp');
insert into storage.objects(bucket_id,name) values('content','blue-archive/characters/ASSET_'||repeat('c',64)||'_portrait.webp');
do $$ declare n integer; begin
 begin insert into storage.objects(bucket_id,name) values('content','unknown-game/stories/ASSET_'||repeat('b',64)||'_card.webp');raise exception 'Unknown game accepted';exception when insufficient_privilege then null;end;
 begin insert into storage.objects(bucket_id,name) values('content','blue-archive/characters/ASSET_'||repeat('b',64)||'_card.webp');raise exception 'Wrong folder accepted';exception when insufficient_privilege then null;end;
 begin insert into storage.objects(bucket_id,name) values('content','blue-archive/stories/BA_EV001.webp');raise exception 'Mutable path accepted';exception when insufficient_privilege then null;end;
 update storage.objects set metadata='{"test":true}' where name='blue-archive/stories/ASSET_'||repeat('b',64)||'_card.webp';get diagnostics n=row_count;if n<>0 then raise exception 'Immutable object changed';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin if exists(select 1 from storage.objects where name='blue-archive/stories/ASSET_'||repeat('b',64)||'_card.webp') then raise exception 'Unlinked image leaked';end if;end $$;
reset role;
rollback;
select 'PASS: admin-only upload, folder/path/game validation, immutable objects, unpublished image isolation' as result;
