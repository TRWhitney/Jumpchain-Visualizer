import { describe, expect, it } from "vitest";
import { decodeSvgBytes, validateSvgSource } from "./svgAsset";

describe("secure SVG asset source", () => {
  it("preserves accepted authored source byte-for-byte and derives viewBox geometry", () => {
    const source =
      '<svg viewBox="0 0 64 32" xmlns="http://www.w3.org/2000/svg">\n  <rect width="64" height="32" fill="#123456"/>\n</svg>\n';
    const result = validateSvgSource(source);
    expect(result).toMatchObject({ valid: true, width: 64, height: 32 });
    if (!result.valid) return;
    expect(decodeSvgBytes(result.bytes)).toBe(source);
  });

  it.each([
    [
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      "Active or embedded",
    ],
    [
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>',
      "must stay inside",
    ],
    [
      '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg/>',
      "DOCTYPE",
    ],
    [
      '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="run()"/></svg>',
      "Event handler",
    ],
    [
      '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(https://example.com/a)"/></svg>',
      "External or active CSS",
    ],
  ])("rejects active SVG source", (source, message) => {
    const result = validateSvgSource(source);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((item) => item.message).join(" ")).toContain(
      message,
    );
  });

  it("rejects malformed XML and an over-budget document", () => {
    expect(validateSvgSource("<svg><g></svg>").valid).toBe(false);
    const oversized = validateSvgSource(
      '<svg width="9000" height="9000" xmlns="http://www.w3.org/2000/svg"/>',
    );
    expect(oversized.valid).toBe(false);
    expect(oversized.diagnostics.at(-1)?.message).toContain("dimensions");
  });
});
