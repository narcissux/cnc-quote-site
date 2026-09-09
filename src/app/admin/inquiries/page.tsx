"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminLogin } from "@/components/admin/AdminLogin";

interface Row {
  id: string;
  createdAt: string;
  status: string;
  materialId: string;
  quantity: number;
  autoTotalCny: number;
  manualPriceCny: number | null;
  fileName?: string;
  contactName?: string;
}

const STATUS_ZH: Record<string, string> = {
  pending: "待审",
  quoted: "已报价",
  closed: "已关闭",
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  } catch {
    return iso;
  }
}

export default function AdminInquiriesPage() {
  const [auth, setAuth] = useState<{ configured: boolean; authenticated: boolean } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const me = await fetch("/api/admin/me").then((r) => r.json());
    setAuth(me);
    if (!me.authenticated) return;
    const res = await fetch("/api/admin/inquiries");
    if (!res.ok) {
      setError("加载失败");
      return;
    }
    const data = (await res.json()) as { inquiries: Row[] };
    setRows(data.inquiries);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!auth) return <p className="text-sm text-slate-500">加载中…</p>;
  if (!auth.configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm">
        请配置 ADMIN_PASSWORD 或 ADMIN_TOKEN
      </div>
    );
  }
  if (!auth.authenticated) {
    return <AdminLogin onSuccess={() => void refresh()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">询价列表</h1>
        <button
          type="button"
          className="text-sm text-brand-600 hover:underline"
          onClick={() => void refresh()}
        >
          刷新
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">时间</th>
              <th className="px-4 py-3">材料</th>
              <th className="px-4 py-3">数量</th>
              <th className="px-4 py-3">自动价</th>
              <th className="px-4 py-3">人工价</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  暂无询价
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-3 whitespace-nowrap">{fmtTime(r.createdAt)}</td>
                <td className="px-4 py-3">{r.materialId}</td>
                <td className="px-4 py-3">{r.quantity}</td>
                <td className="px-4 py-3">¥{r.autoTotalCny.toFixed(2)}</td>
                <td className="px-4 py-3">
                  {r.manualPriceCny != null ? `¥${r.manualPriceCny.toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3">{STATUS_ZH[r.status] || r.status}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/inquiries/${r.id}`}
                    className="text-brand-600 hover:underline"
                  >
                    详情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
