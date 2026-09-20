-- REVIEW DRAFT ONLY: content schema, not a production migration.
-- Requires Supabase PostgreSQL. No remote database has been modified.
-- Source ID scopes must be confirmed against the original workbook.
begin;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  source_id text not null unique check (btrim(source_id) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (btrim(title) <> ''),
  description text not null default '',
  cover_image text,
  hero_image text,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.story_arcs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete restrict,
  source_id text not null check (btrim(source_id) <> ''),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (btrim(title) <> ''),
  summary text not null default '',
  cover_image text,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  release_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, source_id),
  unique (game_id, slug),
  unique (id, game_id)
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  arc_id uuid not null,
  source_id text not null check (btrim(source_id) <> ''),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (btrim(title) <> ''),
  summary text not null default '',
  cover_image text,
  sort_order integer not null default 0,
  release_date date,
  -- Site publication time is distinct from the game's story release date.
  published_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (arc_id, game_id) references public.story_arcs(id, game_id) on delete restrict,
  unique (arc_id, source_id),
  unique (arc_id, slug),
  unique (id, game_id)
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete restrict,
  source_id text not null check (btrim(source_id) <> ''),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (btrim(name) <> ''),
  description text not null default '',
  image text,
  thumbnail text,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, source_id),
  unique (game_id, slug),
  unique (id, game_id)
);

create table public.appearances (
  game_id uuid not null,
  chapter_id uuid not null,
  character_id uuid not null,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (chapter_id, character_id),
  foreign key (chapter_id, game_id) references public.chapters(id, game_id) on delete restrict,
  foreign key (character_id, game_id) references public.characters(id, game_id) on delete restrict
);

create index story_arcs_navigation on public.story_arcs(game_id, sort_order, id);
create index chapters_navigation on public.chapters(arc_id, sort_order, id);
create index chapters_recent on public.chapters(published_at desc) where is_published;
create index characters_navigation on public.characters(game_id, sort_order, id);
create index appearances_character on public.appearances(character_id, chapter_id);

create function public.touch_content_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger games_updated before update on public.games
  for each row execute function public.touch_content_updated_at();
create trigger arcs_updated before update on public.story_arcs
  for each row execute function public.touch_content_updated_at();
create trigger chapters_updated before update on public.chapters
  for each row execute function public.touch_content_updated_at();
create trigger characters_updated before update on public.characters
  for each row execute function public.touch_content_updated_at();
create trigger appearances_updated before update on public.appearances
  for each row execute function public.touch_content_updated_at();

alter table public.games enable row level security;
alter table public.story_arcs enable row level security;
alter table public.chapters enable row level security;
alter table public.characters enable row level security;
alter table public.appearances enable row level security;

-- Parent SELECTs are subject to their own RLS, down a non-cyclic graph.
create policy games_read on public.games for select to anon, authenticated
  using (is_published);
create policy arcs_read on public.story_arcs for select to anon, authenticated
  using (is_published and exists (
    select 1 from public.games g where g.id = story_arcs.game_id and g.is_published
  ));
create policy chapters_read on public.chapters for select to anon, authenticated
  using (is_published and exists (
    select 1 from public.story_arcs a where a.id = chapters.arc_id and a.is_published
  ));
create policy characters_read on public.characters for select to anon, authenticated
  using (is_published and exists (
    select 1 from public.games g where g.id = characters.game_id and g.is_published
  ));
create policy appearances_read on public.appearances for select to anon, authenticated
  using (
    exists (select 1 from public.chapters c where c.id = appearances.chapter_id and c.is_published)
    and exists (select 1 from public.characters c where c.id = appearances.character_id and c.is_published)
  );

-- No master-data write policies for ordinary users.
revoke all on public.games, public.story_arcs, public.chapters,
  public.characters, public.appearances from anon, authenticated;
grant select on public.games, public.story_arcs, public.chapters,
  public.characters, public.appearances to anon, authenticated;

-- published_at must be set by the future publication/import workflow.
-- Ratings, comments, likes, profiles, settings and Storage policies are deferred.
commit;
