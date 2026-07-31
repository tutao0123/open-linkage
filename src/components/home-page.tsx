import Link from "next/link";

import { MechanismPreview } from "@/components/mechanism-preview";
import { localizeReactTree, type Language } from "@/lib/i18n";

const workbenches = [
  {
    number: "01",
    eyebrow: "FOUR-BAR DESIGN",
    title: "四杆机构设计",
    text: "分析曲柄摇杆、双曲柄和双摇杆机构，绘制目标轨迹并自动拟合四杆尺寸。",
    href: "/lab",
    action: "进入四杆设计",
    status: "分析 · 轨迹拟合",
  },
  {
    number: "02",
    eyebrow: "SIX-BAR SYNTHESIS",
    title: "六杆腿机构综合",
    text: "面向步行与奔跑机构，绘制足端轨迹并生成多套兼顾精度和传动性能的六杆方案。",
    href: "/leg",
    action: "进入六杆腿设计",
    status: "机械腿 · 多方案综合",
  },
  {
    number: "03",
    eyebrow: "VARIABLE GEOMETRY LEG",
    title: "可变几何步行腿",
    text: "以克兰腿和简森腿为原型，通过移动固定铰点或可锁止伸缩杆，让同一机构适配巡航、高速与越障轨迹。",
    href: "/variable-leg",
    action: "进入可变步行腿工作台",
    status: "多工况 · 轨迹族综合",
  },
  {
    number: "04",
    eyebrow: "STRAIGHT-LINE MECHANISMS",
    title: "经典直线机构",
    text: "比较瓦特、彻比雪夫、霍肯和波塞利耶机构，自动识别最佳直线段并评价行程与误差。",
    href: "/straight-line",
    action: "进入直线机构工作台",
    status: "经典机构 · 直线性能",
  },
  {
    number: "05",
    eyebrow: "FREE MECHANISM",
    title: "自由机构设计器",
    text: "像搭积木一样添加铰点与杆件，指定主动杆，实时观察任意平面机构的运动和轨迹。",
    href: "/designer",
    action: "开始自由搭建",
    status: "N 杆 · 自由拓扑",
  },
] as const;

export function HomePage({ language }: { language: Language }) {
  return localizeReactTree((
    <main className="home-shell">
      <nav className="home-nav">
        <a className="brand" href="#top" aria-label="OpenLinkage 首页">
          <span className="brand-mark" />
          OpenLinkage
        </a>
        <span className="version">OPEN SOURCE · BROWSER CAD</span>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">PLANAR MECHANISM DESIGN, IN THE BROWSER</p>
          <h1>从运动目标，<br />到机构方案。</h1>
          <p className="intro">
            一个开源、浏览器端的平面机构设计与自动综合平台。选择标准机构快速分析，
            或从铰点和杆件开始自由搭建自己的机构。
          </p>
          <div className="actions">
            <a className="primary" href="#workbenches">选择设计模块</a>
            <a className="secondary" href="https://github.com/tutao0123/open-linkage" target="_blank" rel="noreferrer">查看 GitHub</a>
          </div>
        </div>

        <MechanismPreview language={language} />
      </section>

      <section className="workbenches" id="workbenches">
        <div className="section-title">
          <div><p>DESIGN WORKBENCHES</p><h2>选择你的设计方式</h2></div>
          <p className="section-note">标准机构快速求解，自由机构灵活探索。</p>
        </div>
        <div className="workbench-grid">
          {workbenches.map((workbench) => (
            <article className="workbench-card" key={workbench.number}>
              <div className="workbench-meta"><span>{workbench.number}</span><span>{workbench.eyebrow}</span></div>
              <h3>{workbench.title}</h3>
              <p>{workbench.text}</p>
              <span className="workbench-status">{workbench.status}</span>
              <Link href={workbench.href}>{workbench.action}<span aria-hidden="true">↗</span></Link>
            </article>
          ))}
        </div>
      </section>

      <footer><span>Apache-2.0</span><span>GitHub + Vercel</span></footer>
    </main>
  ), language);
}
