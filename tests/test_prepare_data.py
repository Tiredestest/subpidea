"""Boundary and regression checks for the import preparation pipeline."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare_data', ROOT / 'scripts/prepare-data.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PreparationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = json.loads((ROOT / 'config/import/blue-archive.json').read_text(encoding='utf-8'))

    def run_import(self, mutate=None, config=None):
        original = module.read_rows
        def read(book, sheet):
            rows = original(book, sheet)
            if mutate:
                mutate(sheet['name'], rows)
            return rows
        with patch.object(module, 'read_rows', side_effect=read):
            return module.prepare(config or self.config, '2026-09-20')

    def test_real_source_counts_and_publication(self):
        data, report = self.run_import()
        self.assertEqual(report['errors'], [])
        self.assertEqual(report['counts'], {'characters':214, 'arcs':12, 'chapters':29, 'appearances':703})
        self.assertEqual(sum(x['is_published'] for x in data['chapters']), 24)
        self.assertEqual(sum(x['is_published'] for x in data['arcs']), 10)
        self.assertEqual(sum(x['is_published'] for x in data['characters']), 173)
        self.assertTrue(all(not x['is_published'] for x in data['chapters'] if not x['release_date_kr']))

    def test_aliases_and_quarantined_rows(self):
        data, report = self.run_import()
        self.assertEqual(len(report['normalizations']), 278)
        self.assertEqual(len(report['quarantine']), 5)
        self.assertNotIn('BA_C_187', {x['source_id'] for x in data['characters']})
        self.assertTrue(all(not x['chapter_source_id'].startswith('BA_CHF') for x in data['appearances']))

    def test_duplicate_character_rejected(self):
        def mutate(name, rows):
            if name == 'CHARACTERS': rows.append(copy.deepcopy(rows[0]))
        _, report = self.run_import(mutate)
        self.assertTrue(any('Duplicate character ID' in x for x in report['errors']))

    def test_unknown_fk_rejected(self):
        def mutate(name, rows):
            if name == 'Appearances': rows[0]['story_id'] = 'UNKNOWN'
        _, report = self.run_import(mutate)
        self.assertTrue(any('invalid FK' in x for x in report['errors']))

    def test_duplicate_appearance_rejected(self):
        def mutate(name, rows):
            if name == 'Appearances': rows.append(copy.deepcopy(rows[0]))
        _, report = self.run_import(mutate)
        self.assertTrue(any('duplicate (' in x for x in report['errors']))

    def test_stale_formula_cache_rejected(self):
        def mutate(name, rows):
            if name == 'Appearances': rows[0]['character_id'] = 'BA_C_000'
        _, report = self.run_import(mutate)
        self.assertTrue(any('cached lookup' in x for x in report['errors']))

    def test_missing_formula_cache_rejected(self):
        def mutate(name, rows):
            if name == 'Appearances': rows[0]['character_id'] = None
        _, report = self.run_import(mutate)
        self.assertTrue(any('invalid FK' in x for x in report['errors']))

    def test_filled_quarantine_requires_review(self):
        def mutate(name, rows):
            if name == 'CHARACTERS':
                next(x for x in rows if x['source_id'] == 'BA_C_187')['name'] = '새 캐릭터'
        _, report = self.run_import(mutate)
        self.assertTrue(any('quarantine is stale' in x for x in report['errors']))

    def test_private_policy(self):
        config = copy.deepcopy(self.config)
        config['defaultPublication'] = 'private'
        data, report = self.run_import(config=config)
        self.assertFalse(data['game']['is_published'])
        self.assertTrue(all(not x['is_published'] for key in ['characters','arcs','chapters'] for x in data[key]))

    def test_release_date_boundaries(self):
        self.assertTrue(module.published(None, 'kr', '2026-09-20', None, '2026-09-20'))
        self.assertFalse(module.published(None, 'kr', '2026-09-21', None, '2026-09-20'))
        self.assertFalse(module.published(None, 'kr', None, '2026-01-01', '2026-09-20'))
        with self.assertRaises(ValueError): module.published('maybe', 'kr', None, None, '2026-09-20')

    def test_chapter_number_not_spreadsheet_position(self):
        data, _ = self.run_import()
        chapters = {x['source_id']: x for x in data['chapters']}
        self.assertLess(chapters['BA_CH3-4']['source_row'], chapters['BA_CH3-3']['source_row'])
        self.assertGreater(chapters['BA_CH3-4']['sort_order'], chapters['BA_CH3-3']['sort_order'])

    def test_deterministic_preparation(self):
        self.assertEqual(self.run_import(), self.run_import())

if __name__ == '__main__':
    unittest.main()
