import readWorkbook from "read-excel-file/node";
import config from "../../../../../config/import/blue-archive.json";
import { adminSnapshot, requireAdmin } from "@/lib/admin/server";
import { parseWorkbook, planImport } from "@/lib/import/workbook";
import { randomUUID } from "node:crypto";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return Response.json(
      { error: "관리자 로그인이 필요합니다." },
      { status: 403 },
    );
  }
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json(
      { error: "요청 출처가 올바르지 않습니다." },
      { status: 403 },
    );
  try {
    if (Number(request.headers.get("content-length")) > 2_200_000)
      throw Error("파일은 2MB 이하여야 합니다.");
    const form = await request.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith(".xlsx") ||
      file.size > 2_000_000
    )
      throw Error("2MB 이하의 .xlsx 파일을 선택해 주세요.");
    const buffer = Buffer.from(await file.arrayBuffer());
    // Check the ZIP central directory before parsing compressed spreadsheet XML.
    let end = -1;
    for (
      let i = buffer.length - 22;
      i >= Math.max(0, buffer.length - 65557);
      i--
    )
      if (buffer.readUInt32LE(i) === 0x06054b50) {
        end = i;
        break;
      }
    if (end < 0) throw Error("유효한 XLSX 파일이 아닙니다.");
    const entries = buffer.readUInt16LE(end + 10);
    let pos = buffer.readUInt32LE(end + 16),
      bytes = 0;
    if (entries > 500) throw Error("시트 구성 요소가 너무 많습니다.");
    for (let i = 0; i < entries; i++) {
      if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50)
        throw Error("손상된 XLSX 파일입니다.");
      bytes += buffer.readUInt32LE(pos + 24);
      pos +=
        46 +
        buffer.readUInt16LE(pos + 28) +
        buffer.readUInt16LE(pos + 30) +
        buffer.readUInt16LE(pos + 32);
    }
    if (bytes > 20_000_000) throw Error("압축 해제 크기가 20MB를 초과합니다.");
    const game = {
      source_id: String(form.get("source_id") || config.game.source_id).trim(),
      slug: String(form.get("slug") || config.game.slug).trim(),
      title: String(form.get("title") || config.game.title).trim(),
    };
    if (
      !/^[A-Za-z0-9_-]{1,80}$/.test(game.source_id) ||
      !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(game.slug) ||
      game.slug.length > 80 ||
      !game.title ||
      game.title.length > 200
    )
      throw Error("게임 ID·주소·이름을 확인해 주세요.");
    const mapping = {
      ...config,
      game,
      ...(game.source_id === config.game.source_id
        ? {}
        : {
            storyAliases: {},
            quarantineCharacters: {},
            allowEmptyAppearanceRows: [],
          }),
    };
    const sheets = await readWorkbook(buffer);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const parsed = parseWorkbook(sheets, mapping, today);
    const plan = planImport(parsed, await adminSnapshot(), randomUUID);
    return Response.json(
      {
        ...plan,
        warnings: parsed.warnings,
        counts: Object.fromEntries(
          Object.entries(parsed.records).map(([k, v]) => [k, v.length]),
        ),
        filename: file.name,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "파일을 읽지 못했습니다." },
      { status: 400 },
    );
  }
}
