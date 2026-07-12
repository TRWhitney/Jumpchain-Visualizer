import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";

export function Tabs<T extends string>({
  labels,
  value,
  onChange,
  className,
  label,
}: {
  labels: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className: string;
  label: string;
}) {
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = labels.findIndex((item) => item.id === value);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % labels.length;
    else if (event.key === "ArrowLeft")
      next = (current - 1 + labels.length) % labels.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = labels.length - 1;
    else return;
    event.preventDefault();
    onChange(labels[next].id);
    requestAnimationFrame(() =>
      (event.currentTarget.children[next] as HTMLElement | undefined)?.focus(),
    );
  };
  return (
    <div
      className={className}
      role="tablist"
      aria-label={label}
      onKeyDown={keyDown}
    >
      {labels.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          tabIndex={item.id === value ? 0 : -1}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  title,
  kicker,
  className,
  onClose,
  embedded = false,
  children,
}: {
  title: string;
  kicker: string;
  className: string;
  onClose: () => void;
  embedded?: boolean;
  children: ReactNode;
}) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (embedded) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = layer.current;
    const focusable = () => [
      ...(root?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []),
    ];
    focusable()[0]?.focus();
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (!root?.isConnected) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
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
  }, [embedded, onClose]);
  if (embedded)
    return (
      <section
        className={`${className} embedded-supplement-dialog`}
        aria-label={title}
      >
        <header>
          <div>
            <p>{kicker}</p>
            <h4>{title}</h4>
          </div>
        </header>
        {children}
      </section>
    );
  return (
    <div ref={layer} className="review-modal-layer">
      <section
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <p>{kicker}</p>
            <h4>{title}</h4>
          </div>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function Stepper({
  name,
  value,
  min = 0,
  max = 4,
  onChange,
}: {
  name: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="bodymod-rank-control">
      <button
        type="button"
        aria-label={`Reduce ${name}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output>{value}</output>
      <button
        type="button"
        aria-label={`Increase ${name}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
