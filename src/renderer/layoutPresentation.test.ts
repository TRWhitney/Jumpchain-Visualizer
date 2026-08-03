import { describe, expect, it } from "vitest";
import type { LayoutNode } from "../markup";
import {
  layoutBackgroundImageStyle,
  layoutContainerPresentationStyle,
  layoutImageBoundaryStyle,
  layoutImageStyle,
  layoutInlineChildAreaStyle,
  layoutLeafPresentationStyle,
  layoutRuleStyle,
  layoutTiledImageStyle,
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
  it.each([
    [
      "cover",
      {
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      },
    ],
    [
      "contain",
      {
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "contain",
      },
    ],
    [
      "tile",
      {
        backgroundPosition: "0 0",
        backgroundRepeat: "repeat",
        backgroundSize: "auto",
      },
    ],
  ] as const)(
    "maps %s background images without accepting raw CSS",
    (fit, expected) => {
      expect(
        layoutBackgroundImageStyle(
          node("stack", { backgroundImage: "texture", backgroundFit: fit }),
          "blob:fixture",
        ),
      ).toMatchObject({
        backgroundImage: 'url("blob:fixture")',
        ...expected,
      });
      expect(layoutBackgroundImageStyle(node("stack"), null)).toEqual({});
    },
  );

  it("maps ordinary tiled images to a repeating visual layer", () => {
    expect(layoutTiledImageStyle("blob:tile")).toEqual({
      backgroundImage: 'url("blob:tile")',
      backgroundPosition: "0 0",
      backgroundRepeat: "repeat",
      backgroundSize: "auto",
    });
    expect(
      layoutImageStyle(node("image", { width: "xl", fit: "tile" })),
    ).toMatchObject({
      width: "100%",
      objectFit: undefined,
    });
  });

  it("applies direct-choice boundary padding, background, and alignment", () => {
    expect(
      layoutLeafPresentationStyle(
        node("choice", {
          padding: "sm",
          background: "surface",
          align: "end",
        }),
        packageThemes,
        "stack",
      ),
    ).toMatchObject({
      padding: ".5rem",
      backgroundColor: "#123456",
      alignSelf: "end",
    });
  });

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
    expect(
      layoutContainerPresentationStyle(node("stack"), packageThemes, "grid"),
    ).toMatchObject({ fontSize: undefined });
  });

  it("constrains authored borders, corners, and clipping", () => {
    expect(
      layoutContainerPresentationStyle(
        node("stack", {
          borderColor: "surface",
          borderWidth: "medium",
          borderStyle: "dashed",
          corners: "lg",
          clip: true,
        }),
        packageThemes,
      ),
    ).toMatchObject({
      borderColor: "#123456",
      borderWidth: "2px",
      borderStyle: "dashed",
      borderRadius: ".7rem",
      overflow: "hidden",
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
      "--jump-layout-background-color": "#123456",
      alignSelf: "end",
      textAlign: "center",
      color: "#8065a8",
      fontSize: "1.5rem",
    });
  });

  it.each(["control", "roll"])(
    "aligns %s content inside its leaf without applying text styling",
    (target) => {
      const control = {
        ...node("slot", {
          padding: "sm",
          background: "surface",
          align: "end",
          textAlign: "center",
          textSize: "2xl",
          textColor: "red",
        }),
        target,
      };

      expect(
        layoutLeafPresentationStyle(control, packageThemes, "inline"),
      ).toEqual({
        padding: ".5rem",
        backgroundColor: "#123456",
        "--jump-layout-background-color": "#123456",
        display: "flex",
        justifyContent: "center",
        alignSelf: undefined,
        justifySelf: undefined,
      });
      expect(layoutInlineChildAreaStyle(control)).toEqual({
        justifyContent: "flex-start",
        marginInlineStart: "auto",
        marginInlineEnd: undefined,
        inlineSize: "min(20rem, 100%)",
        maxInlineSize: "100%",
      });
    },
  );

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

  it("reserves extra stretched area without growing authored image dimensions", () => {
    expect(
      layoutInlineChildAreaStyle(node("image", { align: "stretch" })),
    ).not.toHaveProperty("flex");
    expect(
      layoutInlineChildAreaStyle(
        node("image", { align: "stretch", size: "md" }),
      ),
    ).toMatchObject({ flex: "1 1 auto", justifyContent: "stretch" });
    expect(
      layoutImageBoundaryStyle(
        node("image", { align: "stretch", size: "md" }),
        "inline",
      ),
    ).toMatchObject({ flex: "0 1 auto", width: "8rem" });
    expect(
      layoutImageBoundaryStyle(node("image", { align: "stretch" }), "inline"),
    ).toMatchObject({ flex: undefined, width: "100%" });
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
      "--jump-layout-background-color": "#123456",
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
    expect(
      layoutRuleStyle(
        node("rule", {
          color: "surface",
          thickness: 2,
          style: "solid",
          orientation: "vertical",
        }),
        packageThemes,
      ),
    ).toMatchObject({
      width: "2px",
      height: "100%",
      borderLeftColor: "#123456",
      borderLeftWidth: "2px",
      borderLeftStyle: "solid",
      borderTopStyle: undefined,
    });
  });

  it("maps the strong text scale and bounded exact sizes through one field", () => {
    for (const [token, size] of Object.entries({
      xs: ".625rem",
      sm: ".75rem",
      md: "1rem",
      lg: "1.5rem",
      xl: "2.25rem",
      "2xl": "3.25rem",
      "3xl": "4.5rem",
      "4xl": "6rem",
    }))
      expect(
        layoutLeafPresentationStyle(
          node("text", { textSize: token }),
          packageThemes,
          "stack",
        ).fontSize,
      ).toBe(size);
    for (const size of ["8px", "48px", "512px", ".5rem", "3rem", "32rem"])
      expect(
        layoutLeafPresentationStyle(
          node("text", { textSize: size }),
          packageThemes,
          "stack",
        ).fontSize,
      ).toBe(size);
    for (const size of ["7px", "513px", ".49rem", "33rem", "50%", "1vw"])
      expect(
        layoutLeafPresentationStyle(
          node("text", { textSize: size }),
          packageThemes,
          "stack",
        ).fontSize,
      ).toBeUndefined();
  });

  it("maps growth, weighted tracks, spans, geometry, and typography", () => {
    expect(
      layoutContainerPresentationStyle(
        node("grid", { columns: 3, columnWeights: [3, 4, 2] }),
        packageThemes,
      ).gridTemplateColumns,
    ).toBe("minmax(0, 3fr) minmax(0, 4fr) minmax(0, 2fr)");
    expect(
      layoutContainerPresentationStyle(
        node("stack", {
          grow: 2,
          minWidth: "16rem",
          minHeight: "48px",
          aspectRatio: "16/9",
          fontFamily: "condensed",
          fontWeight: "black",
          lineHeight: "tight",
          letterSpacing: "wide",
        }),
        packageThemes,
        "stack",
      ),
    ).toMatchObject({
      flexGrow: 2,
      flexBasis: 0,
      minWidth: "min(16rem, 100%)",
      minHeight: "48px",
      aspectRatio: "16 / 9",
      fontStretch: "condensed",
      fontWeight: 900,
      lineHeight: 1.05,
      letterSpacing: ".05em",
    });
    expect(
      layoutLeafPresentationStyle(
        node("choice", { columnSpan: 2, rowSpan: 3 }),
        packageThemes,
        "grid",
      ),
    ).toMatchObject({ gridColumn: "span 2", gridRow: "span 3" });
    expect(layoutInlineChildAreaStyle(node("text", { grow: 4 })).flex).toBe(
      "4 1 0",
    );
  });
});
