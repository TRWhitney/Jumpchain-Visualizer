import { type ReactNode, useRef } from "react";
import { handleRovingTabKeyDown } from "./rovingTabs";
import { useFocusTrap } from "./useFocusTrap";

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
  const ids = labels.map((item) => item.id);
  return (
    <div
      className={className}
      role="tablist"
      aria-label={label}
      onKeyDown={(event) => handleRovingTabKeyDown(event, ids, value, onChange)}
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
  useFocusTrap(layer, !embedded, onClose);
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
