"""Build a transactional content upsert from validated staging; never execute it.
Existing slugs/publication/images are operator-owned and preserved on reimport.
"""
import json
from pathlib import Path
import hashlib

root = Path(__file__).resolve().parents[1]
config = json.loads((root/'config/import/blue-archive.json').read_text(encoding='utf-8'))
staging = json.loads((root/'data/reports/blue-archive/staging.json').read_text(encoding='utf-8'))
if not staging['valid'] or staging['report']['errors']:
    raise ValueError('Invalid staging data')
if hashlib.sha256((root/config['workbook']).read_bytes()).hexdigest() != staging['report']['source_sha256']:
    raise ValueError('Workbook changed; rerun preparation')
payload = json.dumps(staging['data'], ensure_ascii=False, separators=(',', ':'))
if '$source$' in payload:
    raise ValueError('Unexpected SQL delimiter in content')
sql = '''begin;
create temporary table import_payload(value jsonb) on commit drop;
insert into import_payload values ($source$PAYLOAD$source$::jsonb);
insert into public.games(source_id,slug,title,is_published,cover_image,hero_image)
select value#>>'{game,source_id}',value#>>'{game,slug}',value#>>'{game,title}',(value#>>'{game,is_published}')::boolean,
 'blue-archive/stories/BA_CH1-card.webp','blue-archive/stories/BA_CH1-detail.webp' from import_payload
on conflict(source_id) do update set title=excluded.title;
insert into public.story_arcs(game_id,source_id,slug,title,summary,cover_image,detail_image,sort_order,is_published,release_date_kr,release_date_jp)
select g.id,r.source_id,r.slug,r.title,r.summary,'blue-archive/stories/'||r.source_id||'-card.webp',
 'blue-archive/stories/'||r.source_id||'-detail.webp',r.sort_order,r.is_published,r.release_date_kr,r.release_date_jp
from import_payload p cross join lateral jsonb_to_recordset(p.value->'arcs') as r(source_id text,slug text,title text,summary text,sort_order int,is_published boolean,release_date_kr date,release_date_jp date)
join public.games g on g.source_id=p.value#>>'{game,source_id}'
on conflict(game_id,source_id) do update set title=excluded.title,summary=excluded.summary,release_date_kr=excluded.release_date_kr,release_date_jp=excluded.release_date_jp;
insert into public.chapters(game_id,arc_id,source_id,slug,title,summary,cover_image,detail_image,sort_order,is_published,release_date_kr,release_date_jp,published_at)
select g.id,a.id,r.source_id,r.slug,r.title,r.summary,'blue-archive/stories/'||r.source_id||'-card.webp',
 'blue-archive/stories/'||r.source_id||'-detail.webp',r.sort_order,r.is_published,r.release_date_kr,r.release_date_jp,case when r.is_published then now() else null end
from import_payload p cross join lateral jsonb_to_recordset(p.value->'chapters') as r(source_id text,arc_source_id text,slug text,title text,summary text,sort_order int,is_published boolean,release_date_kr date,release_date_jp date)
join public.games g on g.source_id=p.value#>>'{game,source_id}'
join public.story_arcs a on a.game_id=g.id and a.source_id=r.arc_source_id
on conflict(arc_id,source_id) do update set title=excluded.title,summary=excluded.summary,release_date_kr=excluded.release_date_kr,release_date_jp=excluded.release_date_jp;
insert into public.characters(game_id,source_id,slug,name,description,image,thumbnail,sort_order,is_published)
select g.id,r.source_id,r.slug,r.name,r.description,'blue-archive/characters/'||r.source_id||'-portrait.webp',
 'blue-archive/characters/'||r.source_id||'-avatar.webp',r.sort_order,r.is_published
from import_payload p cross join lateral jsonb_to_recordset(p.value->'characters') as r(source_id text,slug text,name text,description text,sort_order int,is_published boolean)
join public.games g on g.source_id=p.value#>>'{game,source_id}'
on conflict(game_id,source_id) do update set name=excluded.name;
insert into public.appearances(game_id,chapter_id,character_id,sort_order,is_featured)
select g.id,c.id,k.id,r.sort_order,r.is_featured
from import_payload p cross join lateral jsonb_to_recordset(p.value->'appearances') as r(chapter_source_id text,character_source_id text,sort_order int,is_featured boolean)
join public.games g on g.source_id=p.value#>>'{game,source_id}'
join public.chapters c on c.game_id=g.id and c.source_id=r.chapter_source_id
join public.characters k on k.game_id=g.id and k.source_id=r.character_source_id
on conflict(chapter_id,character_id) do nothing;
commit;
'''.replace('PAYLOAD',payload)
(root/'data/reports/blue-archive/import.sql').write_text(sql,encoding='utf-8')
print('Transactional import SQL prepared; not executed.')
