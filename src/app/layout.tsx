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
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
