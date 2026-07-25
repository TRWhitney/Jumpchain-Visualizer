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
      sectionHandle?: string;
    }
  | { kind: "layout"; handle: string };

const closestAncestor = (ancestors: readonly FormatSymbol[], kind: string) => {
  for (let index = ancestors.length - 1; index >= 0; index -= 1)
    if (ancestors[index].kind === kind) return ancestors[index];
  return undefined;
};

export function previewSelectionForSymbol(
  files: Readonly<Record<string, string>>,
  symbol: FormatSymbol,
): PreviewSelection {
  if (symbol.kind === "jump-appearance")
    return { kind: "appearance", mode: "components" };
  if (["section-layout", "choice-layout", "trait-layout"].includes(symbol.kind))
    return symbol.handle
      ? { kind: "layout", handle: symbol.handle }
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
