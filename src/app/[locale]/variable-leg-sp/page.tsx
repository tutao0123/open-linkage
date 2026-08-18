import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TROJAN_HORSE_TARGET_CURVE } from "@/lib/sketch-linkage";
import { isLanguage } from "@/lib/i18n";

import styles from "./sp-page.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const zh = !isLanguage(locale) || locale === "zh";
  return zh
    ? {
      title: "特洛伊木马 · 奥德赛特别版 · OpenLinkage",
      description:
        "《伊利亚特》没写完的那匹马，让它用连杆机构重新走起来。选腿数、看整机步态，或看四杆机构一笔一笔描出木马轮廓。",
    }
    : {
      title: "Trojan Horse · Odyssey Edition · OpenLinkage",
      description:
        "The horse the Iliad never described, rebuilt with linkage mechanisms. Pick a leg count and watch it walk, or watch a four-bar trace the horse outline point by point.",
    };
}

export default async function VariableLegSpecialPage({ params }: Props) {
  const { locale } = await params;
  if (!isLanguage(locale)) notFound();
  const zh = locale === "zh";

  const d = TROJAN_HORSE_TARGET_CURVE
    .map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`)
    .join(" ") + " Z";

  return (
    <main className={styles.shell}>
      <div className={styles.gridbg} aria-hidden="true" />
      <div className={styles.frame} aria-hidden="true" />
      <div className={styles.meander} aria-hidden="true" />

      <section className={styles.content}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>OPENLINKAGE · ODYSSEY EDITION</p>
          <h1 className={styles.title}>{zh ? <>让特洛伊木马<br />重新走起来</> : <>Make the Trojan Horse<br />walk again</>}</h1>
          <p className={styles.subtitle}>TROJAN CURVE <b>→</b> SOLVE <b>→</b> ANIMATE</p>
          <p className={styles.lore}>
            {zh
              ? "《伊利亚特》通篇没有写这匹马；它在《奥德赛》第八卷里被歌人唱起，唱得奥德修斯当众落泪。2700 年后，我们让它在浏览器里走。"
              : "The Iliad never describes the horse. It is only sung in Odyssey Book 8, and Odysseus weeps. 2,700 years later, it walks in the browser."}
          </p>
          <div className={styles.actions}>
            <Link className={styles.cta} href={`/${locale}/variable-leg`}>
              {zh ? "让木马走起来" : "Watch it walk"}<span aria-hidden="true"> ↗</span>
            </Link>
            <Link className={`${styles.cta} ${styles.ghost}`} href={`/${locale}/sketch-mechanism`}>
              {zh ? "看四杆描出马轮廓" : "Trace the outline"}<span aria-hidden="true"> ↗</span>
            </Link>
          </div>
        </div>

        <figure className={styles.stage} aria-label={zh ? "连杆绘图点正在描出特洛伊木马轮廓" : "A coupler point tracing the Trojan horse outline"}>
          <svg viewBox="0 0 560 520" className={styles.horseSvg} role="img">
            <path d={d} className={styles.target} />
            <path d={d} className={styles.draw} pathLength={100} />
            <circle r="10" className={styles.tracer}>
              <animateMotion dur="9s" repeatCount="indefinite" path={d} />
            </circle>
          </svg>
          <figcaption className={styles.caption}>CLOSED LOOP · 300 PTS · FOUR-BAR TRACE</figcaption>
        </figure>
      </section>

      <footer className={styles.footer}>
        <span>{zh ? "#重返奥德赛 · 用连杆机构重演荷马" : "#重返奥德赛 · Homer, replayed by linkages"}</span>
        <span>linkage.wtt.autos</span>
      </footer>
    </main>
  );
}
