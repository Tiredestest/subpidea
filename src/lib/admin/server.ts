import "server-only";
import { userDb } from "@/lib/supabase/server";
import { tables, type Row, type Table } from "./model";
export async function requireAdmin() {
  const db = await userDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin")
    throw Error("관리자 로그인이 필요합니다.");
  return { db, user };
}
export async function adminSnapshot() {
  const { db } = await requireAdmin();
  const entries = await Promise.all(
    tables.map(async (table) => {
      const rows: Row[] = [];
      for (let start = 0; ; start += 500) {
        let query = db.from(table).select("*");
        query =
          table === "appearances"
            ? query.order("chapter_id").order("character_id")
            : query.order(table === "site_settings" ? "key" : "id");
        const { data, error } = await query.range(start, start + 499);
        if (error) throw Error("관리 데이터를 불러오지 못했습니다.");
        rows.push(...data);
        if (data.length < 500) break;
        if (rows.length > 20000)
          throw Error("관리 화면 조회 범위를 초과했습니다.");
      }
      return [table, rows] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Table, Row[]>;
}
