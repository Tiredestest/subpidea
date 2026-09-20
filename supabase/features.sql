-- Additional application schema. Applied after the content tables.
create table public.site_settings (
  key text primary key,
  value jsonb not null
);
insert into public.site_settings values
 ('ratings_enabled','true'), ('comments_enabled','true'),
 ('home_recent_limit','6'), ('home_popular_game_limit','6');
alter table public.site_settings enable row level security;
create policy settings_read on public.site_settings for select to anon, authenticated using (true);
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(display_name) between 1 and 40),
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert(id,display_name), update(display_name) on public.profiles to authenticated;

-- A null character_id means a chapter review; otherwise the target is its appearance.
-- NULLS NOT DISTINCT enforces one chapter rating/comment per account as well.
create table public.ratings (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 chapter_id uuid not null references public.chapters(id) on delete restrict,
 character_id uuid,
 score numeric(2,1) not null check (score between 0.5 and 5 and mod(score * 2, 1) = 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (chapter_id,character_id) references public.appearances(chapter_id,character_id) on delete restrict,
 unique nulls not distinct (user_id,chapter_id,character_id)
);
create table public.comments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
 chapter_id uuid not null references public.chapters(id) on delete restrict,
 character_id uuid,
 body text not null check (char_length(btrim(body)) between 1 and 300),
 is_spoiler boolean not null default false,
 is_hidden boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (chapter_id,character_id) references public.appearances(chapter_id,character_id) on delete restrict,
 unique nulls not distinct (user_id,chapter_id,character_id)
);
create table public.comment_likes (
 comment_id uuid not null references public.comments(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 created_at timestamptz not null default now(),
 primary key(comment_id,user_id)
);
create index ratings_target on public.ratings(chapter_id,character_id);
create index ratings_character on public.ratings(character_id);
create index comments_target on public.comments(chapter_id,character_id,created_at desc);
create index comments_character on public.comments(character_id);
create index likes_user on public.comment_likes(user_id);
create trigger ratings_updated before update on public.ratings for each row execute function public.touch_content_updated_at();
create trigger comments_updated before update on public.comments for each row execute function public.touch_content_updated_at();

create function public.target_visible(chapter uuid, person uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.chapters where id=chapter)
 and (person is null or exists(select 1 from public.appearances where chapter_id=chapter and character_id=person));
$$;
create function public.feature_enabled(feature text) returns boolean
language sql stable security invoker set search_path = '' as $$
 select coalesce((select value = 'true'::jsonb from public.site_settings where key=feature),false);
$$;

alter table public.ratings enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
create policy ratings_read on public.ratings for select to anon, authenticated using (public.target_visible(chapter_id,character_id));
create policy ratings_insert on public.ratings for insert to authenticated with check (
 (select auth.uid())=user_id and public.target_visible(chapter_id,character_id) and public.feature_enabled('ratings_enabled'));
create policy ratings_update on public.ratings for update to authenticated using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id and public.target_visible(chapter_id,character_id) and public.feature_enabled('ratings_enabled'));
create policy ratings_delete on public.ratings for delete to authenticated using ((select auth.uid())=user_id);
create policy comments_read on public.comments for select to anon, authenticated using (not is_hidden and public.target_visible(chapter_id,character_id));
create policy comments_insert on public.comments for insert to authenticated with check (
 (select auth.uid())=user_id and not is_hidden and public.target_visible(chapter_id,character_id) and public.feature_enabled('comments_enabled'));
create policy comments_update on public.comments for update to authenticated using ((select auth.uid())=user_id and not is_hidden)
 with check ((select auth.uid())=user_id and not is_hidden and public.target_visible(chapter_id,character_id) and public.feature_enabled('comments_enabled'));
create policy comments_delete on public.comments for delete to authenticated using ((select auth.uid())=user_id);
create policy likes_read on public.comment_likes for select to anon, authenticated using (exists(select 1 from public.comments where id=comment_id));
create policy likes_insert on public.comment_likes for insert to authenticated with check (
 (select auth.uid())=user_id and exists(select 1 from public.comments where id=comment_id) and public.feature_enabled('comments_enabled'));
create policy likes_delete on public.comment_likes for delete to authenticated using ((select auth.uid())=user_id);
revoke all on public.ratings,public.comments,public.comment_likes from anon,authenticated;
grant select on public.ratings,public.comments,public.comment_likes to anon,authenticated;
grant insert(user_id,chapter_id,character_id,score),update(score),delete on public.ratings to authenticated;
grant insert(user_id,chapter_id,character_id,body,is_spoiler),update(body,is_spoiler),delete on public.comments to authenticated;
grant insert(comment_id,user_id),delete on public.comment_likes to authenticated;

-- Aggregates respect the same RLS and expose no extra unpublished targets.
create view public.rating_summary with (security_invoker=true) as
 select chapter_id,character_id,avg(score)::numeric(3,2) as average,count(*)::int as count
 from public.ratings group by chapter_id,character_id;
grant select on public.rating_summary to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('content','content',false,2097152,array['image/webp']);
-- Private bucket: even known paths require visible content. Public bucket URLs are not used.
create policy content_image_read on storage.objects for select to anon,authenticated using (
 bucket_id='content' and (
 exists(select 1 from public.story_arcs a where name in (a.cover_image,a.detail_image)) or
 exists(select 1 from public.chapters c where name in (c.cover_image,c.detail_image)) or
 exists(select 1 from public.characters c where name in (c.image,c.thumbnail)) or
 exists(select 1 from public.games g where name in (g.cover_image,g.hero_image))
 ));
