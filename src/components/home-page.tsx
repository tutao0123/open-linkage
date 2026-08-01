import Link from "next/link";

import { getHomeContent } from "@/components/home-content";
import { HomeMechanismPreview } from "@/components/home-mechanism-preview";
import { createHomeMechanismScene } from "@/components/home-mechanism-scene";
import { HomeMotionController } from "@/components/home-motion-controller";
import { HomeWorkbenchPreview } from "@/components/home-workbench-preview";
import { LanguageSwitcher } from "@/components/locale-shell";
import { homeMono, homeSans } from "@/lib/home-fonts";
import { withLanguagePath, type Language } from "@/lib/i18n";

import styles from "./home-page.module.css";

const HOME_MECHANISM_SCENE = createHomeMechanismScene();

function Brand({ label }: { label: string }) {
  return (
    <a className={styles.brand} href="#top" aria-label={label}>
      <span className={styles.brandMark} aria-hidden="true" />
      <span>OpenLinkage</span>
    </a>
  );
}

export function HomePage({ language }: { language: Language }) {
  const content = getHomeContent(language);
  const featuredWorkbench = content.workbenches.find((workbench) => workbench.featured);
  if (!featuredWorkbench) throw new Error("The homepage requires one featured workbench");

  const orderedWorkbenches = [
    featuredWorkbench,
    ...content.workbenches.filter((workbench) => !workbench.featured),
  ];

  return (
    <div
      className={`${styles.page} ${homeSans.variable} ${homeMono.variable}`}
      data-home-root
      lang={language === "zh" ? "zh-CN" : "en"}
    >
      <a className={styles.skipLink} href="#main-content">{content.skipLabel}</a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand label={content.nav.homeLabel} />
          <nav className={styles.nav} aria-label={content.nav.ariaLabel}>
            <a href="#workbenches" aria-label={content.nav.workbenchesAriaLabel}>
              {content.nav.workbenchesLabel}
            </a>
            <a
              href={content.nav.githubHref}
              target="_blank"
              rel="noreferrer"
              aria-label={content.nav.githubAriaLabel}
            >
              {content.nav.githubLabel} ↗
            </a>
          </nav>
          <LanguageSwitcher
            language={language}
            variant="inline"
            className={styles.languageSwitcher}
          />
        </div>
      </header>

      <main id="main-content" className={styles.main} aria-label={content.aria.mainLabel}>
        <section
          id="top"
          className={styles.hero}
          aria-labelledby="home-hero-title"
        >
          <div className={styles.heroSticky}>
            <div className={styles.progressLabel} aria-hidden="true">01 — 03</div>

            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>{content.hero.eyebrow}</p>
              <h1 id="home-hero-title" className={styles.headline}>{content.hero.headline}</h1>
              <p className={styles.intro}>{content.hero.intro}</p>
              <div className={styles.heroActions}>
                <a className={styles.primaryAction} href="#workbenches">
                  {content.hero.primaryCta}<span aria-hidden="true">↓</span>
                </a>
                <Link
                  className={styles.secondaryAction}
                  href={withLanguagePath(featuredWorkbench.href, language)}
                >
                  {content.hero.secondaryCta}<span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>

            <div className={styles.sceneColumn}>
              <div className={styles.sceneCode} aria-hidden="true">
                <span>MODE <strong>SMOOTH</strong></span>
                <span>SOLVER <strong>{Math.round(HOME_MECHANISM_SCENE.solver.validRatio * 100)}%</strong></span>
              </div>
              <div className={styles.sceneFrame}>
                <HomeMechanismPreview
                  scene={HOME_MECHANISM_SCENE}
                  labels={content.hero.sceneLabels}
                />
              </div>
            </div>

            <ol className={styles.chapters} aria-label={content.aria.chaptersLabel}>
              {content.chapters.map((chapter) => (
                <li className={styles.chapter} key={chapter.id}>
                  <span className={styles.chapterNumber}>{chapter.number}</span>
                  <h2>{chapter.title}</h2>
                  <p>{chapter.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className={styles.factRail}
          aria-label={content.aria.factRailLabel}
          data-home-reveal
        >
          {content.facts.map((fact) => (
            <div className={styles.fact} key={fact.id}>
              <strong className={styles.factValue}>{fact.label}</strong>
              <span className={styles.factLabel}>{fact.detail}</span>
            </div>
          ))}
        </section>

        <section
          id="workbenches"
          className={styles.workbenches}
          aria-labelledby="workbenches-title"
        >
          <div className={styles.sectionHeading} data-home-reveal>
            <div>
              <p className={styles.eyebrow}>{content.workbenchSection.eyebrow}</p>
              <h2 id="workbenches-title">{content.workbenchSection.title}</h2>
            </div>
            <p className={styles.sectionIntro}>{content.workbenchSection.intro}</p>
          </div>

          <div className={styles.bento} aria-label={content.workbenchSection.ariaLabel}>
            {orderedWorkbenches.map((workbench) => (
              <article
                className={`${styles.cardFrame} ${workbench.featured ? styles.cardFrameFeatured : ""}`}
                key={workbench.id}
                data-home-reveal
              >
                <Link
                  className={`${styles.workbenchCard} ${workbench.featured ? `${styles.featuredCard}` : ""}`}
                  href={withLanguagePath(workbench.href, language)}
                  aria-label={workbench.ariaLabel}
                >
                  <div className={styles.cardMeta}>
                    <span>{workbench.number}</span>
                    <span>
                      {workbench.featured ? `${content.workbenchSection.featuredLabel} · ` : ""}
                      {workbench.eyebrow}
                    </span>
                  </div>

                  <div className={styles.cardPreview}>
                    <HomeWorkbenchPreview kind={workbench.previewKind} />
                  </div>

                  <h3>{workbench.title}</h3>
                  <p className={styles.cardDescription}>{workbench.description}</p>
                  <ul className={styles.cardCapabilities} aria-hidden="true">
                    {workbench.capabilities.map((capability) => <li key={capability}>{capability}</li>)}
                  </ul>
                  <div className={styles.cardFooter}>
                    <div>
                      <span className={styles.cardStatus}>{workbench.status}</span>
                      <span className={styles.cardAction}>{workbench.action}</span>
                    </div>
                    <span className={styles.cardArrow} aria-hidden="true">↗</span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section
          className={styles.openSource}
          aria-labelledby="open-source-title"
          data-home-reveal
        >
          <div>
            <p className={styles.openSourceEyebrow}>{content.openSource.eyebrow}</p>
            <h2 id="open-source-title">{content.openSource.title}</h2>
            <p className={styles.openSourceDescription}>{content.openSource.description}</p>
          </div>
          <a
            className={styles.openSourceCta}
            href={content.openSource.href}
            target="_blank"
            rel="noreferrer"
            aria-label={content.openSource.ariaLabel}
          >
            {content.openSource.cta}<span aria-hidden="true">↗</span>
          </a>
        </section>
      </main>

      <footer className={styles.footer} aria-label={content.aria.footerLabel}>
        <span>{content.footer.tagline}</span>
        <span>{content.footer.licenseLabel}</span>
        <a
          href={content.footer.githubHref}
          target="_blank"
          rel="noreferrer"
          aria-label={content.footer.githubAriaLabel}
        >
          {content.footer.githubLabel} ↗
        </a>
      </footer>

      <HomeMotionController />
    </div>
  );
}
