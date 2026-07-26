import type { ReactNode } from "react";
import { Chevron } from "./Chevron";

export function DisclosureSection({
  className,
  open,
  label,
  children,
  onToggle,
  dataDisclosureSection,
  dataAppearanceGroup,
}: {
  className?: string;
  open: boolean;
  label: ReactNode;
  children: ReactNode;
  onToggle: (open: boolean) => void;
  dataDisclosureSection?: string;
  dataAppearanceGroup?: string;
}) {
  return (
    <details
      className={className}
      data-disclosure-section={dataDisclosureSection}
      data-appearance-group={dataAppearanceGroup}
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary>
        <Chevron direction={open ? "down" : "right"} />
        <span>{label}</span>
      </summary>
      {children}
    </details>
  );
}
