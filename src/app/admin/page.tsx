"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminConfigEditor } from "@/components/admin/AdminConfigEditor";
import type { QuoteConfig } from "@/lib/quote/types";

export default function AdminPage() {
  const [auth, setAuth] = useState<{
    configured: boolean;
    authenticated: boolean;
  } | null>(null);
  const [config, setConfig] = useState<QuoteConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const me = await fetch("/api/admin/me").then((r) => r.json());
    setAuth(me);
    if (me.authenticated) {
      const cfg = await fetch("/api/quote-config").then((r) => r.json());
      setConfig(cfg);
    } else {
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!auth) {
    return <p className="text-sm text-slate-500">加载中…</p>;
  }

  if (!auth.configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        请设置环境变量 <code className="font-mono">ADMIN_PASSWORD</code> 或{" "}
        <code className="font-mono">ADMIN_TOKEN</code> 后重启服务。
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <AdminLogin
        onSuccess={() => {
          void refresh();
        }}
      />
    );
  }

  if (!config) {
    return <p className="text-sm text-slate-500">加载配置…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">费率配置</h1>
          <p className="mt-1 text-sm text-slate-500">
            持久化到服务端 <code className="font-mono">data/quote-config.json</code>
            ，前台刷新后生效。
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            void refresh();
          }}
        >
          退出登录
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <AdminConfigEditor
        initial={config}
        onSaved={(cfg) => setConfig(cfg)}
        onError={setError}
      />
    </div>
  );
}
