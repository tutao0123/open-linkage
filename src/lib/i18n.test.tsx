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
