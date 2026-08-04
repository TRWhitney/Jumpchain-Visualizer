type Rgba = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

const transparent: Rgba = { red: 0, green: 0, blue: 0, alpha: 0 };

function parsedChannel(value: string) {
  const number = Number.parseFloat(value);
  return value.endsWith("%") ? (number / 100) * 255 : number;
}

export function parseRenderedColor(value: string): Rgba | null {
  if (value === "transparent") return transparent;
  const match = value.match(
    /^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i,
  );
  if (!match) return null;
  const alpha = match[4]
    ? match[4].endsWith("%")
      ? Number.parseFloat(match[4]) / 100
      : Number.parseFloat(match[4])
    : 1;
  return {
    red: parsedChannel(match[1]),
    green: parsedChannel(match[2]),
    blue: parsedChannel(match[3]),
    alpha,
  };
}

/** Places foreground over background using ordinary source-over compositing. */
export function compositeRenderedColors(
  foreground: Rgba,
  background: Rgba,
): Rgba {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  if (alpha === 0) return transparent;
  const channel = (front: number, back: number) =>
    (front * foreground.alpha +
      back * background.alpha * (1 - foreground.alpha)) /
    alpha;
  return {
    red: channel(foreground.red, background.red),
    green: channel(foreground.green, background.green),
    blue: channel(foreground.blue, background.blue),
    alpha,
  };
}

function renderedLayer(element: Element, pseudo?: "::before") {
  try {
    return parseRenderedColor(
      getComputedStyle(element, pseudo).backgroundColor,
    );
  } catch {
    return null;
  }
}

const channelHex = (value: number) =>
  Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, "0");

/**
 * Resolves the solid color visibly beneath an element by compositing ancestor
 * backgrounds. The authored layout renderer also paints some section surfaces
 * through ::before, so that layer is included before the owning background.
 */
export function renderedSurfaceColor(element: HTMLElement) {
  let result = transparent;
  for (
    let ancestor = element.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    const before = renderedLayer(ancestor, "::before");
    if (before && before.alpha > 0)
      result = compositeRenderedColors(result, before);
    const background = renderedLayer(ancestor);
    if (background && background.alpha > 0)
      result = compositeRenderedColors(result, background);
    if (result.alpha >= 0.999) break;
  }
  if (result.alpha < 0.999) return undefined;
  return `#${channelHex(result.red)}${channelHex(result.green)}${channelHex(result.blue)}`;
}

const surfaceSubscribers = new Map<HTMLElement, () => void>();
let surfaceObserver: MutationObserver | undefined;

function ensureSurfaceObserver() {
  if (
    surfaceObserver ||
    typeof MutationObserver === "undefined" ||
    typeof document === "undefined"
  )
    return;
  surfaceObserver = new MutationObserver((records) => {
    const changed = new Set<() => void>();
    for (const record of records) {
      if (!(record.target instanceof Element)) continue;
      for (const [element, subscriber] of surfaceSubscribers)
        if (record.target.contains(element)) changed.add(subscriber);
    }
    for (const subscriber of changed) subscriber();
  });
  surfaceObserver.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "data-app-theme"],
  });
}

/** Shares one bounded observer across all transparent automatic Tag badges. */
export function observeRenderedSurface(
  element: HTMLElement,
  subscriber: () => void,
) {
  surfaceSubscribers.set(element, subscriber);
  ensureSurfaceObserver();
  return () => {
    surfaceSubscribers.delete(element);
    if (!surfaceSubscribers.size) {
      surfaceObserver?.disconnect();
      surfaceObserver = undefined;
    }
  };
}
