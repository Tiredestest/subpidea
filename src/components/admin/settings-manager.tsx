"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { applyAdminBatch } from "@/app/admin/actions";
import type { Row, Operation } from "@/lib/admin/model";
const names: Record<string, string> = {
  ratings_enabled: "별점 등록 허용",
  comments_enabled: "한줄평·좋아요 등록 허용",
  home_recent_limit: "홈 최근 이야기 수",
  home_popular_game_limit: "홈 게임 수",
};
export function SettingsManager({ rows }: { rows: Row[] }) {
  return (
    <SettingsForm key={rows.map((r) => r.updated_at).join(":")} rows={rows} />
  );
}
function SettingsForm({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(
      Object.fromEntries(rows.map((r) => [String(r.key), r.value])),
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="admin-section admin-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        const operations: Operation[] = rows
          .filter(
            (r) =>
              (r.key as string) in names && r.value !== values[String(r.key)],
          )
          .map((r) => ({
            table: "site_settings",
            key: { key: r.key },
            expected: String(r.updated_at),
            patch: { value: values[String(r.key)] },
          }));
        if (!operations.length) {
          setMessage("변경한 내용이 없습니다.");
          return;
        }
        setBusy(true);
        try {
          const result = await applyAdminBatch(operations);
          setMessage(
            result.ok
              ? "설정을 저장했습니다."
              : (result.error ?? "저장하지 못했습니다."),
          );
          if (result.ok) router.refresh();
        } catch {
          setMessage("연결을 확인해 주세요.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>사이트 설정</h2>
      {rows
        .filter((r) => String(r.key) in names)
        .map((r) => (
          <label key={String(r.key)}>
            {names[String(r.key)]}
            {typeof r.value === "boolean" ? (
              <input
                type="checkbox"
                checked={values[String(r.key)] === true}
                disabled={busy}
                onChange={(e) =>
                  setValues({ ...values, [String(r.key)]: e.target.checked })
                }
              />
            ) : (
              <input
                type="number"
                min={1}
                max={24}
                value={Number(values[String(r.key)])}
                disabled={busy}
                onChange={(e) =>
                  setValues({
                    ...values,
                    [String(r.key)]: Number(e.target.value),
                  })
                }
              />
            )}
          </label>
        ))}
      <p className="muted">
        등록을 중지해도 기존 감상은 유지됩니다. 계정 가입 설정은 별도의 인증
        서비스에서 관리합니다.
      </p>
      <button className="button" disabled={busy}>
        {busy ? "저장 중…" : "설정 저장"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
