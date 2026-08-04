import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  presentationForTagDefinition,
  readableTagText,
  type TagDefinition,
  type TagPresentation,
} from "../domain/tags";
import {
  observeRenderedSurface,
  renderedSurfaceColor,
} from "./renderedSurface";

type CanonicalPresentation = TagPresentation;

export function CanonicalTagBadge({
  label,
  presentation,
  surface,
  title,
  trailingAction,
}: {
  label: string;
  presentation: CanonicalPresentation;
  surface?: string;
  title?: string;
  trailingAction?: ReactNode;
}) {
  const transparent = presentation.background === "transparent";
  const badge = useRef<HTMLSpanElement>(null);
  const [measuredSurface, setMeasuredSurface] = useState<string>();
  const needsRenderedSurface =
    transparent && presentation.textMode === "auto" && !surface;
  useLayoutEffect(() => {
    if (!needsRenderedSurface || !badge.current) {
      setMeasuredSurface(undefined);
      return;
    }
    const element = badge.current;
    const update = () => {
      const next = renderedSurfaceColor(element);
      setMeasuredSurface((current) => (current === next ? current : next));
    };
    update();
    return observeRenderedSurface(element, update);
  }, [needsRenderedSurface]);
  const effectiveSurface = surface ?? measuredSurface;
  const background = transparent
    ? "transparent"
    : presentation.background === "gradient"
      ? `linear-gradient(${presentation.angle}deg, ${presentation.colors.map((color, index) => `${color} ${presentation.positions[index]}%`).join(", ")})`
      : presentation.colors[0];
  const renderedText = transparent
    ? presentation.textMode === "custom"
      ? presentation.textColor
      : effectiveSurface
        ? readableTagText([effectiveSurface])
        : "var(--tag-adaptive-text, var(--tag-text-on-dark))"
    : presentation.textMode === "custom"
      ? presentation.textColor
      : readableTagText(presentation.colors);
  return (
    <span
      ref={badge}
      className={`tag-profile-badge effect-${presentation.textEffect} animation-${presentation.animation}${trailingAction ? " has-trailing-action" : ""}`}
      data-rendered-surface={needsRenderedSurface ? measuredSurface : undefined}
      title={title}
      style={
        {
          background,
          color: renderedText,
          ...(transparent &&
          presentation.textMode === "auto" &&
          !effectiveSurface
            ? {
                "--tag-text-on-light": readableTagText([
                  "#ffffff",
                  "#f6f5f1",
                  "#f3f1eb",
                ]),
                "--tag-text-on-dark": readableTagText([
                  "#171717",
                  "#20201e",
                  "#292927",
                ]),
              }
            : {}),
          borderColor: presentation.borderColor,
          borderWidth:
            presentation.borderWidth === "none"
              ? 0
              : presentation.borderWidth === "thin"
                ? 1
                : 2,
          borderStyle: presentation.borderWidth === "none" ? "none" : "solid",
          borderRadius:
            presentation.corners === "pill"
              ? 999
              : presentation.corners === "rounded"
                ? 5
                : 0,
          padding:
            presentation.padding === "compact"
              ? "0.15rem 0.55rem"
              : presentation.padding === "standard"
                ? "0.3rem 0.7rem"
                : "0.45rem 0.9rem",
          fontWeight:
            presentation.weight === "normal"
              ? 400
              : presentation.weight === "medium"
                ? 600
                : 800,
          fontStyle: presentation.fontStyle,
          textDecoration:
            presentation.decoration === "strike"
              ? "line-through"
              : presentation.decoration,
        } as CSSProperties
      }
    >
      <AnimatedTagText text={label} animation={presentation.animation} />
      {trailingAction}
    </span>
  );
}

export function CanonicalTagDefinitionBadge({
  tag,
  surface,
  trailingAction,
}: {
  tag: TagDefinition;
  surface?: string;
  trailingAction?: ReactNode;
}) {
  return (
    <CanonicalTagBadge
      label={tag.label}
      presentation={
        tag.presentation ??
        presentationForTagDefinition(tag.color, tag.to, tag.style)
      }
      surface={surface}
      title={
        tag.aliases.length ? `Aliases: ${tag.aliases.join(", ")}` : undefined
      }
      trailingAction={trailingAction}
    />
  );
}

export const CanonicalTrackerTagBadge = CanonicalTagDefinitionBadge;

export function TagBadge({ tag }: { tag: TagDefinition }) {
  return <CanonicalTagDefinitionBadge tag={tag} />;
}

function AnimatedTagText({
  text,
  animation,
}: {
  text: string;
  animation: CanonicalPresentation["animation"];
}) {
  return (
    <span className={`tag-animated-text is-${animation}`}>
      {animation === "marquee" || animation === "bounce"
        ? [...text].map((character, index) => (
            <i
              key={`${character}-${index}`}
              style={{ "--letter-index": index } as CSSProperties}
            >
              {character === " " ? "\u00a0" : character}
            </i>
          ))
        : text}
    </span>
  );
}
