import Link from "next/link";

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
    eyebrow: "FREE MECHANISM",
    title: "自由机构设计器",
    text: "像搭积木一样添加铰点与杆件，指定主动杆，实时观察任意平面机构的运动和轨迹。",
    href: "/designer",
    action: "开始自由搭建",
    status: "N 杆 · 自由拓扑",
  },
] as const;

export default function Home() {
  return (
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

        <div className="mechanism-card" aria-label="平面连杆机构概念示意">
          <div className="card-head"><span>LINKAGE / LIVE PREVIEW</span><span>θ 38.4°</span></div>
          <svg viewBox="0 0 620 420" role="img" aria-label="运动中的四杆机构">
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
          <div className="card-stats"><span>PLANE <b>XY</b></span><span>DOF <b>1</b></span><span>SOLVER <b>READY</b></span></div>
        </div>
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
  );
}
