import { xml } from "@codemirror/lang-xml";

export type SvgSourceDiagnostic = {
  from: number;
  to: number;
  severity: "error" | "warning";
  message: string;
};

export type ValidSvgSource = {
  valid: true;
  bytes: Uint8Array;
  width: number;
  height: number;
  diagnostics: readonly SvgSourceDiagnostic[];
};

export type InvalidSvgSource = {
  valid: false;
  diagnostics: readonly SvgSourceDiagnostic[];
};

export type SvgSourceValidation = ValidSvgSource | InvalidSvgSource;

const MAX_SVG_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 8_192;
const MAX_PIXELS = 24_000_000;
const forbiddenElements =
  /<\s*(?:script|foreignObject|iframe|object|embed|audio|video|canvas|style)\b/i;
const forbiddenDeclarations = /<\s*!(?:DOCTYPE|ENTITY)\b/i;
const cssHazard = /(?:@import|expression\s*\(|javascript\s*:)/i;

function diagnostic(
  source: string,
  match: RegExpMatchArray | RegExpExecArray | null,
  message: string,
): SvgSourceDiagnostic {
  const from = match?.index ?? 0;
  return {
    from,
    to: Math.min(source.length, from + Math.max(1, match?.[0].length ?? 1)),
    severity: "error",
    message,
  };
}

function parseLength(value: string | null) {
  if (!value) return null;
  const match = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

function svgGeometry(source: string) {
  const root = /<svg\b([^>]*)>/i.exec(source);
  if (!root) return null;
  const attributes = root[1];
  const attribute = (name: string) =>
    new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(
      attributes,
    )?.[2] ?? null;
  let width = parseLength(attribute("width"));
  let height = parseLength(attribute("height"));
  const viewBox = attribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    (!width || !height) &&
    viewBox?.length === 4 &&
    viewBox.every(Number.isFinite)
  ) {
    width ||= Math.abs(viewBox[2]);
    height ||= Math.abs(viewBox[3]);
  }
  width ||= 300;
  height ||= 150;
  return { width: Math.round(width), height: Math.round(height) };
}

export function validateSvgSource(source: string): SvgSourceValidation {
  const diagnostics: SvgSourceDiagnostic[] = [];
  let bytes: Uint8Array;
  try {
    bytes = new TextEncoder().encode(source);
  } catch {
    return {
      valid: false,
      diagnostics: [diagnostic(source, null, "SVG source is not valid UTF-8.")],
    };
  }
  if (bytes.byteLength > MAX_SVG_SOURCE_BYTES)
    diagnostics.push(
      diagnostic(source, null, "SVG source exceeds the 4 MiB safety limit."),
    );

  const tree = xml().language.parser.parse(source);
  const cursor = tree.cursor();
  do {
    if (cursor.type.isError)
      diagnostics.push({
        from: cursor.from,
        to: Math.max(cursor.from + 1, cursor.to),
        severity: "error",
        message: "Malformed XML.",
      });
  } while (cursor.next());
  const elementPattern = /<(?![!?])\s*(\/?)\s*([A-Za-z_][\w:.-]*)([^>]*)>/g;
  const openElements: Array<{ name: string; from: number }> = [];
  for (
    let match = elementPattern.exec(source);
    match;
    match = elementPattern.exec(source)
  ) {
    const closing = Boolean(match[1]);
    const name = match[2];
    const selfClosing = /\/\s*$/.test(match[3]);
    if (closing) {
      const opened = openElements.pop();
      if (!opened || opened.name !== name) {
        diagnostics.push(
          diagnostic(source, match, `Mismatched closing tag </${name}>.`),
        );
        break;
      }
    } else if (!selfClosing) openElements.push({ name, from: match.index });
  }
  if (openElements.length) {
    const opened = openElements.at(-1)!;
    diagnostics.push({
      from: opened.from,
      to: Math.min(source.length, opened.from + opened.name.length + 1),
      severity: "error",
      message: `Unclosed <${opened.name}> element.`,
    });
  }

  const firstElement = source
    .replace(/^\uFEFF/, "")
    .replace(/^\s*<\?xml[\s\S]*?\?>/, "")
    .replace(/^\s*<!--[\s\S]*?-->/, "")
    .trimStart();
  if (!/^<svg(?:\s|>)/.test(firstElement))
    diagnostics.push(
      diagnostic(source, null, "The document root must be an SVG element."),
    );

  const declarationMatch = source.match(forbiddenDeclarations);
  if (declarationMatch)
    diagnostics.push(
      diagnostic(
        source,
        declarationMatch,
        "DOCTYPE and entity declarations are not allowed.",
      ),
    );
  const elementMatch = source.match(forbiddenElements);
  if (elementMatch)
    diagnostics.push(
      diagnostic(
        source,
        elementMatch,
        "Active or embedded document elements are not allowed.",
      ),
    );

  const attributePattern = /\s([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g;
  for (
    let match = attributePattern.exec(source);
    match;
    match = attributePattern.exec(source)
  ) {
    const name = match[1].toLocaleLowerCase();
    const value = match[3].trim();
    if (name.startsWith("on"))
      diagnostics.push(
        diagnostic(source, match, "Event handler attributes are not allowed."),
      );
    if (
      (name === "href" || name.endsWith(":href")) &&
      value &&
      !value.startsWith("#")
    )
      diagnostics.push(
        diagnostic(
          source,
          match,
          "SVG links and image references must stay inside this document.",
        ),
      );
    if (
      name === "style" &&
      (cssHazard.test(value) ||
        [...value.matchAll(/url\((.*?)\)/gi)].some(
          (url) =>
            !url[1]
              .trim()
              .replace(/^['"]|['"]$/g, "")
              .startsWith("#"),
        ))
    )
      diagnostics.push(
        diagnostic(source, match, "External or active CSS is not allowed."),
      );
  }

  if (/\b(?:src|data)\s*=\s*["']/i.test(source))
    diagnostics.push(
      diagnostic(
        source,
        source.match(/\b(?:src|data)\s*=\s*["']/i),
        "Embedded external content is not allowed.",
      ),
    );

  const geometry = svgGeometry(source);
  if (
    !geometry ||
    geometry.width < 1 ||
    geometry.height < 1 ||
    geometry.width > MAX_DIMENSION ||
    geometry.height > MAX_DIMENSION ||
    geometry.width * geometry.height > MAX_PIXELS
  )
    diagnostics.push(
      diagnostic(
        source,
        source.match(/<svg\b[^>]*>/i),
        "SVG dimensions exceed the package image budget.",
      ),
    );

  if (diagnostics.some((item) => item.severity === "error"))
    return { valid: false, diagnostics };
  return {
    valid: true,
    bytes,
    width: geometry!.width,
    height: geometry!.height,
    diagnostics,
  };
}

export function decodeSvgBytes(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function validateSvgBytes(bytes: Uint8Array) {
  const source = decodeSvgBytes(bytes);
  return source === null ? null : validateSvgSource(source);
}
