"use client";

import Link from "next/link";

export function FrontShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm text-white">
              CNC
            </span>
            即时报价
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>MVP · 近似估算</span>
            <Link href="/admin" className="hover:text-brand-600">
              管理
            </Link>
          </div>
        </div>
      </nav>
      {children}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        报价引擎为启发式估算，非正式合同价 · 费率可后台配置 · 交期三档
      </footer>
    </>
  );
}
