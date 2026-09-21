import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import readWorkbook from "read-excel-file/node";
import { parseWorkbook, planImport } from "../src/lib/import/workbook.ts";
import { cleanPatch, tables } from "../src/lib/admin/model.ts";
const config = JSON.parse(
  fs.readFileSync(
    new URL("../config/import/blue-archive.json", import.meta.url),
    "utf8",
  ),
);
const sheets = await readWorkbook(
  fs.readFileSync(
    new URL("../data/raw/excel/블루아카이브.xlsx", import.meta.url),
  ),
);
Object.assign(config,JSON.parse(fs.readFileSync(new URL('../config/import/blue-archive-assets.json',import.meta.url),'utf8')));
const parsed = parseWorkbook(sheets, config, "2026-09-20");
const empty = () => Object.fromEntries(tables.map((t) => [t, []]));
test("real workbook preserves IDs, quarantines empty rows and enforces KR policy", () => {
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.records.story_arcs.filter(x=>x.story_kind==='event').length,51);
  assert.equal(parsed.records.story_arcs.filter(x=>x.story_kind==='event'&&x.is_published).length,48);
  assert.ok(parsed.records.story_arcs.filter(x=>x.story_kind==='event'&&x.is_published).every(x=>x.cover_image&&x.detail_image));
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(parsed.records).map(([k, v]) => [k, v.length]),
    ),
    {
      games: 1,
      story_arcs: 63,
      chapters: 80,
      characters: 217,
      appearances: 1351,
    },
  );
  assert.equal(
    parsed.records.chapters.filter((x) => x.is_published).length,
    74,
  );
  assert.equal(
    parsed.records.characters.filter((x) => x.is_published).length,
    199,
  );
  assert.ok(
    parsed.records.appearances.some((x) => x.chapter_source_id === "BA_CH_F-1"),
  );
});
test("import is idempotent, preserves publication/images/order and missing records", () => {
  const first = planImport(parsed, empty(), randomUUID);
  assert.deepEqual(first.errors, []);
  assert.equal(first.plans.length, 1712);
  const snapshot = empty();
  for (const p of first.plans)
    snapshot[p.operation.table].push({
      ...p.operation.patch,
      ...p.operation.key,
      updated_at: "2026-09-20T00:00:00Z",
    });
  snapshot.games[0].is_published = true;
  snapshot.characters[0].image = "retained.webp";
  snapshot.characters[0].sort_order = 999;
  const again = planImport(parsed, snapshot, randomUUID);
  assert.equal(again.plans.length, 0);
  assert.equal(again.unchanged, 1712);
  snapshot.chapters[0].summary = "edited in admin";
  const changed = planImport(parsed, snapshot, randomUUID);
  assert.equal(changed.plans.length, 1);
  assert.deepEqual(Object.keys(changed.plans[0].operation.patch), ["summary"]);
  assert.equal(changed.plans[0].operation.expected, "2026-09-20T00:00:00Z");
});
test("moved empty appearance rows are skipped but incomplete assignments are rejected", () => {
  const moved = structuredClone(sheets);
  const sheet = moved.find(s => s.sheet === 'Appearances');
  const header = sheet.data[1];
  const row = Array(header.length).fill(null);
  row[header.indexOf('story_id')] = 'BA_CHF-1';
  sheet.data.push(row);
  assert.deepEqual(parseWorkbook(moved, config, '2026-09-21').errors, []);
  row[header.indexOf('No')] = 69;
  assert.ok(parseWorkbook(moved, config, '2026-09-21').errors.some(e => e.includes('캐릭터 ID')));
});
test("existing appearance order changes are previewed without deleting missing rows", () => {
  const initial=planImport(parsed,empty(),randomUUID);
  const snapshot=empty();
  for(const p of initial.plans) snapshot[p.operation.table].push({...p.operation.patch,...p.operation.key,updated_at:'2026-09-20T00:00:00Z'});
  snapshot.appearances[0].sort_order=999;
  const result=planImport(parsed,snapshot,randomUUID);
  assert.equal(result.plans.length,1);
  assert.equal(result.plans[0].operation.table,'appearances');
  assert.deepEqual(result.plans[0].operation.patch,{sort_order:parsed.records.appearances[0].sort_order});
});
test('optional GAMES images are validated, previewed and preserve existing image when blank',()=>{
 const withGame=structuredClone(sheets);withGame.push({sheet:'GAMES',data:[['source_id','hero_image','cover_image'],['BA','blue-archive/stories/GAME_HEADER_test.webp',null]]});
 const result=parseWorkbook(withGame,config,'2026-09-21');assert.deepEqual(result.errors,[]);assert.equal(result.records.games[0].hero_image,'blue-archive/stories/GAME_HEADER_test.webp');
 const snapshot=empty();for(const p of planImport(parsed,empty(),randomUUID).plans)snapshot[p.operation.table].push({...p.operation.patch,...p.operation.key,updated_at:'2026-09-21T00:00:00Z'});
 snapshot.games[0].hero_image='blue-archive/stories/old.webp';snapshot.games[0].cover_image='blue-archive/stories/card.webp';
 const plan=planImport(result,snapshot,randomUUID);assert.equal(plan.plans.length,1);assert.deepEqual(plan.plans[0].operation.patch,{hero_image:'blue-archive/stories/GAME_HEADER_test.webp'});
 withGame.at(-1).data[1][1]='';assert.equal(planImport(parseWorkbook(withGame,config,'2026-09-21'),snapshot,randomUUID).plans.length,0);
 for(const invalid of ['https://evil.test/a.webp','other-game/stories/a.webp','blue-archive/stories/../../bad.webp']){withGame.at(-1).data[1][1]=invalid;assert.ok(parseWorkbook(withGame,config,'2026-09-21').errors.length);}
});
test("missing columns and stale lookup values block all changes", () => {
  const bad = structuredClone(sheets);
  bad.find((s) => s.sheet === "CHARACTERS").data[2][1] = "wrong";
  const rejected = parseWorkbook(bad, config, "2026-09-20");
  assert.ok(rejected.errors.length);
  assert.equal(planImport(rejected, empty(), randomUUID).plans.length, 0);
  const wrong = structuredClone(sheets);
  const spec = config.sheets.appearances;
  const sheet = wrong.find((s) => s.sheet === spec.name);
  const col = sheet.data[spec.headerRow - 1].indexOf("character_id");
  sheet.data[spec.headerRow][col] = "missing";
  assert.ok(parseWorkbook(wrong, config, "2026-09-20").errors.length);
});
test("content validation rejects malformed dates, negative order and external image URLs", () => {
  assert.throws(() =>
    cleanPatch("chapters", { release_date_kr: "2026-02-30" }),
  );
  assert.throws(() => cleanPatch("characters", { sort_order: -1 }));
  assert.throws(() =>
    cleanPatch("characters", { image: "https://elsewhere.test/image.webp" }),
  );
  assert.deepEqual(
    cleanPatch("chapters", { title: " Good ", release_date_jp: "" }),
    { title: "Good", release_date_jp: null },
  );
});
