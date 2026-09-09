import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "管理后台 | CNC 即时报价",
  description: "费率配置与询价管理",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="font-semibold text-slate-900">
              CNC 管理后台
            </Link>
            <nav className="flex gap-3 text-sm text-slate-600">
              <Link href="/admin" className="hover:text-brand-600">
                费率配置
              </Link>
              <Link href="/admin/inquiries" className="hover:text-brand-600">
                询价列表
              </Link>
              <Link href="/" className="hover:text-brand-600">
                返回前台
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
