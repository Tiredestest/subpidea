"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { definitions, rowKey, type Row, type Table } from "@/lib/admin/model";
import { saveContent } from "@/app/admin/actions";
export function ContentManager({ data }: { data: Record<Table, Row[]> }) {
  const [table, setTable] = useState<Table>("chapters"),
    [query, setQuery] = useState(""),
    [game, setGame] = useState(""),
    [selected, setSelected] = useState("");
  const rows = data[table].filter(
    (r) =>
      (!game || r.game_id === game || r.id === game) &&
      JSON.stringify([
        r.title,
        r.name,
        r.source_id,
        r.chapter_id,
        r.character_id,
      ])
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const identity = (r: Row) => JSON.stringify(rowKey(table, r));
  const row = rows.find((r) => identity(r) === selected);
  const label = (r: Row) =>
    table === "appearances"
      ? `${data.chapters.find((c) => c.id === r.chapter_id)?.title} / ${data.characters.find((c) => c.id === r.character_id)?.name}`
      : String(r.title ?? r.name ?? r.source_id);
  return (
    <section className="admin-section">
      <h2>콘텐츠 편집</h2>
      <div className="admin-filters">
        <label>
          종류
          <select
            value={table}
            onChange={(e) => {
              setTable(e.target.value as Table);
              setSelected("");
            }}
          >
            {Object.entries(definitions)
              .filter(([k]) => k !== "site_settings")
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          게임
          <select
            value={game}
            onChange={(e) => {
              setGame(e.target.value);
              setSelected("");
            }}
          >
            <option value="">전체 게임</option>
            {data.games.map((g) => (
              <option key={String(g.id)} value={String(g.id)}>
                {String(g.title)}
              </option>
            ))}
          </select>
        </label>
        <label>
          찾기
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름 또는 ID"
          />
        </label>
      </div>
      <div className="admin-workspace">
        <div className="admin-records" aria-label="콘텐츠 목록">
          <p className="muted">{rows.length}개 항목</p>
          {rows.map((r) => (
            <button
              key={identity(r)}
              onClick={() => setSelected(identity(r))}
              className={selected === identity(r) ? "active" : ""}
            >
              <strong>{label(r)}</strong>
              <small>
                {String(r.source_id ?? "등장 관계")} ·{" "}
                {"is_published" in r
                  ? r.is_published
                    ? "공개"
                    : "비공개"
                  : `순서 ${r.sort_order}`}
              </small>
            </button>
          ))}
        </div>
        {row ? (
          <Editor
            key={`${table}:${identity(row)}:${row.updated_at}`}
            table={table}
            row={row}
            title={label(row)}
          />
        ) : (
          <div className="admin-editor muted">
            목록에서 편집할 항목을 선택해 주세요.
          </div>
        )}
      </div>
    </section>
  );
}
function Editor({
  table,
  row,
  title,
}: {
  table: Table;
  row: Row;
  title: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Row>({ ...row }),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="admin-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          const changed = Object.fromEntries(
            definitions[table].fields
              .filter((f) => draft[f.key] !== row[f.key])
              .map((f) => [f.key, draft[f.key]]),
          );
          if (!Object.keys(changed).length) {
            setMessage("변경한 내용이 없습니다.");
            return;
          }
          const result = await saveContent(table, row, changed);
          setMessage(
            result.ok
              ? "저장했습니다."
              : (result.error ?? "저장하지 못했습니다."),
          );
          if (result.ok) router.refresh();
        } catch {
          setMessage("연결을 확인하고 다시 시도해 주세요.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{title}</h3>
      <p className="muted">
        기존 주소와 식별자는 유지됩니다. 공개 상태 변경은 하위 콘텐츠에도 영향을
        줍니다.
      </p>
      {definitions[table].fields.map((f) => (
        <label
          key={f.key}
          className={f.type === "boolean" ? "admin-check" : ""}
        >
          {f.type === "boolean" ? (
            <>
              <input
                type="checkbox"
                checked={draft[f.key] === true}
                disabled={busy}
                onChange={(e) =>
                  setDraft({ ...draft, [f.key]: e.target.checked })
                }
              />
              {f.label}
            </>
          ) : (
            <>
              {f.label}
              {f.type === "long" ? (
                <textarea
                  value={String(draft[f.key] ?? "")}
                  maxLength={10000}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft({ ...draft, [f.key]: e.target.value })
                  }
                />
              ) : (
                <input
                  type={
                    f.type === "number"
                      ? "number"
                      : f.type === "date"
                        ? "date"
                        : "text"
                  }
                  value={String(draft[f.key] ?? "")}
                  min={0}
                  max={100000}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [f.key]:
                        f.type === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    })
                  }
                />
              )}
            </>
          )}
        </label>
      ))}
      <button className="button" disabled={busy}>
        {busy ? "저장 중…" : "변경 저장"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
