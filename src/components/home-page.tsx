"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const workbenches = [
  {
    number: "01",
    href: "/lab",
    zh: {
      eyebrow: "FOUR-BAR DESIGN",
      title: "四杆机构设计",
      text: "分析曲柄摇杆、双曲柄和双摇杆机构，绘制目标轨迹并自动拟合四杆尺寸。",
      action: "进入四杆设计",
      status: "分析 · 轨迹拟合",
    },
    en: {
      eyebrow: "FOUR-BAR DESIGN",
      title: "Four-bar mechanism design",
      text: "Analyze crank-rocker, double-crank, and double-rocker mechanisms, draw target paths, and synthesize four-bar dimensions.",
      action: "Open four-bar design",
      status: "Analysis · Path synthesis",
    },
  },
  {
    number: "02",
    href: "/leg",
    zh: {
      eyebrow: "SIX-BAR SYNTHESIS",
      title: "六杆腿机构综合",
      text: "面向步行与奔跑机构，绘制足端轨迹并生成多套兼顾精度和传动性能的六杆方案。",
      action: "进入六杆腿设计",
      status: "机械腿 · 多方案综合",
    },
    en: {
      eyebrow: "SIX-BAR SYNTHESIS",
      title: "Six-bar leg synthesis",
      text: "Draw foot-end paths for walking and running mechanisms, then generate multiple six-bar candidates balancing accuracy and transmission performance.",
      action: "Open six-bar design",
      status: "Mechanical legs · Multi-solution synthesis",
    },
  },
  {
    number: "03",
    href: "/variable-leg",
    zh: {
      eyebrow: "VARIABLE GEOMETRY LEG",
      title: "可变几何步行腿",
      text: "以克兰腿和简森腿为原型，通过移动固定铰点或可锁止伸缩杆，让同一机构适配巡航、高速与越障轨迹。",
      action: "进入可变步行腿工作台",
      status: "多工况 · 轨迹族综合",
    },
    en: {
      eyebrow: "VARIABLE GEOMETRY LEG",
      title: "Variable-geometry walking leg",
      text: "Starting from Klann and Jansen legs, move fixed pivots or lockable telescoping links to adapt one mechanism to cruising, sprinting, and obstacle modes.",
      action: "Open variable-leg workbench",
      status: "Multi-condition · Path-family synthesis",
    },
  },
  {
    number: "04",
    href: "/straight-line",
    zh: {
      eyebrow: "STRAIGHT-LINE MECHANISMS",
      title: "经典直线机构",
      text: "比较瓦特、彻比雪夫、霍肯和波塞利耶机构，自动识别最佳直线段并评价行程与误差。",
      action: "进入直线机构工作台",
      status: "经典机构 · 直线性能",
    },
    en: {
      eyebrow: "STRAIGHT-LINE MECHANISMS",
      title: "Classic straight-line mechanisms",
      text: "Compare Watt, Chebyshev, Hoeken, and Peaucellier mechanisms, automatically identify the best straight segments, and evaluate travel and error.",
      action: "Open straight-line workbench",
      status: "Classic mechanisms · Straight-line performance",
    },
  },
  {
    number: "05",
    href: "/designer",
    zh: {
      eyebrow: "FREE MECHANISM",
      title: "自由机构设计器",
      text: "像搭积木一样添加铰点与杆件，指定主动杆，实时观察任意平面机构的运动和轨迹。",
      action: "开始自由搭建",
      status: "N 杆 · 自由拓扑",
    },
    en: {
      eyebrow: "FREE MECHANISM",
      title: "Free mechanism designer",
      text: "Add joints and links like building blocks, define an input link, and observe motion and paths for arbitrary planar mechanisms in real time.",
      action: "Start building",
      status: "N-bar · Free topology",
    },
  },
] as const;

