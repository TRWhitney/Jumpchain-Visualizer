import {
  createContext,
  useContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

export type ContextMenuAction = {
  id: string;
  label: string;
  onAction: () => void;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
};

export type ContextMenuRequest = {
  label: string;
  actions: readonly ContextMenuAction[];
};

export type ContextMenuController = {
  openContextMenu: (
    event: ReactMouseEvent<Element>,
    request: ContextMenuRequest,
  ) => void;
  openContextMenuFromKeyboard: (
    event: ReactKeyboardEvent<HTMLElement>,
    request: ContextMenuRequest,
  ) => void;
};

function selectionContains(target: Node) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0)
    return false;
  return selection.containsNode(target, true);
}

export function allowsNativeContextMenu(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const formControl = target.closest("input, select");
  if (formControl instanceof HTMLInputElement) {
    if (
      ["email", "number", "password", "search", "tel", "text", "url"].includes(
        formControl.type,
      )
    )
      return true;
    return !formControl.closest(
      "[data-context-menu-suppress-noneditable-controls]",
    );
  }
  if (formControl instanceof HTMLSelectElement)
    return !formControl.closest(
      "[data-context-menu-suppress-noneditable-controls]",
    );
  if (
    target.closest(
      'textarea, [contenteditable="true"], a[href], img, video, audio, [data-native-context-menu="true"], .cm-editor, .cm-content',
    )
  )
    return true;
  return selectionContains(target);
}

export function isContextMenuKey(event: ReactKeyboardEvent<HTMLElement>) {
  return event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
}

const fallbackController: ContextMenuController = {
  openContextMenu: (event) => event.preventDefault(),
  openContextMenuFromKeyboard: (event) => {
    if (isContextMenuKey(event)) event.preventDefault();
  },
};

export const ContextMenuContext =
  createContext<ContextMenuController>(fallbackController);

export function useContextMenu() {
  return useContext(ContextMenuContext);
}
