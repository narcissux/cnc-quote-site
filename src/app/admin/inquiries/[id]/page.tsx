"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminLogin } from "@/components/admin/AdminLogin";

interface InquiryDetail {
  id: string;
  createdAt: string;
  status: "pending" | "quoted" | "closed";
  materialId: string;
  quantity: number;
  tolerance: string;
  finish: string;
  machine: string;
  mode: string;
  leadTier: string;
  geometry: Record<string, number>;
  autoQuote: {
    totalPriceCny: number;
    unitPriceCny: number;
    leadTimeDays: number;
    lines: Array<{ id: string; label: string; amountCny: number; formula: string }>;
  };
  manualPriceCny: number | null;
  contact: Record<string, string | undefined>;
  attachments: Array<{ field: string; filename: string; size: number }>;
  fileName?: string;
}

export default function AdminInquiryDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [auth, setAuth] = useState<{ configured: boolean; authenticated: boolean } | null>(null);
  const [rec, setRec] = useState<InquiryDetail | null>(null);
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState<InquiryDetail["status"]>("pending");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const me = await fetch("/api/admin/me").then((r) => r.json());
    setAuth(me);
    if (!me.authenticated) return;
    const res = await fetch(`/api/admin/inquiries/${id}`);
    if (!res.ok) {
      setMsg("加载失败");
      return;
    }
    const data = (await res.json()) as InquiryDetail;
    setRec(data);
    setStatus(data.status);
    setManual(data.manualPriceCny != null ? String(data.manualPriceCny) : "");
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    setMsg(null);
    const body: { status: string; manualPriceCny: number | null } = {
      status,
      manualPriceCny: manual.trim() === "" ? null : Number(manual),
    };
    const res = await fetch(`/api/admin/inquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "保存失败");
      return;
    }
    setRec(data);
    setMsg("已保存");
  }

  if (!auth) return <p className="text-sm text-slate-500">加载中…</p>;
  if (!auth.authenticated) return <AdminLogin onSuccess={() => void refresh()} />;
  if (!rec) return <p className="text-sm text-slate-500">加载询价…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/inquiries" className="text-sm text-brand-600 hover:underline">
          ← 返回列表
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">询价详情</h1>
        <p className="font-mono text-xs text-slate-500">{rec.id}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm space-y-2">
          <h2 className="text-lg font-semibold">基本信息</h2>
          <p>文件：{rec.fileName || "—"}</p>
          <p>
            材料 {rec.materialId} · 数量 {rec.quantity} · {rec.tolerance} · {rec.finish} ·{" "}
            {rec.machine} · {rec.mode} · 交期档 {rec.leadTier}
          </p>
          <p>
            几何：{rec.geometry.lengthMm?.toFixed?.(2)} × {rec.geometry.widthMm?.toFixed?.(2)} ×{" "}
            {rec.geometry.heightMm?.toFixed?.(2)} mm · 体积{" "}
            {rec.geometry.volumeMm3?.toFixed?.(1)} mm³
          </p>
          <div className="pt-2">
            <h3 className="font-medium">联系方式</h3>
            <p>姓名 {rec.contact.name || "—"} · 电话 {rec.contact.phone || "—"}</p>
            <p>邮箱 {rec.contact.email || "—"} · 公司 {rec.contact.company || "—"}</p>
            <p>备注 {rec.contact.note || "—"}</p>
          </div>
          <div className="pt-2">
            <h3 className="font-medium">附件</h3>
            <ul className="mt-1 space-y-1">
              {rec.attachments.length === 0 && <li className="text-slate-500">无</li>}
              {rec.attachments.map((a) => (
                <li key={a.filename}>
                  <a
                    className="text-brand-600 hover:underline"
                    href={`/api/admin/inquiries/${rec.id}/attachment?file=${encodeURIComponent(a.filename)}`}
                  >
                    {a.filename}
                  </a>{" "}
                  <span className="text-xs text-slate-500">
                    ({a.field}, {(a.size / 1024).toFixed(1)} KB)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm space-y-3">
          <h2 className="text-lg font-semibold">报价快照</h2>
          <p className="text-xl font-bold">
            自动总价 ¥{rec.autoQuote.totalPriceCny.toFixed(2)} · 交期{" "}
            {rec.autoQuote.leadTimeDays} 天
          </p>
          <ul className="divide-y divide-slate-100">
            {rec.autoQuote.lines.map((l) => (
              <li key={l.id} className="flex justify-between py-1.5">
                <span>
                  {l.label}
                  <span className="ml-2 text-xs text-slate-500">{l.formula}</span>
                </span>
                <span>¥{l.amountCny.toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <h3 className="font-medium">人工改价</h3>
            <label className="block">
              人工总价 ¥
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="留空表示不设人工价"
              />
            </label>
            <label className="block">
              状态
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={status}
                onChange={(e) => setStatus(e.target.value as InquiryDetail["status"])}
              >
                <option value="pending">待审</option>
                <option value="quoted">已报价</option>
                <option value="closed">已关闭</option>
              </select>
            </label>
            {msg && <p className="text-sm text-slate-600">{msg}</p>}
            <button
              type="button"
              onClick={() => void save()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
            >
              保存
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