const translations = {
  zh: {
    languageAria: "切换到英文",
    switchLabel: "EN",
    homeAria: "OpenLinkage 首页",
    version: "OPEN SOURCE · BROWSER CAD",
    heroEyebrow: "PLANAR MECHANISM DESIGN, IN THE BROWSER",
    heroTitle: ["从运动目标，", "到机构方案。"],
    intro: "一个开源、浏览器端的平面机构设计与自动综合平台。选择标准机构快速分析，或从铰点和杆件开始自由搭建自己的机构。",
    explore: "选择设计模块",
    github: "查看 GitHub",
    mechanismAria: "平面连杆机构概念示意",
    mechanismSvgAria: "运动中的四杆机构",
    preview: "LINKAGE / LIVE PREVIEW",
    plane: "平面",
    dof: "自由度",
    solver: "求解器",
    ready: "就绪",
    workbenchesEyebrow: "DESIGN WORKBENCHES",
    workbenchesTitle: "选择你的设计方式",
    workbenchesNote: "标准机构快速求解，自由机构灵活探索。",
    license: "MIT License",
    stack: "GitHub + Vercel",
  },
  en: {
    languageAria: "Switch to Chinese",
    switchLabel: "中文",
    homeAria: "OpenLinkage home",
    version: "OPEN SOURCE · BROWSER CAD",
    heroEyebrow: "PLANAR MECHANISM DESIGN, IN THE BROWSER",
    heroTitle: ["From motion goals,", "to mechanism designs."],
    intro: "An open-source, browser-based platform for planar mechanism design and automatic synthesis. Analyze standard mechanisms quickly, or build your own from joints and links.",
    explore: "Explore workbenches",
    github: "View on GitHub",
    mechanismAria: "Planar linkage concept preview",
    mechanismSvgAria: "A four-bar mechanism in motion",
    preview: "LINKAGE / LIVE PREVIEW",
    plane: "PLANE",
    dof: "DOF",
    solver: "SOLVER",
    ready: "READY",
    workbenchesEyebrow: "DESIGN WORKBENCHES",
    workbenchesTitle: "Choose how you design",
    workbenchesNote: "Solve standard mechanisms quickly, or explore freely.",
    license: "MIT License",
    stack: "GitHub + Vercel",
  },
} as const;

type Locale = keyof typeof translations;

export default function HomePage() {
  const [locale, setLocale] = useState<Locale>("zh");
  const t = translations[locale];

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  return (
    <main className="home-shell">
      <nav className="home-nav">
        <a className="brand" href="#top" aria-label={t.homeAria}>
          <span className="brand-mark" />
          OpenLinkage
        </a>
        <div className="home-nav-actions">
          <span className="version">{t.version}</span>
          <button
            className="language-switch"
            type="button"
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            aria-label={t.languageAria}
          >
            {t.switchLabel}
          </button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">{t.heroEyebrow}</p>
          <h1>{t.heroTitle[0]}<br />{t.heroTitle[1]}</h1>
          <p className="intro">{t.intro}</p>
          <div className="actions">
            <a className="primary" href="#workbenches">{t.explore}</a>
            <a className="secondary" href="https://github.com/tutao0123/open-linkage" target="_blank" rel="noreferrer">{t.github}</a>
          </div>
        </div>

        <div className="mechanism-card" aria-label={t.mechanismAria}>
          <div className="card-head"><span>{t.preview}</span><span>θ 38.4°</span></div>
          <svg viewBox="0 0 620 420" role="img" aria-label={t.mechanismSvgAria}>
            <path className="trajectory" d="M120 259 C196 135 364 99 505 178 C559 209 555 269 485 302 C348 366 181 341 120 259Z" />
            <line className="ground" x1="95" y1="310" x2="520" y2="310" />
            <line className="link link-a" x1="126" y1="310" x2="230" y2="190" />
            <line className="link link-b" x1="230" y1="190" x2="438" y2="150" />
            <line className="link link-c" x1="438" y1="150" x2="492" y2="310" />
            <line className="coupler" x1="230" y1="190" x2="365" y2="263" />
            {[[126, 310], [230, 190], [438, 150], [492, 310], [365, 263]].map(([x, y]) => (
              <g key={`${x}-${y}`}><circle className="joint-ring" cx={x} cy={y} r="13" /><circle className="joint" cx={x} cy={y} r="5" /></g>
            ))}
          </svg>
          <div className="card-stats"><span>{t.plane} <b>XY</b></span><span>{t.dof} <b>1</b></span><span>{t.solver} <b>{t.ready}</b></span></div>
        </div>
      </section>

      <section className="workbenches" id="workbenches">
        <div className="section-title">
          <div><p>{t.workbenchesEyebrow}</p><h2>{t.workbenchesTitle}</h2></div>
          <p className="section-note">{t.workbenchesNote}</p>
        </div>
        <div className="workbench-grid">
          {workbenches.map((workbench) => {
            const copy = workbench[locale];
            return (
              <article className="workbench-card" key={workbench.number}>
                <div className="workbench-meta"><span>{workbench.number}</span><span>{copy.eyebrow}</span></div>
                <h3>{copy.title}</h3>
                <p>{copy.text}</p>
                <span className="workbench-status">{copy.status}</span>
                <Link href={workbench.href}>{copy.action}<span aria-hidden="true">↗</span></Link>
              </article>
            );
          })}
        </div>
      </section>

      <footer><span>{t.license}</span><span>{t.stack}</span></footer>
    </main>
  );
}
