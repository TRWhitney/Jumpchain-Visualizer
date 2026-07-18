import { useId, type ReactNode } from "react";

export function ConfirmationDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  application = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  application?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const headingId = useId();
  const descriptionId = useId();
  return (
    <div
      className={`story-chapter-confirm-layer${application ? " is-application-confirmation" : ""}`}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
      >
        <h5 id={headingId}>{title}</h5>
        <p id={descriptionId}>{children}</p>
        {error && (
          <p className="confirmation-dialog-error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button autoFocus type="button" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" disabled={busy} onClick={onConfirm}>
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
