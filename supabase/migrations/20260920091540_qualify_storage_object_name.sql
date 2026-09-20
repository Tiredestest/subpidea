begin;
alter policy content_image_read on storage.objects using (
 bucket_id='content' and (
 exists(select 1 from public.story_arcs a where storage.objects.name in (a.cover_image,a.detail_image)) or
 exists(select 1 from public.chapters c where storage.objects.name in (c.cover_image,c.detail_image)) or
 exists(select 1 from public.characters c where storage.objects.name in (c.image,c.thumbnail)) or
 exists(select 1 from public.games g where storage.objects.name in (g.cover_image,g.hero_image))
 ));
commit;
