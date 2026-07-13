import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenLinkage",
  description: "开源、浏览器端的平面机构设计与自动综合平台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
