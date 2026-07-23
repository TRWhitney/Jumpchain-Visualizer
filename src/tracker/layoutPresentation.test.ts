import { describe, expect, it } from "vitest";
import type { LayoutNode } from "../markup";
import {
  layoutContainerPresentationStyle,
  layoutImageBoundaryStyle,
  layoutImageStyle,
  layoutInlineChildAreaStyle,
  layoutLeafPresentationStyle,
  layoutRuleStyle,
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
      "max-content",
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
      {
        width: "16rem",
        height: undefined,
        maxWidth: "100%",
      },
      {
        width: "100%",
        height: "auto",
        aspectRatio: "1 / 1",
        maxWidth: "100%",
      },
    ],
    [
      "independent dimensions",
      { width: "xl", height: "sm", fit: "cover" },
      { width: "32rem", height: "4rem", maxWidth: "100%" },
      {
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        objectFit: "cover",
      },
    ],
    [
      "intrinsic",
      {},
      { width: "fit-content", height: undefined, maxWidth: "100%" },
      { width: "auto", height: "auto", maxWidth: "100%" },
    ],
    [
      "width-only aspect ratio",
      { width: "md" },
      { width: "8rem", height: undefined, maxWidth: "100%" },
      { width: "100%", height: "auto", maxWidth: "100%" },
    ],
    [
      "height-only aspect ratio",
      { height: "md" },
      { width: undefined, height: "8rem", maxWidth: "100%" },
      { width: "auto", height: "100%", maxWidth: "100%" },
    ],
    [
      "positioned intrinsic",
      { align: "end" },
      { width: "fit-content", height: undefined, maxWidth: "100%" },
      { width: "auto", height: "auto", maxWidth: "100%" },
    ],
  ] as const)(
    "maps image %s presentation",
    (_name, presentation, boundaryExpected, imageExpected) => {
      const image = node("image", presentation);
      expect(layoutImageBoundaryStyle(image)).toMatchObject(boundaryExpected);
      expect(layoutImageStyle(image)).toMatchObject(imageExpected);
    },
  );

  it("accepts exact image dimensions without forwarding arbitrary CSS", () => {
    const exact = node("image", {
      width: "320px",
      height: "11.5rem",
      fit: "contain",
    });
    expect(layoutImageBoundaryStyle(exact)).toMatchObject({
      width: "320px",
      height: "11.5rem",
      maxWidth: "100%",
    });
    expect(layoutImageStyle(exact)).toMatchObject({
      width: "100%",
      height: "100%",
      maxWidth: "100%",
      objectFit: "contain",
    });
    expect(
      layoutImageBoundaryStyle(
        node("image", { width: "calc(100vw)", height: "var(--unsafe)" }),
      ),
    ).toMatchObject({
      width: "fit-content",
      height: undefined,
      maxWidth: "100%",
    });
  });

  it("stretches an image boundary instead of assigning an artificial intrinsic width", () => {
    expect(
      layoutImageBoundaryStyle(node("image", { align: "stretch" })),
    ).toMatchObject({ width: "100%", maxWidth: "100%" });
    expect(layoutImageStyle(node("image", { align: "stretch" }))).toMatchObject(
      { width: "100%", height: "auto", maxWidth: "100%" },
    );
    expect(
      layoutImageBoundaryStyle(node("image", { align: "center" })),
    ).toMatchObject({ width: "fit-content", maxWidth: "100%" });
    expect(layoutImageBoundaryStyle(node("image"), "stack")).toMatchObject({
      width: "100%",
      maxWidth: "100%",
    });
    expect(layoutImageStyle(node("image"), "stack")).toMatchObject({
      width: "100%",
      height: "auto",
      maxWidth: "100%",
    });
    expect(layoutImageBoundaryStyle(node("image"), "inline")).toMatchObject({
      width: undefined,
      maxWidth: "100%",
    });
  });

  it("does not apply text-only presentation to image boundaries", () => {
    expect(
      layoutLeafPresentationStyle(
        node("image", {
          padding: "sm",
          background: "surface",
          textAlign: "end",
          textSize: "2xl",
          textColor: "red",
        }),
        packageThemes,
        "stack",
      ),
    ).toEqual({
      padding: ".5rem",
      backgroundColor: "#123456",
      alignSelf: undefined,
      justifySelf: undefined,
    });
  });

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

  it("maps rule defaults and authored presentation without arbitrary CSS", () => {
    expect(layoutRuleStyle(node("rule"), packageThemes)).toMatchObject({
      width: "100%",
      margin: 0,
      border: 0,
      borderTopColor: undefined,
      borderTopWidth: "1px",
      borderTopStyle: "solid",
    });
    expect(
      layoutRuleStyle(
        node("rule", {
          color: "surface",
          thickness: 3,
          style: "dash",
        }),
        packageThemes,
      ),
    ).toMatchObject({
      borderTopColor: "#123456",
      borderTopWidth: "3px",
      borderTopStyle: "dashed",
    });
    expect(
      layoutRuleStyle(
        node("rule", {
          color: "surface",
          thickness: 6,
          style: "rounded",
        }),
        packageThemes,
      ),
    ).toMatchObject({
      width: "100%",
      height: "6px",
      margin: 0,
      backgroundColor: "#123456",
      border: 0,
      borderStyle: "none",
      borderRadius: "9999px",
    });
    expect(
      layoutRuleStyle(
        node("rule", {
          color: "unsafe",
          thickness: 99,
          style: "double",
        }),
        packageThemes,
      ),
    ).toMatchObject({
      borderTopColor: undefined,
      borderTopWidth: undefined,
      borderTopStyle: undefined,
    });
  });
});
