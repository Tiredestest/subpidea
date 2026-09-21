import { requireAdmin } from "@/lib/admin/server";
import { definitions, type Table } from "@/lib/admin/model";
export default async function History() {
  const { db } = await requireAdmin();
  const { data, error } = await db
    .from("admin_changes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw Error("변경 기록을 불러오지 못했습니다.");
  return (
    <section className="admin-section">
      <h2>최근 변경 기록</h2>
      <p className="muted">
        관리 도구에서 적용한 최근 100건입니다. Studio 직접 수정은 포함하지
        않습니다.
      </p>
      {!data.length && <p>아직 변경 기록이 없습니다.</p>}
      {data.map((row) => (
        <details key={row.id} className="admin-history">
          <summary>
            {new Date(row.created_at).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}{" "}
            · {definitions[row.table_name as Table]?.label} ·{" "}
            {row.after_value.title ??
              row.after_value.name ??
              row.after_value.source_id ??
              row.after_value.key ??
              "등장 관계"}
          </summary>
          <p>작업자: {row.actor}</p>
          <div className="admin-diff">
            <pre>{JSON.stringify(row.before_value, null, 2)}</pre>
            <pre>{JSON.stringify(row.after_value, null, 2)}</pre>
          </div>
        </details>
      ))}
    </section>
  );
}
