import { describe, expect, it } from "vitest";
import {
  inheritedAppearanceValue,
  resolvedJumpAppearance,
} from "./jumpAppearance";

describe("jump appearance cascade", () => {
  it("resolves exact, family, shared, and built-in values in order", () => {
    const resolved = resolvedJumpAppearance({
      themes: { ink: "#112233", panel: "#ddeeff" },
      appearance: {
        background: "panel",
        "text-color": "ink",
        "surface-text": "blue",
        "header-title": "#445566",
      },
    });

    expect(resolved.headerTitle).toBe("#445566");
    expect(resolved.headerDescription).toBe("#587ea8");
    expect(resolved.sectionBackground).toBe("#ddeeff");
    expect(resolved.sectionBody).toBe("#587ea8");
    expect(resolved.sectionBorder).toBe("#112233");
    expect(resolved.controlAccent).toBe("#112233");
  });

  it("treats theme tokens, built-ins, and literals as equivalent resolved colors", () => {
    expect(
      [
        { themes: { ink: "#111111" }, appearance: { "text-color": "ink" } },
        { themes: {}, appearance: { "text-color": "black" } },
        { themes: {}, appearance: { "text-color": "#111111" } },
      ].map(
        (item) =>
          resolvedJumpAppearance({
            themes: item.themes as Readonly<Record<string, string>>,
            appearance: item.appearance,
          }).surfaceText,
      ),
    ).toEqual(["#111111", "#111111", "#111111"]);
  });

  it("preserves layered renderer defaults when broad values are absent", () => {
    const resolved = resolvedJumpAppearance({ themes: {}, appearance: {} });

    expect(resolved.surfaceBackground).toBe("#f5f1e6");
    expect(resolved.headerDescription).toBe("#5f5a4d");
    expect(resolved.budgetBackground).toBe("#fffdf7");
    expect(resolved.costBenefitBackground).toBe("#dcebdc");
    expect(resolved.costAwardBackground).toBe(resolved.costBenefitBackground);
    expect(resolved.costAwardText).toBe(resolved.costBenefitText);
    expect(resolved.costAwardBorder).toBe(resolved.costBenefitBorder);
  });

  it("reports inherited values without writing them into appearance", () => {
    const packageItem = {
      themes: {},
      appearance: { "text-color": "#123456" },
    };

    expect(inheritedAppearanceValue("section-heading", packageItem)).toBe(
      "#123456",
    );
    expect(packageItem.appearance).toEqual({ "text-color": "#123456" });
  });
});
