export function Chevron({
  direction = "right",
  className,
}: {
  direction?: "up" | "right" | "down" | "left";
  className?: string;
}) {
  const rotation = { right: 0, down: 90, left: 180, up: 270 }[direction];
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 8 12"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path d="m2 2 4 4-4 4" />
    </svg>
  );
}
