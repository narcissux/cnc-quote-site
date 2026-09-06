import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CNC 即时报价 | Instant CNC Quote",
  description:
    "上传 STL，即刻估算 CNC 加工价格（工时 / 按件）。人民币报价，中文界面。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen">
          <nav className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm text-white">
                  CNC
                </span>
                即时报价
              </div>
              <span className="text-xs text-slate-500">MVP · 近似估算</span>
            </div>
          </nav>
          {children}
          <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
            报价引擎为启发式估算，非正式合同价 · Phases 1+2
          </footer>
        </div>
      </body>
    </html>
  );
}
