"use server";
import { requireAdmin } from "@/lib/admin/server";
import {
  cleanPatch,
  rowKey,
  tables,
  type Table,
  type Row,
  type Operation,
} from "@/lib/admin/model";
import { revalidatePath } from "next/cache";
export async function saveContent(table: Table, row: Row, input: Row) {
  try {
    if (!tables.includes(table) || table === "site_settings")
      throw Error("지원하지 않는 대상입니다.");
    const patch = cleanPatch(table, input);
    if (!Object.keys(patch).length) throw Error("변경할 내용이 없습니다.");
    return await applyAdminBatch([
      {
        table,
        key: rowKey(table, row),
        expected: String(row.updated_at),
        patch,
      },
    ]);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "저장하지 못했습니다.",
    };
  }
}
export async function applyAdminBatch(operations: Operation[]) {
  try {
    const { db } = await requireAdmin();
    if (!Array.isArray(operations) || operations.length > 3000)
      throw Error("변경 건수를 확인해 주세요.");
    const { data, error } = await db.rpc("admin_apply_changes", { operations });
    if (error)
      throw Error(
        error.code === "40001"
          ? error.message
          : "변경을 적용하지 못했습니다. 입력값·관계·권한을 확인해 주세요.",
      );
    revalidatePath("/", "layout");
    return { ok: true, count: Number(data) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "저장하지 못했습니다.",
    };
  }
}
