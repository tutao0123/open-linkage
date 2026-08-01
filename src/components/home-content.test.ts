import { describe, expect, it } from "vitest";

import { HOME_CONTENT, getHomeContent, type HomeContent } from "./home-content";

const locales = ["zh", "en"] as const;

function collectKeys(value: unknown, path = "root"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectKeys(item, `${path}[]`));
  }
  if (value === null || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, child]) => [
    `${path}.${key}`,
    ...collectKeys(child, `${path}.${key}`),
  ]);
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectStrings);
}

function structuralCopy(content: HomeContent) {
  return {
    ...content,
    locale: "locale",
    chapters: content.chapters.map((chapter) => ({ ...chapter, title: "", description: "" })),
    facts: content.facts.map((fact) => ({ ...fact, label: "", detail: "" })),
    workbenches: content.workbenches.map((workbench) => ({
      id: workbench.id,
      number: workbench.number,
      href: workbench.href,
      previewKind: workbench.previewKind,
      featured: workbench.featured,
    })),
  };
}

describe("homepage content", () => {
  it("keeps the Chinese and English models structurally in parity", () => {
    expect(collectKeys(HOME_CONTENT.en)).toEqual(collectKeys(HOME_CONTENT.zh));
    expect(structuralCopy(HOME_CONTENT.en).chapters).toEqual(structuralCopy(HOME_CONTENT.zh).chapters);
    expect(structuralCopy(HOME_CONTENT.en).facts.map(({ id }) => id))
      .toEqual(structuralCopy(HOME_CONTENT.zh).facts.map(({ id }) => id));
    expect(structuralCopy(HOME_CONTENT.en).workbenches)
      .toEqual(structuralCopy(HOME_CONTENT.zh).workbenches);
  });

  it("uses unique stable workbench ids and base routes", () => {
    const expectedIds = ["four-bar", "six-bar-leg", "variable-leg", "straight-line", "free-mechanism"];
    const expectedRoutes = ["/lab", "/leg", "/variable-leg", "/straight-line", "/designer"];

    for (const locale of locales) {
      const workbenches = getHomeContent(locale).workbenches;
      const ids = workbenches.map(({ id }) => id);
      const routes = workbenches.map(({ href }) => href);

      expect(workbenches).toHaveLength(5);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(routes).size).toBe(routes.length);
      expect(ids).toEqual(expectedIds);
      expect(routes).toEqual(expectedRoutes);
    }
  });

  it("provides complete visible copy and accessibility labels in both locales", () => {
    for (const locale of locales) {
      const content = getHomeContent(locale);
      expect(collectStrings(content).every((value) => value.trim().length > 0)).toBe(true);
      expect(content.chapters).toHaveLength(3);
      expect(content.facts).toHaveLength(4);
      expect(content.hero.primaryCta).toBeTruthy();
      expect(content.hero.secondaryCta).toBeTruthy();
      expect(Object.values(content.hero.sceneLabels).every(Boolean)).toBe(true);
      expect(Object.values(content.aria).every(Boolean)).toBe(true);
      expect(content.workbenches.every(({ ariaLabel, previewAriaLabel }) => ariaLabel && previewAriaLabel)).toBe(true);
    }

    expect(HOME_CONTENT.zh.hero.headline).toBe("从一条轨迹，到一套会动的机构。");
    expect(HOME_CONTENT.zh.chapters.map(({ title }) => title)).toEqual([
      "定义运动目标",
      "自动生成机构方案",
      "验证性能并继续设计",
    ]);
    expect(HOME_CONTENT.zh.facts.map(({ label }) => label)).toEqual([
      "5 个工作台",
      "浏览器端",
      "开源",
      "多工况综合",
    ]);
    expect(collectStrings(HOME_CONTENT.en).join(" ")).not.toMatch(/\p{Script=Han}/u);
  });

  it("features only the variable-geometry leg", () => {
    for (const locale of locales) {
      const featured = getHomeContent(locale).workbenches.filter(({ featured }) => featured);
      expect(featured).toHaveLength(1);
      expect(featured[0]).toMatchObject({
        id: "variable-leg",
        href: "/variable-leg",
        previewKind: "variable-leg",
      });
    }
  });
});
