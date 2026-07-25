import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  allowsNativeContextMenu,
  ContextMenuContext,
  isContextMenuKey,
  type ContextMenuRequest,
} from "./contextMenuModel";
import "./context-menu.css";

type OpenMenu = {
  request: ContextMenuRequest;
  trigger: HTMLElement;
  x: number;
  y: number;
};

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openAt = useCallback(
    (
      trigger: HTMLElement,
      request: ContextMenuRequest,
      x: number,
      y: number,
    ) => {
      if (!request.actions.length) return;
      setPosition(null);
      setOpenMenu({ request, trigger, x, y });
    },
    [],
  );

  const openContextMenu = useCallback(
    (event: ReactMouseEvent<Element>, request: ContextMenuRequest) => {
      if (allowsNativeContextMenu(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      if (!(event.currentTarget instanceof HTMLElement)) return;
      openAt(event.currentTarget, request, event.clientX, event.clientY);
    },
    [openAt],
  );

  const openContextMenuFromKeyboard = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>, request: ContextMenuRequest) => {
      if (!isContextMenuKey(event) || allowsNativeContextMenu(event.target))
        return;
      event.preventDefault();
      event.stopPropagation();
      const bounds = event.currentTarget.getBoundingClientRect();
      const rtl = document.documentElement.dir === "rtl";
      openAt(
        event.currentTarget,
        request,
        rtl ? bounds.right : bounds.left,
        bounds.bottom,
      );
    },
    [openAt],
  );

  const close = useCallback((restoreFocus = true) => {
    setOpenMenu((current) => {
      if (restoreFocus && current) {
        const trigger = current.trigger;
        requestAnimationFrame(() => {
          if (
            trigger.isConnected &&
            (document.activeElement === document.body ||
              document.activeElement === null)
          )
            trigger.focus();
        });
      }
      return null;
    });
    setPosition(null);
  }, []);

  useLayoutEffect(() => {
    if (!openMenu || !menuRef.current) return;
    const margin = 8;
    const bounds = menuRef.current.getBoundingClientRect();
    setPosition({
      left: Math.max(
        margin,
        Math.min(openMenu.x, window.innerWidth - bounds.width - margin),
      ),
      top: Math.max(
        margin,
        Math.min(openMenu.y, window.innerHeight - bounds.height - margin),
      ),
    });
  }, [openMenu]);

  useEffect(() => {
    if (!openMenu || !position) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [openMenu, position]);

  useEffect(() => {
    if (!openMenu) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      )
        close(false);
    };
    const closeWindow = () => close(false);
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("blur", closeWindow);
    window.addEventListener("resize", closeWindow);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("blur", closeWindow);
      window.removeEventListener("resize", closeWindow);
    };
  }, [close, openMenu]);

  useEffect(() => {
    const suppressUnhandled = (event: MouseEvent) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        !scopeRef.current?.contains(target) ||
        allowsNativeContextMenu(target)
      )
        return;
      event.preventDefault();
    };
    document.addEventListener("contextmenu", suppressUnhandled, true);
    return () =>
      document.removeEventListener("contextmenu", suppressUnhandled, true);
  }, []);

  const controller = useMemo(
    () => ({ openContextMenu, openContextMenuFromKeyboard }),
    [openContextMenu, openContextMenuFromKeyboard],
  );

  const moveFocus = (direction: 1 | -1 | "first" | "last") => {
    const items = [
      ...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
        []),
    ];
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      direction === "first"
        ? 0
        : direction === "last"
          ? items.length - 1
          : (Math.max(0, current) + direction + items.length) % items.length;
    items[next].focus();
  };

  return (
    <ContextMenuContext.Provider value={controller}>
      <div
        ref={scopeRef}
        className="app-context-menu-scope"
        onContextMenu={(event) => {
          if (event.defaultPrevented || allowsNativeContextMenu(event.target)) {
            if (!event.defaultPrevented) close(false);
            return;
          }
          event.preventDefault();
          close(false);
        }}
      >
        {children}
      </div>
      {openMenu &&
        createPortal(
          <div
            ref={menuRef}
            className="app-context-menu"
            role="menu"
            aria-label={openMenu.request.label}
            style={{
              left: position?.left ?? openMenu.x,
              top: position?.top ?? openMenu.y,
              visibility: position ? "visible" : "hidden",
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveFocus(1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                moveFocus(-1);
              } else if (event.key === "Home") {
                event.preventDefault();
                moveFocus("first");
              } else if (event.key === "End") {
                event.preventDefault();
                moveFocus("last");
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
              } else if (event.key === "Tab") {
                close(false);
              }
            }}
          >
            {openMenu.request.actions.map((action) => (
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                key={action.id}
                aria-disabled={action.disabled || undefined}
                className={`${action.danger ? "is-danger" : ""}${
                  action.separatorBefore ? " has-separator" : ""
                }`}
                onClick={(event) => {
                  if (action.disabled) {
                    event.preventDefault();
                    return;
                  }
                  close();
                  action.onAction();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </ContextMenuContext.Provider>
  );
}
