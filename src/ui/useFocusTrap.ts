import { useEffect, type RefObject } from "react";
import { focusableElements } from "./focus";

export function useFocusTrap(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
  onEscape: () => void,
) {
  useEffect(() => {
    if (!enabled) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => focusableElements(root.current);
    focusable()[0]?.focus();
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (!root.current?.isConnected) return;
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
  }, [enabled, onEscape, root]);
}
