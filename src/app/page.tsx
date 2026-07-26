import Link from "next/link";

export default function LanguageSelectionPage() {
  return (
    <main className="language-gate">
      <div className="language-gate-brand"><span className="brand-mark" />OpenLinkage</div>
      <section>
        <span>LANGUAGE / 语言</span>
        <h1>选择语言<br /><i>Choose your language</i></h1>
        <p>进入机构设计与自动综合工作台<br />Enter the mechanism design and synthesis workbenches</p>
        <div>
          <Link href="/zh"><b>中文</b><small>进入中文版</small><em>→</em></Link>
          <Link href="/en"><b>English</b><small>Open the English version</small><em>→</em></Link>
        </div>
      </section>
      <footer><span>Apache-2.0</span><span>OPEN SOURCE · BROWSER CAD</span></footer>
    </main>
  );
}
