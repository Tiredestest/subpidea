-- Content-addressed immutable uploads; existing objects cannot be overwritten.
create policy admin_content_image_upload on storage.objects for insert to authenticated
with check (
 bucket_id='content' and (select public.is_content_admin())
 and (
  name ~ '^[a-z0-9-]+/stories/ASSET_[a-f0-9]{64}_(card|detail)\.webp$'
  or name ~ '^[a-z0-9-]+/characters/ASSET_[a-f0-9]{64}_(avatar|portrait)\.webp$'
 )
 and exists(select 1 from public.games g where g.slug=split_part(storage.objects.name,'/',1))
);
