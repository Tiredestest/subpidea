"use client";
import { useState } from "react";
import { applyAdminBatch } from "@/app/admin/actions";
import { definitions } from "@/lib/admin/model";
import type { Planned } from "@/lib/import/workbook";
type Preview = {
  plans: Planned[];
  errors: string[];
  warnings: string[];
  unchanged: number;
  counts: Record<string, number>;
  filename: string;
};
export function ImportManager({
  game,
}: {
  game: { source_id: string; slug: string; title: string };
}) {
  const [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [page, setPage] = useState(0);
  return (
    <section className="admin-section">
      <h2>Excel 가져오기</h2>
      <p>
        파일 검사 → 변경 검토 → 일괄 적용 순서로 진행합니다. 검사만으로는
        데이터를 변경하지 않습니다.
      </p>
      <form
        className="admin-upload"
        onChange={() => {
          setPreview(null);
          setConfirmed(false);
          setMessage("");
          setPage(0);
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setPreview(null);
          setMessage("");
          try {
            const response = await fetch("/api/admin/import", {
              method: "POST",
              body: form,
            });
            const result = await response.json();
            if (!response.ok) throw Error(result.error);
            setPreview(result);
            setConfirmed(false);
            setPage(0);
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "검사하지 못했습니다.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Excel 파일 (최대 2MB)
            <input type="file" name="file" accept=".xlsx" required />
          </label>
          <details>
            <summary>게임 정보 · 다른 게임 가져오기</summary>
            <p className="muted">
              현재와 동일한 CHARACTERS / STORIES / Appearances 양식이
              필요합니다. 다른 게임은 고유 ID와 주소를 입력하세요.
            </p>
            <label>
              게임 ID
              <input name="source_id" defaultValue={game.source_id} required />
            </label>
            <label>
              게임 주소
              <input name="slug" defaultValue={game.slug} required />
            </label>
            <label>
              게임명
              <input name="title" defaultValue={game.title} required />
            </label>
          </details>
          <button className="button" disabled={busy}>
            {busy ? "처리 중…" : "파일 검사"}
          </button>
        </fieldset>
      </form>
      <div className="admin-help">
        <p>
          기존 공개 상태·URL·이미지·순서는 유지하며, 누락 행은 삭제하지
          않습니다. 이름·줄거리·공개일 변경은 아래 목록에 표시됩니다. 새 게임은
          비공개, 새 스토리는 한국 공개일 기준으로 준비합니다. 신규 이미지
          업로드는 별도입니다.
        </p>
      </div>
      {preview && (
        <>
          <h3>{preview.filename}</h3>
          <p>
            변경 {preview.plans.length}건 · 동일 {preview.unchanged}건 · 오류{" "}
            {preview.errors.length}건
          </p>
          {preview.errors.length > 0 && (
            <div role="alert" className="form-error">
              <h3>적용할 수 없습니다</h3>
              <ul>
                {preview.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {preview.warnings.length > 0 && (
            <details>
              <summary>확인 사항 {preview.warnings.length}개</summary>
              <ul>
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="admin-import-list">
            {preview.plans.slice(page * 30, page * 30 + 30).map((p, i) => (
              <details key={`${page}-${i}`}>
                <summary>
                  {p.operation.expected ? "수정" : "신규"} ·{" "}
                  {definitions[p.operation.table].label} · {p.label}
                </summary>
                <table>
                  <thead>
                    <tr>
                      <th>항목</th>
                      <th>현재</th>
                      <th>적용 후</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.changes.map((c) => (
                      <tr key={c.field}>
                        <td>
                          {definitions[p.operation.table].fields.find(
                            (f) => f.key === c.field,
                          )?.label ?? c.field}
                        </td>
                        <td>{String(c.before ?? "—")}</td>
                        <td>{String(c.after ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </div>
          {preview.plans.length > 30 && (
            <div className="pagination">
              <button
                disabled={page === 0 || busy}
                onClick={() => setPage((p) => p - 1)}
              >
                이전
              </button>
              <span>
                {page + 1} / {Math.ceil(preview.plans.length / 30)}
              </span>
              <button
                disabled={(page + 1) * 30 >= preview.plans.length || busy}
                onClick={() => setPage((p) => p + 1)}
              >
                다음
              </button>
            </div>
          )}
          {!preview.errors.length && preview.plans.length > 0 && (
            <div className="admin-apply">
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                변경 목록을 확인했으며 표시된 내용을 적용합니다.
              </label>
              <button
                className="button"
                disabled={!confirmed || busy}
                onClick={async () => {
                  setBusy(true);
                  setMessage("");
                  try {
                    const result = await applyAdminBatch(
                      preview.plans.map((p) => p.operation),
                    );
                    if (result.ok) {
                      setMessage(
                        `${result.count}건을 적용했습니다. 다시 파일을 검사하면 최신 상태와 비교할 수 있습니다.`,
                      );
                      setPreview(null);
                      setConfirmed(false);
                    } else setMessage(result.error ?? "적용하지 못했습니다.");
                  } catch {
                    setMessage(
                      "연결이 끊겼습니다. 다시 파일을 검사해 적용 상태를 확인해 주세요.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                검토한 {preview.plans.length}건 적용
              </button>
            </div>
          )}
        </>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
