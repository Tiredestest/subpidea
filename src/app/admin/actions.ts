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
export async function manageAppearance(input:{chapter:string;person:string;newPerson:string|null;active:boolean;position:number;expected:string|null}){
 try{
  const {db}=await requireAdmin();const uuid=/^[0-9a-f-]{36}$/i;
  if(!uuid.test(input.chapter)||!uuid.test(input.person)||(input.newPerson&&!uuid.test(input.newPerson))||!Number.isInteger(input.position)||input.position<0||input.position>100000)throw Error('장·캐릭터·순서를 확인해 주세요.');
  const {error}=await db.rpc('admin_manage_appearance',{chapter:input.chapter,person:input.person,new_person:input.newPerson,active:input.active,sort_position:input.position,expected:input.expected});
  if(error)throw Error(error.code==='40001'?error.message:'적용하지 못했습니다. 이미 등록된 캐릭터인지, 같은 게임인지 확인해 주세요.');
  revalidatePath('/','layout');return {ok:true};
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'저장 실패'};}
}
