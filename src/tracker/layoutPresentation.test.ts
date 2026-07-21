import { describe, expect, it } from "vitest";
import type { LayoutNode } from "../markup";
import {
  layoutContainerPresentationStyle,
  layoutImageBoundaryStyle,
  layoutImageStyle,
  layoutInlineChildAreaStyle,
  layoutLeafPresentationStyle,
} from "./layoutPresentation";

const packageThemes = {
  themes: { surface: "#123456", unsafe: "not-a-color" },
};

function node(
  kind: LayoutNode["kind"],
  presentation: LayoutNode["presentation"] = {},
): LayoutNode {
  return { kind, presentation, children: [] };
}

describe("layout presentation styles", () => {
  it("applies the Format 1 container defaults", () => {
    expect(
      layoutContainerPresentationStyle(node("stack"), packageThemes),
    ).toMatchObject({
      gap: "0",
      padding: "0",
      alignItems: "stretch",
      justifyContent: "start",
      textAlign: "start",
      fontSize: ".75rem",
    });
  });

  it.each(["start", "center", "end", "stretch"] as const)(
    "maps container align %s to child alignment",
    (align) => {
      expect(
        layoutContainerPresentationStyle(
          node("inline", { align }),
          packageThemes,
        ).alignItems,
      ).toBe(align);
    },
  );

  it("maps every shared leaf presentation field onto its boundary", () => {
    expect(
      layoutLeafPresentationStyle(
        node("text", {
          padding: "sm",
          background: "surface",
          align: "end",
          textAlign: "center",
          textSize: "lg",
          textColor: "purple",
        }),
        packageThemes,
        "stack",
      ),
    ).toEqual({
      padding: ".5rem",
      backgroundColor: "#123456",
      alignSelf: "end",
      textAlign: "center",
      color: "#8065a8",
      fontSize: ".9rem",
    });
  });

  it.each([
    ["start", "flex-start", undefined, undefined, "min(20rem, 100%)"],
    ["center", "flex-start", "auto", "auto", "min(20rem, 100%)"],
    ["end", "flex-start", "auto", undefined, "min(20rem, 100%)"],
    ["stretch", "stretch", undefined, undefined, undefined],
  ] as const)(
    "positions an Inline leaf at %s and reserves stretch for free-space growth",
    (align, justifyContent, marginInlineStart, marginInlineEnd, inlineSize) => {
      expect(layoutInlineChildAreaStyle(node("text", { align }))).toEqual({
        justifyContent,
        marginInlineStart,
        marginInlineEnd,
        inlineSize,
        maxInlineSize: inlineSize ? "100%" : undefined,
      });
    },
  );

  it("leaves compact leaves intrinsic and stretches child containers", () => {
    expect(layoutInlineChildAreaStyle(node("text")).justifyContent).toBe(
      "flex-start",
    );
    expect(
      layoutInlineChildAreaStyle(node("text", { textAlign: "end" })).inlineSize,
    ).toBe("min(20rem, 100%)");
    expect(layoutInlineChildAreaStyle(node("image")).inlineSize).toBe(
      "min(20rem, 100%)",
    );
    expect(
      layoutInlineChildAreaStyle(node("stack", { align: "end" }))
        .justifyContent,
    ).toBe("stretch");
  });

  it.each([
    [
      "size",
      { size: "lg" },
      { width: "8rem", height: "8rem" },
      { width: "100%", height: "100%" },
    ],
    [
      "independent dimensions",
      { width: "xl", height: "sm", fit: "cover" },
      { width: "12rem", height: "3rem" },
      { width: "100%", height: "100%", objectFit: "cover" },
    ],
    [
      "intrinsic",
      {},
      { width: "100%", height: undefined },
      { width: "100%", height: "auto" },
    ],
    [
      "width-only aspect ratio",
      { width: "md" },
      { width: "5rem", height: undefined },
      { width: "100%", height: "auto" },
    ],
    [
      "height-only aspect ratio",
      { height: "md" },
      { width: undefined, height: "5rem" },
      { width: "auto", height: "100%" },
    ],
    [
      "positioned intrinsic",
      { align: "end" },
      { width: "min(100%, 20rem)", height: undefined },
      { width: "100%", height: "auto" },
    ],
  ] as const)(
    "maps image %s presentation",
    (_name, presentation, boundaryExpected, imageExpected) => {
      const image = node("image", presentation);
      expect(layoutImageBoundaryStyle(image)).toMatchObject(boundaryExpected);
      expect(layoutImageStyle(image)).toMatchObject(imageExpected);
    },
  );

  it("does not forward invalid recovery values into CSS", () => {
    const container = layoutContainerPresentationStyle(
      node("grid", {
        gap: "calc(100vw)",
        padding: "var(--unsafe)",
        background: "unsafe",
        align: "sideways",
        justify: "outside",
        textAlign: "around",
        textSize: "huge",
        columns: 99,
      }),
      packageThemes,
    );
    expect(container).toMatchObject({
      gap: undefined,
      padding: undefined,
      backgroundColor: undefined,
      alignItems: undefined,
      justifyContent: undefined,
      textAlign: undefined,
      fontSize: undefined,
      gridTemplateColumns: undefined,
    });
    expect(
      layoutLeafPresentationStyle(
        node("text", { align: "sideways" }),
        packageThemes,
      ).alignSelf,
    ).toBeUndefined();
    expect(
      layoutImageStyle(node("image", { fit: "stretch" })).objectFit,
    ).toBeUndefined();
  });
});
