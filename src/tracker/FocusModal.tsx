import { useCallback, useRef, type ReactNode } from "react";
import { useFocusTrap } from "../ui";

const modalFocusableSelector = 'button:not([disabled]), [tabindex="0"]';

export function FocusModal({
  label,
  className,
  onClose,
  applicationOverlay = false,
  inactive = false,
  children,
}: {
  label: string;
  className: string;
  onClose: () => void;
  applicationOverlay?: boolean;
  inactive?: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const isTopmostDialog = useCallback((layer: HTMLElement) => {
    const dialogs = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="dialog"][aria-modal="true"]',
      ),
    ];
    return dialogs.at(-1) === layer.querySelector('[role="dialog"]');
  }, []);
  useFocusTrap(root, true, onClose, {
    selector: modalFocusableSelector,
    isActive: isTopmostDialog,
  });
  const dialogClass =
    className === "record-detail-layer"
      ? "record-detail-dialog"
      : className === "companion-profile-layer"
        ? "companion-profile-dialog"
        : "tracker-impact-dialog";
  return (
    <div
      ref={root}
      className={`${className}${applicationOverlay ? " app-settings-layer is-overlay tracker-dialog-application-layer" : ""}`}
      inert={inactive || undefined}
      aria-hidden={inactive || undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={dialogClass}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </section>
    </div>
  );
}
