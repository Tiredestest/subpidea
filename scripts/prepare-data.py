"""Excel -> validated staging JSON. No network access and no DB mutations.

Usage: python scripts/prepare-data.py --config config/import/blue-archive.json
All workbook-specific sheet/column mappings live in the configuration file.
"""
import argparse
from collections import Counter, defaultdict
from datetime import date, datetime
import hashlib
import json
from pathlib import Path
import re
import sys
import openpyxl

ROOT = Path(__file__).resolve().parents[1]

def read_rows(workbook, spec):
    sheet = workbook[spec['name']]
    header = [c.value for c in sheet[spec['headerRow']]]
    for column in spec['fields'].values():
        if header.count(column) != 1:
            raise ValueError(f'{sheet.title}: required unique column {column!r}')
    positions = {field: header.index(column) for field, column in spec['fields'].items()}
    result = []
    for number, values in enumerate(sheet.iter_rows(min_row=spec['headerRow'] + 1, values_only=True), spec['headerRow'] + 1):
        row = {field: values[pos] for field, pos in positions.items()}
        if all(value is None or value == '' for value in row.values()):
            continue
        row['_row'] = number
        result.append(row)
    return result

def iso_date(value):
    if value is None or value == '':
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()[:10]
    return date.fromisoformat(str(value)[:10]).isoformat()

def slug(source_id):
    value = re.sub(r'[^a-z0-9]+', '-', source_id.lower()).strip('-')
    if not value:
        raise ValueError(f'Cannot derive slug from {source_id!r}')
    return value

def published(value, policy, kr, jp, today):
    if value is None or value == '':
        release = kr if policy == 'kr' else (kr or jp)
        return policy != 'private' and release is not None and release <= today
    if value is True or value == 1 or str(value).strip().lower() in ('true', '공개'):
        return True
    if value is False or value == 0 or str(value).strip().lower() in ('false', '비공개'):
        return False
    raise ValueError(f'Unknown publication value: {value!r}')

