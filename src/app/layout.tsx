import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenLinkage · 机构设计 / Mechanism Design",
  description: "开源、浏览器端的平面机构设计与自动综合平台。An open-source, browser-based platform for planar mechanism design and automated synthesis.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
