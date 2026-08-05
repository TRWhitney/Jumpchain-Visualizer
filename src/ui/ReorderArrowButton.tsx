import type { ButtonHTMLAttributes } from "react";

type ReorderArrowButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  "aria-label": string;
  direction: "up" | "down";
  unavailable: boolean;
};

export function ReorderArrowButton({
  direction,
  unavailable,
  disabled,
  style,
  tabIndex,
  type = "button",
  ...props
}: ReorderArrowButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || unavailable}
      aria-hidden={unavailable || undefined}
      tabIndex={unavailable ? -1 : tabIndex}
      style={{
        ...style,
        visibility: unavailable ? "hidden" : style?.visibility,
      }}
    >
      {direction === "up" ? "↑" : "↓"}
    </button>
  );
}