def prepare(config, today):
    path = ROOT / config['workbook']
    wb = openpyxl.load_workbook(path, data_only=True)
    source = {kind: read_rows(wb, spec) for kind, spec in config['sheets'].items()}
    errors, warnings, changes, quarantine = [], [], [], []
    images = {}
    for kind, folder in config['imageDirectories'].items():
        mapping = {}
        for image in sorted((ROOT / folder).rglob('*')):
            if image.is_file() and image.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'):
                if image.stem in mapping:
                    errors.append(f'Duplicate image stem {image.stem} in {kind}')
                mapping[image.stem] = image.relative_to(ROOT).as_posix()
        images[kind] = mapping

    chars, by_id, by_number = [], {}, {}
    for row in source['characters']:
        key = row['source_id']
        if not isinstance(key, str) or not key.strip():
            errors.append(f'characters row {row["_row"]}: missing text ID')
            continue
        if key in by_id:
            errors.append(f'Duplicate character ID {key}')
            continue
        by_id[key] = row
        if row['work_number'] in by_number:
            errors.append(f'Duplicate work number {row["work_number"]}')
        by_number[row['work_number']] = row
        if key in config.get('quarantineCharacters', {}):
            if row['name'] or key in images['characters']:
                errors.append(f'{key}: quarantine is stale; review configuration')
            quarantine.append({'sheet': config['sheets']['characters']['name'], 'row': row['_row'],
                               'id': key, 'reason': config['quarantineCharacters'][key]})
            continue
        if not row['name']:
            errors.append(f'{key}: missing character name')
            continue
        image = images['characters'].get(key)
        if not image:
            warnings.append(f'{key}: missing image; placeholder needed')
        chars.append({'source_id': key, 'slug': slug(key), 'name': row['name'],
                      'description': '', 'note': row['note'], 'image_source': image,
                      'sort_order': len(chars), 'is_published': config['defaultPublication'] != 'private'})

    arcs, chapters, story_ids = [], [], set()
    for row in source['stories']:
        key = row['source_id']
        if not isinstance(key, str) or not key.strip() or key in story_ids:
            errors.append(f'stories row {row["_row"]}: missing or duplicate ID {key}')
            continue
        story_ids.add(key)
        if not row['title']:
            errors.append(f'{key}: missing title')
        try:
            kr, jp = iso_date(row['release_date_kr']), iso_date(row['release_date_jp'])
            is_public = published(row['published'], config['defaultPublication'], kr, jp, today)
        except (ValueError, TypeError) as ex:
            errors.append(f'{key}: {ex}')
            continue
        item = {'source_id': key, 'slug': slug(key), 'title': row['title'], 'summary': row['summary'] or '',
                'release_date_kr': kr, 'release_date_jp': jp, 'is_published': is_public,
                'image_source': images['stories'].get(key), 'source_row': row['_row']}
        if not item['image_source']:
            warnings.append(f'{key}: missing image; placeholder needed')
        if row['kind'] == config['storyTypes']['arc']:
            if row['parent_id']:
                errors.append(f'{key}: arc must have no parent')
            item['sort_order'] = len(arcs)
            arcs.append(item)
        elif row['kind'] == config['storyTypes']['chapter']:
            item['arc_source_id'] = row['parent_id']
            # Source sheet interleaves arcs and places chapter 4 before chapter 3.
            match = re.search(r'-(\d+)$', key)
            if not match:
                errors.append(f'{key}: explicit chapter order required')
                continue
            item['sort_order'] = int(match.group(1))
            chapters.append(item)
        else:
            errors.append(f'{key}: unknown story type {row["kind"]!r}')
    arc_ids = {item['source_id'] for item in arcs}
    chapter_ids = {item['source_id'] for item in chapters}
    for chapter in chapters:
        if chapter['arc_source_id'] not in arc_ids:
            errors.append(f'{chapter["source_id"]}: unknown parent {chapter["arc_source_id"]}')

    appearance_rows, pairs, order = [], set(), Counter()
    valid_chars = {item['source_id'] for item in chars}
    for row in source['appearances']:
        story = config.get('storyAliases', {}).get(row['story_id'], row['story_id'])
        if story != row['story_id']:
            changes.append({'row': row['_row'], 'field': 'story_id', 'from': row['story_id'], 'to': story})
        character = row['character_id']
        if not character and row['work_number'] is None and not row['name']:
            if row['_row'] in config.get('allowEmptyAppearanceRows', []) and story in chapter_ids:
                quarantine.append({'sheet': config['sheets']['appearances']['name'], 'row': row['_row'],
                                   'reason': 'No character selected; do not invent an appearance'})
            else:
                errors.append(f'appearances row {row["_row"]}: missing character')
            continue
        if story not in chapter_ids or character not in valid_chars:
            errors.append(f'appearances row {row["_row"]}: invalid FK ({story}, {character})')
            continue
        # Reconcile cached lookup output with current character ID, never use No as a DB FK.
        master = by_number.get(row['work_number'])
        if not master or master['source_id'] != character or master['name'] != row['name']:
            errors.append(f'appearances row {row["_row"]}: stale or missing cached lookup; recalculate Excel')
            continue
        pair = (story, character)
        if pair in pairs:
            errors.append(f'appearances row {row["_row"]}: duplicate {pair}')
            continue
        pairs.add(pair)
        order[story] += 1
        rank = row['sort_order'] if row['sort_order'] is not None else order[story]
        if not isinstance(rank, (int, float)) or isinstance(rank, bool) or int(rank) != rank:
            errors.append(f'appearances row {row["_row"]}: invalid display order')
            continue
        appearance_rows.append({'chapter_source_id': story, 'character_source_id': character,
                                'sort_order': int(rank), 'is_featured': False})
    if config.get('characterPublication') == 'public-chapter-appearances':
        public_arcs = {item['source_id'] for item in arcs if item['is_published']}
        public_chapters = {item['source_id'] for item in chapters
                           if item['is_published'] and item['arc_source_id'] in public_arcs}
        public_characters = {item['character_source_id'] for item in appearance_rows
                             if item['chapter_source_id'] in public_chapters}
        for character in chars:
            character['is_published'] = character['source_id'] in public_characters
    for key in sorted(chapter_ids - set(order)):
        warnings.append(f'{key}: no appearances supplied')
    for table in (chars, arcs, chapters):
        seen = set()
        for row in table:
            scope = (row.get('arc_source_id'), row['slug'])
            if scope in seen:
                errors.append(f'Slug collision {scope}')
            seen.add(scope)

    payload = {'game': {**config['game'], 'is_published': config['defaultPublication'] != 'private'},
               'characters': chars, 'arcs': arcs, 'chapters': chapters, 'appearances': appearance_rows}
    report = {'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
              'publication_policy': config['defaultPublication'], 'as_of': today,
              'counts': {k: len(v) for k, v in payload.items() if isinstance(v, list)},
              'errors': errors, 'warnings': warnings, 'normalizations': changes, 'quarantine': quarantine}
    return payload, report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--as-of', default=date.today().isoformat())
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding='utf-8'))
    payload, report = prepare(config, date.fromisoformat(args.as_of).isoformat())
    out = ROOT / 'data/reports' / config['game']['slug']
    out.mkdir(parents=True, exist_ok=True)
    (out / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    # Always overwrite staging, including a rejected result, so a stale success cannot be imported.
    staging = {'valid': not report['errors'], 'report': report, 'data': payload if not report['errors'] else None}
    (out / 'staging.json').write_text(json.dumps(staging, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'normalizations'}, ensure_ascii=False, indent=2))
    return 1 if report['errors'] else 0

if __name__ == '__main__':
    sys.exit(main())
