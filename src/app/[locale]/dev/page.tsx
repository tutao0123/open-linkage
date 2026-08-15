import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isLanguage } from "@/lib/i18n";

import styles from "./dev-page.module.css";

type Props = { params: Promise<{ locale: string }> };

export const metadata: Metadata = {
  title: "OpenLink Dev Lab",
  robots: { index: false, follow: false },
};

export default async function DevPage({ params }: Props) {
  const { locale } = await params;
  if (!isLanguage(locale)) notFound();
  const zh = locale === "zh";

  return (
    <main className={styles.shell}>
      <nav className={styles.nav}>
        <Link href={`/${locale}`}>OpenLinkage</Link>
        <span className={styles.meta}>PRIVATE PREVIEW / DEV</span>
      </nav>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>EXPERIMENTAL WORKBENCHES</p>
        <h1>{zh ? "开发实验室" : "Development lab"}</h1>
        <p>{zh ? "尚未进入正式产品导航的实验功能。链接可直接访问，但不会出现在主页面或常规工作台入口中。" : "Experimental tools that are not yet part of the public product navigation. They remain directly accessible without appearing on the homepage."}</p>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <span className={styles.badge}>ACTIVE EXPERIMENT</span>
          <h2>Sketch → Mechanism</h2>
          <p>{zh ? "从固定的特洛伊木马轮廓出发，对比四杆、齿轮同步 X–Y 与双槽凸轮方案，并观察绘图点如何形成目标轨迹。" : "Compare four-bar, geared X–Y and dual-groove cam solutions for the fixed Trojan horse outline, then inspect how the drawing point produces the target trajectory."}</p>
          <Link href={`/${locale}/sketch-mechanism`}>
            {zh ? "进入实验模块" : "Open experiment"}<span aria-hidden="true">↗</span>
          </Link>
        </article>
        <aside className={styles.note}>
          <p className={styles.meta}>VISIBILITY</p>
          <p>{zh ? "此页面不在主导航中公开，也设置为不参与搜索引擎索引。后续功能稳定后，再决定是否进入正式工作台。" : "This page is absent from the main navigation and excluded from search indexing. It can move into the public workbenches after the feature matures."}</p>
        </aside>
      </section>
    </main>
  );
}
