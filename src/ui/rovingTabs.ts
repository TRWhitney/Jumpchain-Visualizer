import type { KeyboardEvent } from "react";

export type RovingTabDirection = "horizontal" | "vertical" | "both";

export function nextRovingTabIndex(
  key: string,
  current: number,
  count: number,
  direction: RovingTabDirection = "horizontal",
) {
  const forward =
    key === "ArrowRight" || (key === "ArrowDown" && direction !== "horizontal");
  const backward =
    key === "ArrowLeft" || (key === "ArrowUp" && direction !== "horizontal");
  if (direction === "vertical" && (key === "ArrowRight" || key === "ArrowLeft"))
    return null;
  if (forward) return (current + 1) % count;
  if (backward) return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

export function handleRovingTabKeyDown<T extends string>(
  event: KeyboardEvent<HTMLElement>,
  items: readonly T[],
  value: T,
  onChange: (value: T) => void,
  direction: RovingTabDirection = "horizontal",
) {
  const current = items.indexOf(value);
  const next = nextRovingTabIndex(event.key, current, items.length, direction);
  if (next === null) return false;
  event.preventDefault();
  onChange(items[next]);
  const target = event.currentTarget;
  requestAnimationFrame(() =>
    (target.children[next] as HTMLElement | undefined)?.focus(),
  );
  return true;
}
