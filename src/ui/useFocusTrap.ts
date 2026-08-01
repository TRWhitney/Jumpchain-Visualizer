import { useEffect, type RefObject } from "react";
import { elementsMatching, focusableElements } from "./focus";

export type FocusTrapOptions = {
  selector?: string;
  isActive?: (root: HTMLElement) => boolean;
};

export function useFocusTrap(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
  onEscape: () => void,
  options: FocusTrapOptions = {},
) {
  const { isActive, selector } = options;
  useEffect(() => {
    if (!enabled) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      selector
        ? elementsMatching(root.current, selector)
        : focusableElements(root.current);
    focusable()[0]?.focus();
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (!root.current?.isConnected) return;
      if (isActive && !isActive(root.current)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [enabled, isActive, onEscape, root, selector]);
}
