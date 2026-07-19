import type { CSSProperties } from "react";
import type { TagDefinition } from "../tracker/model";
import {
  adaptTagTextToSurfaces,
  presentationForTagDefinition,
  readableTagText,
} from "./tagProfile";

type CanonicalPresentation = NonNullable<TagDefinition["presentation"]>;

export function CanonicalTagBadge({
  label,
  presentation,
  surface,
  title,
}: {
  label: string;
  presentation: CanonicalPresentation;
  surface?: string;
  title?: string;
}) {
  const transparent = presentation.background === "transparent";
  const background = transparent
    ? "transparent"
    : presentation.background === "gradient"
      ? `linear-gradient(${presentation.angle}deg, ${presentation.colors.map((color, index) => `${color} ${presentation.positions[index]}%`).join(", ")})`
      : presentation.colors[0];
  const textForSurfaces = (surfaces: readonly string[]) =>
    presentation.textMode === "custom"
      ? adaptTagTextToSurfaces(presentation.textColor, surfaces)
      : readableTagText(surfaces);
  const renderedText = transparent
    ? surface
      ? textForSurfaces([surface])
      : "var(--tag-adaptive-text, var(--tag-text-on-dark))"
    : presentation.textMode === "custom"
      ? presentation.textColor
      : readableTagText(presentation.colors);
  return (
    <span
      className={`tag-profile-badge effect-${presentation.textEffect} animation-${presentation.animation}`}
      title={title}
      style={
        {
          background,
          color: renderedText,
          ...(transparent && !surface
            ? {
                "--tag-text-on-light": textForSurfaces([
                  "#ffffff",
                  "#f6f5f1",
                  "#f3f1eb",
                ]),
                "--tag-text-on-dark": textForSurfaces([
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
    </span>
  );
}

export function CanonicalTrackerTagBadge({
  tag,
  surface,
}: {
  tag: TagDefinition;
  surface?: string;
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
    />
  );
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
