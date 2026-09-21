import type { Row, Table, Operation } from "../admin/model.ts";
export type Mapping = {
  game: { source_id: string; slug: string; title: string };
  sheets: Record<
    string,
    { name: string; headerRow: number; fields: Record<string, string> }
  >;
  storyTypes: { arc: string; chapter: string; event?: string };
  storyImages?: Record<string, {cover_image: string; detail_image: string}>;
  characterImages?: Record<string, {image: string; thumbnail: string}>;
  storyAliases: Record<string, string>;
  quarantineCharacters: Record<string, string>;
  allowEmptyAppearanceRows: number[];
};
export type Sheet = { sheet: string; data: unknown[][] };
export type ImportResult = {
  errors: string[];
  warnings: string[];
  records: Record<
    "games" | "story_arcs" | "chapters" | "characters" | "appearances",
    Row[]
  >;
};
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
function date(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const text =
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    !Number.isFinite(Date.parse(text)) ||
    new Date(text).toISOString().slice(0, 10) !== text
  )
    throw Error("날짜는 YYYY-MM-DD 또는 Excel 날짜 셀이어야 합니다.");
  return text;
}
export function parseWorkbook(
  sheets: Sheet[],
  config: Mapping,
  today: string,
): ImportResult {
  const errors: string[] = [],
    warnings: string[] = [];
  const source: Record<string, Row[]> = {};
  for (const [kind, spec] of Object.entries(config.sheets)) {
    const sheet = sheets.find((s) => s.sheet === spec.name);
    if (!sheet) {
      errors.push(`${spec.name}: 시트가 없습니다.`);
      continue;
    }
    const headers = sheet.data[spec.headerRow - 1] ?? [];
    const positions: Record<string, number> = {};
    for (const [key, label] of Object.entries(spec.fields)) {
      if (headers.filter((x) => x === label).length !== 1)
        errors.push(`${spec.name}: ${label} 열이 없거나 중복입니다.`);
      positions[key] = headers.indexOf(label);
    }
    source[kind] = sheet.data.slice(spec.headerRow).flatMap((values, index) => {
      const row = Object.fromEntries(
        Object.entries(positions).map(([k, pos]) => [k, values[pos] ?? null]),
      );
      return Object.values(row).every((v) => v === null || v === "")
        ? []
        : [{ ...row, _row: index + spec.headerRow + 1 }];
    });
  }
  const records: ImportResult["records"] = {
    games: [{ ...config.game, is_published: false }],
    story_arcs: [],
    chapters: [],
    characters: [],
    appearances: [],
  };
  if (errors.length) return { errors, warnings, records };
  // Optional game metadata sheet; blank/missing paths preserve existing images.
  const gameSheet=sheets.find(s=>s.sheet==='GAMES');
  if(gameSheet){
    const headers=gameSheet.data[0]??[];
    const fields=['source_id','hero_image','cover_image'];
    if(fields.some(f=>headers.filter(h=>h===f).length!==1))errors.push('GAMES: 1행에 source_id, hero_image, cover_image 열이 각각 필요합니다.');
    else {
      const rows=gameSheet.data.slice(1).filter(row=>row.some(v=>v!==null&&v!==undefined&&v!==''));
      if(rows.length!==1||rows[0][headers.indexOf('source_id')]!==config.game.source_id)errors.push('GAMES: 현재 게임 ID와 일치하는 한 행만 입력해 주세요.');
      else for(const field of ['hero_image','cover_image']){
        const value=rows[0][headers.indexOf(field)];
        if(value===null||value===undefined||value==='')continue;
        if(typeof value!=='string'||!new RegExp('^'+config.game.slug+'/stories/[A-Za-z0-9_-]+\\.webp$').test(value))errors.push(`GAMES: ${field}에는 해당 게임의 업로드된 WebP 경로를 입력해 주세요.`);
        else records.games[0][field]=value;
      }
    }
  }
  if(errors.length)return {errors,warnings,records};
  if (Object.values(source).reduce((n, r) => n + r.length, 0) > 10000)
    return {
      errors: ["파일당 최대 10,000행을 지원합니다."],
      warnings,
      records,
    };
  const charIds = new Set<string>(),
    numbers = new Map<unknown, Row>(),
    storyIds = new Set<string>();
  const id = (r: Row, kind: string) => {
    if (typeof r.source_id !== "string" || !r.source_id.trim())
      throw Error(`${kind} ${r._row}행: 텍스트 ID가 필요합니다.`);
    return r.source_id;
  };
  for (const r of source.characters) {
    try {
      const key = id(r, "캐릭터");
      if (charIds.has(key)) throw Error(`${key}: 중복 ID입니다.`);
      charIds.add(key);
      if (numbers.has(r.work_number))
        throw Error(`${key}: 작업 순번 중복입니다.`);
      numbers.set(r.work_number, r);
      if (key in config.quarantineCharacters) {
        if (r.name)
          throw Error(
            `${key}: 예약 행이 변경되었습니다. 매핑을 갱신해 주세요.`,
          );
        warnings.push(`${key}: 이름 없는 예약 행 제외`);
        continue;
      }
      if (typeof r.name !== "string" || !r.name.trim())
        throw Error(`${key}: 이름이 없습니다.`);
      records.characters.push({
        source_id: key,
        slug: slug(key),
        name: r.name,
        ...(config.characterImages?.[key] ?? {}),
        sort_order: records.characters.length,
        is_published: false,
      });
    } catch (e) {
      errors.push(String((e as Error).message));
    }
  }
  for (const r of source.stories) {
    try {
      const key = id(r, "스토리");
      if (storyIds.has(key)) throw Error(`${key}: 중복 스토리 ID입니다.`);
      storyIds.add(key);
      if (r.kind === config.storyTypes.event &&
          [r.parent_id,r.title,r.release_date_kr,r.release_date_jp,r.published,r.summary].every(v=>v===null||v==='')) {
        warnings.push(`${key}: 빈 이벤트 예약 행 제외`);
        continue;
      }
      if (typeof r.title !== "string" || !r.title.trim())
        throw Error(`${key}: 제목이 없습니다.`);
      const kr = date(r.release_date_kr),
        jp = date(r.release_date_jp);
      const published = !!kr && kr <= today;
      const row: Row = {
        source_id: key,
        slug: slug(key),
        title: r.title,
        summary: String(r.summary ?? ""),
        release_date_kr: kr,
        release_date_jp: jp,
        is_published: published,
        ...(config.storyImages?.[key] ?? {}),
      };
      if (r.published !== null && r.published !== "")
        warnings.push(
          `${key}: Excel 공개상태 대신 신규 행은 한국 공개일 기준, 기존 행은 현재 공개 상태를 유지합니다.`,
        );
      if (r.kind === config.storyTypes.arc) {
        if (r.parent_id) throw Error(`${key}: 편에 부모 ID가 있습니다.`);
        records.story_arcs.push({
          ...row,
          story_kind: 'main',
          sort_order: records.story_arcs.length,
        });
      } else if (r.kind === config.storyTypes.event) {
        if(r.parent_id) throw Error(`${key}: 이벤트에 부모 ID가 있습니다.`);
        records.story_arcs.push({...row,story_kind:'event',sort_order:records.story_arcs.length});
        records.chapters.push({...row,arc_source_id:key,sort_order:1});
      } else if (r.kind === config.storyTypes.chapter) {
        const order = key.match(/-(\d+)$/);
        if (!order) throw Error(`${key}: 장 번호를 판독할 수 없습니다.`);
        records.chapters.push({
          ...row,
          arc_source_id: r.parent_id,
          sort_order: Number(order[1]),
        });
      } else throw Error(`${key}: 알 수 없는 스토리 유형입니다.`);
    } catch (e) {
      errors.push(`스토리 ${r._row}행: ${(e as Error).message}`);
    }
  }
  const arcs = new Map(records.story_arcs.map((r) => [r.source_id, r]));
  const chapters = new Map(records.chapters.map((r) => [r.source_id, r]));
  const characters = new Map(records.characters.map((r) => [r.source_id, r]));
  for (const c of records.chapters)
    if (!arcs.has(c.arc_source_id))
      errors.push(`${c.source_id}: 존재하지 않는 부모 편 ${c.arc_source_id}`);
  const pairs = new Map<string,string>(),
    orders = new Map<unknown, number>();
  let aliases = 0;
  for (const r of source.appearances) {
    try {
      const story = config.storyAliases[String(r.story_id)] ?? r.story_id;
      if (story !== r.story_id) aliases++;
      if (
        !r.character_id &&
        r.work_number === null &&
        !r.name &&
        (r.sort_order === null || r.sort_order === "") &&
        (r.note === null || r.note === "") &&
        chapters.has(story)
      ) {
        warnings.push(`등장 ${r._row}행: 빈 예약 행 제외`);
        continue;
      }
      if (!chapters.has(story))
        throw Error(`장 ID '${String(story ?? "")}'가 STORIES에 없습니다.`);
      if (!characters.has(r.character_id))
        throw Error(`캐릭터 ID '${String(r.character_id ?? "")}'가 CHARACTERS에 없습니다. No·character_id·name을 확인하고 수식을 다시 계산해 저장해 주세요.`);
      const master = numbers.get(r.work_number);
      if (
        !master ||
        master.source_id !== r.character_id ||
        master.name !== r.name
      )
        throw Error(
          "조회 수식 결과가 일치하지 않습니다. Excel에서 다시 계산해 저장해 주세요.",
        );
      const pair = JSON.stringify([story, r.character_id]);
      const signature=JSON.stringify([r.work_number,r.name,r.sort_order,r.note]);
      if (pairs.has(pair)) {
        if(pairs.get(pair)!==signature) throw Error("값이 서로 다른 중복 등장 관계입니다.");
        warnings.push(`등장 ${r._row}행: ${String(story)} / ${String(r.character_id)} 동일한 중복 행 제외`);
        continue;
      }
      pairs.set(pair,signature);
      const order = (orders.get(story) ?? 0) + 1;
      orders.set(story, order);
      const rank = r.sort_order ?? order;
      if (typeof rank !== "number" || !Number.isInteger(rank) || rank < 0)
        throw Error("표시 순서는 0 이상의 정수입니다.");
      records.appearances.push({
        chapter_source_id: story,
        character_source_id: r.character_id,
        sort_order: rank,
        is_featured: false,
      });
    } catch (e) {
      errors.push(`등장 ${r._row}행: ${(e as Error).message}`);
    }
  }
  if (aliases)
    warnings.push(
      `기존 승인 매핑으로 스토리 ID ${aliases}행을 정규화했습니다.`,
    );
  const publicChars = new Set(
    records.appearances
      .filter((r) => {
        const chapter = chapters.get(r.chapter_source_id);
        return (
          chapter?.is_published && arcs.get(chapter.arc_source_id)?.is_published
        );
      })
      .map((r) => r.character_source_id),
  );
  for (const c of records.characters)
    c.is_published = publicChars.has(c.source_id);
  for (const rows of [
    records.story_arcs,
    records.chapters,
    records.characters,
  ]) {
    const seen = new Set();
    for (const r of rows) {
      const key = JSON.stringify([r.arc_source_id ?? "", r.slug]);
      if (!r.slug || seen.has(key))
        errors.push(`${r.source_id}: URL 이름이 충돌합니다.`);
      seen.add(key);
    }
  }
  return { errors, warnings, records };
}

