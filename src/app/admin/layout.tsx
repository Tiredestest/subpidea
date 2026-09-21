import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { userDb } from "@/lib/supabase/server";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = await userDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  if (user.app_metadata?.role !== "admin") notFound();
  return (
    <div className="page-shell admin-shell">
      <div className="page-heading">
        <span className="eyebrow blue">운영 도구</span>
        <h1>콘텐츠 관리</h1>
        <p>변경한 내용은 새로 열린 화면에 바로 반영됩니다.</p>
      </div>
      <nav className="admin-nav" aria-label="관리 메뉴">
        <Link href="/admin">현황</Link>
        <Link href="/admin/content">콘텐츠 편집</Link>
        <Link href="/admin/import">Excel 가져오기</Link>
        <Link href="/admin/settings">사이트 설정</Link>
        <Link href="/admin/history">변경 기록</Link>
      </nav>
      {children}
    </div>
  );
}
