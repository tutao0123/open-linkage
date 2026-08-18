import Image from "next/image";
import Link from "next/link";

import type { Language } from "@/lib/i18n";

import { OdysseyHorseMotion } from "./odyssey-horse-motion";
import { VariableGeometryLegLab } from "./variable-geometry-leg-lab";
import styles from "./odyssey-variable-leg-experience.module.css";

const COPY = {
  en: {
    navLab: "Original lab",
    navWorkbench: "Workbench",
    eyebrow: "ODYSSEY / MECHANISM STUDY 01",
    title: <>A Trojan horse<br />built to walk.</>,
    lead: "A wooden myth on the outside. A real Jansen linkage underneath. The rods on this horse are driven by the same kinematic model used in OpenLinkage—not a pre-rendered animation.",
    source: "Design interpretation · not an archaeological reconstruction",
    enter: "Enter the live mechanism",
    markerOne: "LIVE KINEMATICS",
    markerTwo: "4-LEG WAVE GAIT",
    markerThree: "JANSEN LINKAGE",
    workbenchEyebrow: "THE HORSE OPENS HERE",
    workbenchTitle: "Tune the machine inside the myth.",
    workbenchLead: "Change the gait, step length, lift height, speed, and deployment. The special cover and the engineering workbench share the same mechanism model.",
  },
  zh: {
    navLab: "原版实验室",
    navWorkbench: "进入工作台",
    eyebrow: "奥德赛 / 机构研究 01",
    title: <>一匹真正能走的<br />特洛伊木马。</>,
    lead: "外面是木马神话，里面是可计算的 Jansen 连杆。画面中的杆件直接读取 OpenLinkage 的运动学模型，不是预渲染动画。",
    source: "当代设计演绎 · 非考古复原",
    enter: "进入实时机构",
    markerOne: "实时运动学",
    markerTwo: "四足波步",
    markerThree: "JANSEN 连杆",
    workbenchEyebrow: "从这里打开木马",
    workbenchTitle: "调试神话里面的机器。",
    workbenchLead: "调整步态、步幅、抬脚高度、速度和整机部署。特别版封面与下面的工程工作台使用的是同一个机构模型。",
  },
} as const;

export function OdysseyVariableLegExperience({ language }: { language: Language }) {
  const copy = COPY[language];
  return <div className={styles.experience}>
    <section className={styles.hero} aria-labelledby="odyssey-title">
      <header className={styles.heroNav}>
        <Link className={styles.wordmark} href={`/${language}`}>OpenLinkage</Link>
        <nav aria-label="Special version navigation">
          <Link href={`/${language}/variable-leg`}>{copy.navLab}</Link>
          <Link href="#workbench">{copy.navWorkbench}</Link>
        </nav>
      </header>

      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 id="odyssey-title">{copy.title}</h1>
        <p className={styles.lead}>{copy.lead}</p>
        <p className={styles.sourceNote}>{copy.source}</p>
        <Link className={styles.primaryAction} href="#workbench">{copy.enter}</Link>
      </div>

      <div className={styles.heroVisual}>
        <div className={styles.imageFrame}>
          <Image
            src="/odyssey-horse-shell-no-cart-clean.png"
            alt="A suspended dark wooden Trojan horse shell on an ancient engineering drawing"
            fill
            priority
            sizes="(max-width: 860px) 100vw, 52vw"
          />
          <OdysseyHorseMotion />
        </div>
        <div className={styles.visualLegend} aria-label="Mechanism details">
          <span>{copy.markerOne}</span>
          <span>{copy.markerTwo}</span>
          <span>{copy.markerThree}</span>
        </div>
      </div>
    </section>

    <section className={styles.workbenchIntro} id="workbench">
      <p>{copy.workbenchEyebrow}</p>
      <div>
        <h2>{copy.workbenchTitle}</h2>
        <span>{copy.workbenchLead}</span>
      </div>
    </section>
    <VariableGeometryLegLab variant="odyssey" />
  </div>;
}
