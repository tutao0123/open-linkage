import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";

import {
  localizeReactTree,
  translateText,
  withLanguagePath,
} from "./i18n";

describe("site localization", () => {
  it("keeps Chinese copy unchanged in Chinese mode", () => {
    expect(translateText("选择机构与调节方式", "zh")).toBe("选择机构与调节方式");
  });

  it("uses engineering terminology for key workflow labels", () => {
    expect(translateText("选择机构与调节方式", "en")).toBe("Choose the Mechanism and Adjustment");
    expect(translateText("候选与工程检查", "en")).toBe("Candidates & Engineering Checks");
    expect(translateText("整周求解率", "en")).toBe("Full-cycle Solution Rate");
  });

  it("translates runtime-composed labels without leaving Chinese fragments", () => {
    const selected = translateText("已选择巡航工况。", "en");
    const target = translateText("巡航步长目标", "en");

    expect(selected).toBe("Selected Cruise operating condition.");
    expect(target).toBe("Cruise Step Length target");
    expect(`${selected}${target}`).not.toMatch(/\p{Script=Han}/u);
  });

  it("localizes the beginner quick-start flow and matched-reference status", () => {
    const intro = translateText(
      "播放看看，也可以表达你想要的步子、抬脚和速度。拖动后会匹配最接近的已验证走法，并始终保留上一个可走参考。",
      "en",
    );
    const matched = translateText(
      "已匹配到最接近的可走参考：平稳走；实际约 204 mm 步幅、69 mm 抬脚、14 rpm。",
      "en",
    );
    const switched = translateText(
      "已切换到高抬脚参考；这是经过整周验证的可走方案。",
      "en",
    );

    expect(intro).toContain("nearest verified gait");
    expect(matched).toBe(
      "Matched the nearest verified reference: Smooth; actual 204 mm step, 69 mm clearance, 14 rpm.",
    );
    expect(switched).toBe(
      "Switched to High Step reference; this gait has been verified over the full cycle.",
    );
    expect(`${intro}${matched}${switched}`).not.toMatch(/\p{Script=Han}/u);
  });

  it("keeps every internal destination inside the active language", () => {
    expect(withLanguagePath("/variable-leg?transfer=designer", "en"))
      .toBe("/en/variable-leg?transfer=designer");
    expect(withLanguagePath("/zh/designer?template=watt", "en"))
      .toBe("/en/designer?template=watt");
    expect(withLanguagePath("https://github.com/tutao0123/open-linkage", "en"))
      .toBe("https://github.com/tutao0123/open-linkage");
  });

  it("localizes visible copy and accessibility labels together", () => {
    const localized = localizeReactTree(
      <button type="button" aria-label="进入四杆设计">进入四杆设计</button>,
      "en",
    );

    expect(isValidElement(localized)).toBe(true);
    const element = localized as ReactElement<{
      "aria-label": string;
      children: string;
    }>;
    expect(element.props["aria-label"]).toBe("Open Four-bar Design");
    expect(element.props.children).toEqual(["Open Four-bar Design"]);
  });
});
