import Link from "next/link";
import { adminSnapshot, requireAdmin } from "@/lib/admin/server";
import { definitions } from "@/lib/admin/model";
export default async function Admin() {
  const [data, { db }] = await Promise.all([adminSnapshot(), requireAdmin()]);
  const [ratings, comments] = await Promise.all([
    db.from("ratings").select("id", { count: "exact", head: true }),
    db.from("comments").select("id", { count: "exact", head: true }),
  ]);
  return (
    <section className="admin-section">
      <h2>운영 현황</h2>
      <div className="admin-stats">
        {(["games", "story_arcs", "chapters", "characters"] as const).map(
          (table) => (
            <div key={table}>
              <span>{definitions[table].label}</span>
              <strong>{data[table].length}</strong>
              <small>
                공개 설정 {data[table].filter((r) => r.is_published).length}개
              </small>
            </div>
          ),
        )}
        <div>
          <span>평가</span>
          <strong>{ratings.count ?? "—"}</strong>
        </div>
        <div>
          <span>한줄평</span>
          <strong>{comments.count ?? "—"}</strong>
        </div>
      </div>
      <p className="muted">
        하위 콘텐츠가 공개여도 부모 게임이나 편이 비공개면 이용자에게 표시되지
        않습니다. 평가·한줄평은 현재 권한으로 조회되는 수입니다.
      </p>
      <div className="admin-help">
        <h3>운영 순서</h3>
        <ol>
          <li>
            <Link href="/admin/import">Excel 가져오기</Link>에서 파일을 검사하고
            변경 목록을 확인합니다.
          </li>
          <li>
            새 게임은 비공개로 추가됩니다. 이미지와 내용을 확인한 뒤{" "}
            <Link href="/admin/content">콘텐츠 편집</Link>에서 공개합니다.
          </li>
          <li>
            평가·한줄평을 일시 중지하려면{" "}
            <Link href="/admin/settings">사이트 설정</Link>을 이용합니다.
          </li>
        </ol>
      </div>
    </section>
  );
}