export type Planned = {
  operation: Operation;
  label: string;
  changes: { field: string; before: unknown; after: unknown }[];
};
export function planImport(
  parsed: ImportResult,
  current: Record<Table, Row[]>,
  newId: () => string,
) {
  const plans: Planned[] = [];
  const errors = [...parsed.errors];
  let unchanged = 0;
  const ids = new Map<string, string>();
  if (errors.length) return { plans, errors, unchanged };
  const existingGame = current.games.find(
    (g) => g.source_id === parsed.records.games[0].source_id,
  );
  const gameId = String(existingGame?.id ?? newId());
  const compare = (
    table: Table,
    source: Row,
    existing: Row | undefined,
    key: Row,
    patch: Row,
  ) => {
    const changes = Object.entries(patch)
      .filter(
        ([field, value]) =>
          JSON.stringify(existing?.[field] ?? null) !==
          JSON.stringify(value ?? null),
      )
      .map(([field, after]) => ({
        field,
        before: existing?.[field] ?? null,
        after,
      }));
    if (existing && !changes.length) {
      unchanged++;
      return;
    }
    plans.push({
      label: String(
        source.title ??
          source.name ??
          source.source_id ??
          `${source.chapter_source_id} / ${source.character_source_id}`,
      ),
      operation: {
        table,
        key,
        expected: existing ? String(existing.updated_at) : null,
        patch: existing
          ? Object.fromEntries(changes.map((x) => [x.field, x.after]))
          : patch,
      },
      changes,
    });
  };
  for (const table of [
    "games",
    "story_arcs",
    "chapters",
    "characters",
    "appearances",
  ] as const) {
    for (const source of parsed.records[table]) {
      const {
        arc_source_id,
        chapter_source_id,
        character_source_id,
        ...values
      } = source;
      let existing: Row | undefined;
      let key: Row;
      let patch: Row;
      if (table === "appearances") {
        const chapterId = ids.get(`chapters:${chapter_source_id}`),
          characterId = ids.get(`characters:${character_source_id}`);
        if (!chapterId || !characterId) {
          errors.push("등장 관계의 대상이 없습니다.");
          continue;
        }
        key = { chapter_id: chapterId, character_id: characterId };
        existing = current.appearances.find(
          (r) => r.chapter_id === chapterId && r.character_id === characterId,
        );
        patch = existing
          ? {sort_order: source.sort_order}
          : {
              game_id: gameId,
              sort_order: source.sort_order,
              is_featured: false,
            };
      } else {
        const parent =
          table === "chapters" ? ids.get(`story_arcs:${arc_source_id}`) : null;
        existing =
          table === "games"
            ? existingGame
            : current[table].find(
                (r) =>
                  r.game_id === gameId &&
                  r.source_id === source.source_id &&
                  (table !== "chapters" || r.arc_id === parent),
              );
        if (table === "chapters" && !parent) {
          errors.push(`${source.source_id}: 부모 편이 없습니다.`);
          continue;
        }
        const id = String(
          existing?.id ?? (table === "games" ? gameId : newId()),
        );
        key = { id };
        ids.set(`${table}:${source.source_id}`, id);
        if (existing) {
          const preserve = new Set([
            "source_id",
            "slug",
            "is_published",
            "sort_order",
          ]);
          patch = Object.fromEntries(
            Object.entries(values).filter(([k]) => !preserve.has(k)),
          );
        } else {
          patch = {
            ...values,
            ...(table === "characters" ? {is_published:false} : {}),
            ...(table === "games" ? {} : { game_id: gameId }),
            ...(table === "chapters" ? { arc_id: parent } : {}),
          };
          const duplicate = current[table].some(
            (r) =>
              r.slug === source.slug &&
              (table === "games" || r.game_id === gameId) &&
              (table !== "chapters" || r.arc_id === parent),
          );
          if (duplicate)
            errors.push(`${source.source_id}: 기존 URL과 충돌합니다.`);
        }
      }
      compare(table, source, existing, key, patch);
    }
  }
  if (plans.length > 3000) errors.push("한 번에 최대 3,000건 변경 가능합니다.");
  return { plans, errors, unchanged };
}
