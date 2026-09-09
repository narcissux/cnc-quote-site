"use client";

import dynamic from "next/dynamic";
import { FrontShell } from "@/components/FrontShell";

const QuoteApp = dynamic(
  () => import("@/components/QuoteApp").then((m) => m.QuoteApp),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-500">
        加载报价工具…
      </div>
    ),
  }
);

export default function HomePage() {
  return (
    <FrontShell>
      <QuoteApp />
    </FrontShell>
  );
}
