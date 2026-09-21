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
const parsed = parseWorkbook(sheets, config, "2026-09-20");
const empty = () => Object.fromEntries(tables.map((t) => [t, []]));
test("real workbook preserves IDs, quarantines empty rows and enforces KR policy", () => {
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(parsed.records).map(([k, v]) => [k, v.length]),
    ),
    {
      games: 1,
      story_arcs: 12,
      chapters: 29,
      characters: 214,
      appearances: 703,
    },
  );
  assert.equal(
    parsed.records.chapters.filter((x) => x.is_published).length,
    24,
  );
  assert.equal(
    parsed.records.characters.filter((x) => x.is_published).length,
    173,
  );
  assert.ok(
    parsed.records.appearances.some((x) => x.chapter_source_id === "BA_CH_F-1"),
  );
});
test("import is idempotent, preserves publication/images/order and missing records", () => {
  const first = planImport(parsed, empty(), randomUUID);
  assert.deepEqual(first.errors, []);
  assert.equal(first.plans.length, 959);
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
  assert.equal(again.unchanged, 959);
  snapshot.chapters[0].summary = "edited in admin";
  const changed = planImport(parsed, snapshot, randomUUID);
  assert.equal(changed.plans.length, 1);
  assert.deepEqual(Object.keys(changed.plans[0].operation.patch), ["summary"]);
  assert.equal(changed.plans[0].operation.expected, "2026-09-20T00:00:00Z");
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
