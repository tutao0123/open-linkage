import Link from "next/link";

const milestones = [
  ["01", "四杆实验室", "拖动铰点、播放运动并观察连杆点轨迹。"],
  ["02", "目标轨迹拟合", "绘制目标曲线，自动搜索并比较候选机构。"],
  ["03", "六杆腿自动综合", "手绘马蹄轨迹，生成并排名多套兼顾精度与传动性能的六杆腿。"],
];

export default function Home() {
  return (
    <main>
      <nav>
        <a className="brand" href="#top" aria-label="OpenLinkage 首页">
          <span className="brand-mark" />
          OpenLinkage
        </a>
        <span className="version">OPEN SOURCE · V0.1</span>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">MECHANISM DESIGN, IN THE BROWSER</p>
          <h1>从运动轨迹，<br />到可制造的机构。</h1>
          <p className="intro">
            一个开源、浏览器端的平面机构设计与自动综合平台。搭建机构、验证运动，
            并逐步探索机器人腿与绳驱动手指。
          </p>
          <div className="actions">
            <Link className="primary" href="/lab">打开四杆实验室</Link>
            <Link className="secondary" href="/leg">生成六杆机械腿</Link>
            <a className="secondary" href="https://github.com/tutao0123/open-linkage" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>

        <div className="mechanism-card" aria-label="四杆机构概念示意">
          <div className="card-head"><span>FOUR-BAR / PREVIEW</span><span>θ 38.4°</span></div>
          <svg viewBox="0 0 620 420" role="img" aria-label="运动中的四杆机构">
            <path className="trajectory" d="M120 259 C196 135 364 99 505 178 C559 209 555 269 485 302 C348 366 181 341 120 259Z" />
            <line className="ground" x1="95" y1="310" x2="520" y2="310" />
            <line className="link link-a" x1="126" y1="310" x2="230" y2="190" />
            <line className="link link-b" x1="230" y1="190" x2="438" y2="150" />
            <line className="link link-c" x1="438" y1="150" x2="492" y2="310" />
            <line className="coupler" x1="230" y1="190" x2="365" y2="263" />
            {[[126,310],[230,190],[438,150],[492,310],[365,263]].map(([x,y], index) => (
              <g key={index}><circle className="joint-ring" cx={x} cy={y} r="13" /><circle className="joint" cx={x} cy={y} r="5" /></g>
            ))}
          </svg>
          <div className="card-stats"><span>GRASHOF <b>满足</b></span><span>DOF <b>1</b></span><span>MODE <b>OPEN</b></span></div>
        </div>
      </section>

      <section className="roadmap" id="roadmap">
        <div className="section-title"><p>BUILD IN PUBLIC</p><h2>先跑通一条完整链路</h2></div>
        <div className="milestones">
          {milestones.map(([number, title, text]) => (
            <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>

      <footer><span>Apache-2.0</span><span>GitHub + Vercel</span></footer>
    </main>
  );
}
