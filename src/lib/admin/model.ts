export type Row = Record<string, unknown>;
export type Table =
  | "games"
  | "story_arcs"
  | "chapters"
  | "characters"
  | "appearances"
  | "site_settings";
export type Operation = {
  table: Table;
  key: Row;
  expected: string | null;
  patch: Row;
};
export type Field = {
  key: string;
  label: string;
  type: "text" | "long" | "number" | "boolean" | "date" | "image";
};
const field = (
  key: string,
  label: string,
  type: Field["type"] = "text",
): Field => ({ key, label, type });
const common = [
  field("sort_order", "표시 순서", "number"),
  field("is_published", "공개", "boolean"),
];
const story = [
  field("title", "제목"),
  field("summary", "줄거리", "long"),
  field("release_date_kr", "한국 공개일", "date"),
  field("release_date_jp", "일본 공개일", "date"),
  field("cover_image", "카드 이미지 경로", "image"),
  field("detail_image", "상세 이미지 경로", "image"),
  ...common,
];
export const definitions: Record<Table, { label: string; fields: Field[] }> = {
  games: {
    label: "게임",
    fields: [
      field("title", "게임명"),
      field("description", "소개", "long"),
      field("cover_image", "대표 이미지 경로", "image"),
      field("hero_image", "큰 이미지 경로", "image"),
      ...common,
    ],
  },
  story_arcs: { label: "편", fields: story },
  chapters: { label: "장", fields: story },
  characters: {
    label: "캐릭터",
    fields: [
      field("name", "이름"),
      field("description", "소개", "long"),
      field("image", "상세 이미지 경로", "image"),
      field("thumbnail", "작은 이미지 경로", "image"),
      ...common,
    ],
  },
  appearances: {
    label: "등장 관계",
    fields: [
      field("sort_order", "표시 순서", "number"),
      field("is_featured", "대표 등장", "boolean"),
    ],
  },
  site_settings: { label: "사이트 설정", fields: [] },
};
export const tables = Object.keys(definitions) as Table[];
export const rowKey = (table: Table, row: Row): Row =>
  table === "appearances"
    ? { chapter_id: row.chapter_id, character_id: row.character_id }
    : table === "site_settings"
      ? { key: row.key }
      : { id: row.id };
export function cleanPatch(table: Table, input: Row): Row {
  const out: Row = {};
  for (const f of definitions[table].fields) {
    if (!(f.key in input)) continue;
    const value = input[f.key];
    if (f.type === "boolean") {
      if (typeof value !== "boolean")
        throw Error(`${f.label}: 참/거짓을 선택해 주세요.`);
      out[f.key] = value;
    } else if (f.type === "number") {
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > 100000
      )
        throw Error(`${f.label}: 0~100000 정수를 입력해 주세요.`);
      out[f.key] = value;
    } else {
      if (value !== null && typeof value !== "string")
        throw Error(`${f.label}: 문자열이어야 합니다.`);
      const text = String(value ?? "").trim();
      if (text.length > 10000) throw Error(`${f.label}: 너무 깁니다.`);
      if (
        f.type === "date" &&
        text &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(text) ||
          !Number.isFinite(Date.parse(text)) ||
          new Date(text).toISOString().slice(0, 10) !== text)
      )
        throw Error(`${f.label}: 올바른 날짜를 입력해 주세요.`);
      if (
        f.type === "image" &&
        text &&
        !/^[a-z0-9-]+\/(stories|characters)\/[A-Za-z0-9_-]+\.webp$/.test(text)
      )
        throw Error(`${f.label}: 등록된 WebP 객체 경로를 입력해 주세요.`);
      if ((f.key === "title" || f.key === "name") && !text)
        throw Error(`${f.label}은 필수입니다.`);
      out[f.key] =
        f.type === "date" || f.type === "image" ? text || null : text;
    }
  }
  return out;
}
