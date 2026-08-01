import type { JumpLayout } from "../markup";
import type { FormatSymbol } from "./languageService";
import { readSourceField, structuredContext } from "./documentEditor";

export type PreviewSelection =
  | { kind: "package" }
  | { kind: "appearance"; mode: "components" | "jump" }
  | { kind: "section"; handle: string }
  | { kind: "choice"; handle: string; sectionHandle?: string }
  | { kind: "choice-source"; handle: string; sectionHandle: string }
  | {
      kind: "image";
      handle: string;
      src?: string;
      alt?: string;
      roundedCorners: boolean;
      roundedIntensity: number;
      fadeEdges: boolean;
      fadeIntensity: number;
      sectionHandle?: string;
    }
  | {
      kind: "layout";
      handle: string;
      layoutKind: JumpLayout["kind"];
    };

const closestAncestor = (ancestors: readonly FormatSymbol[], kind: string) => {
  for (let index = ancestors.length - 1; index >= 0; index -= 1)
    if (ancestors[index].kind === kind) return ancestors[index];
  return undefined;
};

const isLayoutKind = (kind: string): kind is JumpLayout["kind"] =>
  kind === "section-layout" ||
  kind === "choice-layout" ||
  kind === "trait-layout";

export function previewSelectionForSymbol(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
): PreviewSelection {
  if (symbol.kind === "jump-appearance")
    return { kind: "appearance", mode: "components" };
  if (isLayoutKind(symbol.kind))
    return symbol.handle
      ? {
          kind: "layout",
          handle: symbol.handle,
          layoutKind: symbol.kind,
        }
      : { kind: "package" };
  if (symbol.kind === "section")
    return symbol.handle
      ? { kind: "section", handle: symbol.handle }
      : { kind: "package" };

  const context = structuredContext(files, symbol);
  const section = closestAncestor(context?.ancestors ?? [], "section");
  const owningChoice = closestAncestor(context?.ancestors ?? [], "choice");

  if (symbol.kind === "image")
    return {
      kind: "image",
      handle: symbol.handle ?? "",
      src:
        readSourceField(files[symbol.file] ?? "", symbol, "src") || undefined,
      alt:
        readSourceField(files[symbol.file] ?? "", symbol, "alt") || undefined,
      roundedCorners:
        readSourceField(files[symbol.file] ?? "", symbol, "rounded-corners") ===
        "true",
      roundedIntensity:
        Number(
          readSourceField(
            files[symbol.file] ?? "",
            symbol,
            "rounded-intensity",
          ),
        ) || 25,
      fadeEdges:
        readSourceField(files[symbol.file] ?? "", symbol, "fade-edges") ===
        "true",
      fadeIntensity:
        Number(
          readSourceField(files[symbol.file] ?? "", symbol, "fade-intensity"),
        ) || 25,
      sectionHandle: section?.handle,
    };
  if (symbol.kind === "choice-source" && section?.handle && symbol.handle)
    return {
      kind: "choice-source",
      handle: symbol.handle,
      sectionHandle: section.handle,
    };
  if (symbol.kind === "choice") {
    const handle = section
      ? readSourceField(files[symbol.file] ?? "", symbol, "target")
      : symbol.handle;
    return handle
      ? { kind: "choice", handle, sectionHandle: section?.handle }
      : section?.handle
        ? { kind: "section", handle: section.handle }
        : { kind: "package" };
  }
  if (owningChoice?.handle)
    return { kind: "choice", handle: owningChoice.handle };
  if (section?.handle) return { kind: "section", handle: section.handle };
  return { kind: "package" };
}
