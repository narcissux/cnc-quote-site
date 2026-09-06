import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900">页面未找到</h1>
      <p className="mt-2 text-slate-600">请返回首页继续使用 CNC 即时报价。</p>
      <Link href="/" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline">
        返回首页
      </Link>
    </div>
  );
}
