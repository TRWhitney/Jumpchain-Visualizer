import type { InstalledPackage, TagDefinition } from "../tracker/model";
import {
  builtinTagPresetById,
  builtinTagPresets,
  primaryTagIds,
} from "./builtinTags";
import { shiftInheritedTagColor } from "./tagColor";

export type TagSource = "builtin" | "acquired" | "manual" | "imported";
export type AppearanceSource = "builtin" | "derived" | "custom";
export type TagPresentation = {
  background: "solid" | "gradient" | "transparent";
  colors: string[];
  positions: number[];
  angle: number;
  borderColor: string;
  borderWidth: "none" | "thin" | "medium";
  corners: "pill" | "rounded" | "square";
  padding: "compact" | "standard" | "roomy";
  textMode: "auto" | "custom";
  textColor: string;
  weight: "normal" | "medium" | "bold";
  fontStyle: "normal" | "italic";
  decoration: "none" | "underline" | "strike";
  textEffect: "none" | "outline" | "shadow" | "glow";
  animation: "none" | "rainbow" | "marquee" | "ghost" | "bounce";
};

export type TagProfileEntry = {
  id: string;
  name: string;
  source: TagSource;
  parent: string | null;
  aliases: string[];
  appearanceSource: AppearanceSource;
  presentation: TagPresentation;
};

export type TagProfile = {
  schemaVersion: 1;
  tags: Record<string, TagProfileEntry>;
};

export const builtinTagIds = builtinTagPresets.map((preset) => preset.id);
const validHex = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export function normalizeTag(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\s_\p{Pd}]+/gu, " ")
    .trim()
    .toLocaleLowerCase();
}

const particles = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "via",
  "vs",
]);

export function tagDisplayName(value: string) {
  return normalizeTag(value)
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      particles.has(word)
        ? word
        : `${word[0]?.toLocaleUpperCase() ?? ""}${word.slice(1)}`,
    )
    .join(" ");
}

const rgb = (hex: string) =>
  [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
const hex = (channels: number[]) =>
  `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
export const mixHex = (first: string, second: string, weight = 0.3) =>
  hex(
    rgb(first).map(
      (value, index) => value + (rgb(second)[index] - value) * weight,
    ),
  );

const relativeLuminance = (color: string) =>
  rgb(color)
    .map((channel) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    })
    .reduce(
      (total, channel, index) =>
        total + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );

export const tagTextContrast = (text: string, background: string) => {
  const values = [relativeLuminance(text), relativeLuminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
};

export const readableTagText = (backgrounds: readonly string[]) =>
  ["#ffffff", "#111111"]
    .map((color) => ({
      color,
      minimum: Math.min(
        ...backgrounds.map((background) => tagTextContrast(color, background)),
      ),
    }))
    .sort((first, second) => second.minimum - first.minimum)[0].color;

export function presentationForTagDefinition(
  color: string,
  to: string,
  style: TagDefinition["style"],
): TagPresentation {
  return {
    background:
      style === "outline"
        ? "transparent"
        : style === "gradient"
          ? "gradient"
          : "solid",
    colors: [color, to, mixHex(color, "#ffffff", 0.16)],
    positions: [0, 50, 100],
    angle: 120,
    borderColor: color,
    borderWidth: style === "outline" ? "medium" : "thin",
    corners: "pill",
    padding: "compact",
    textMode: "auto",
    textColor: "#ffffff",
    weight: "bold",
    fontStyle: "normal",
    decoration: "none",
    textEffect: "none",
    animation: "none",
  };
}

const clone = <T>(value: T): T => structuredClone(value);

export function createDefaultTagProfile(): TagProfile {
  return {
    schemaVersion: 1,
    tags: Object.fromEntries(
      builtinTagPresets.map((preset) => {
        return [
          preset.id,
          {
            id: preset.id,
            name: preset.label,
            source: "builtin" as const,
            parent: preset.parent,
            aliases: [...preset.aliases],
            appearanceSource: "builtin" as const,
            presentation: presentationForTagDefinition(
              preset.color,
              preset.to,
              preset.style,
            ),
          },
        ];
      }),
    ),
  };
}

function derivedPresentation(
  profile: TagProfile,
  name: string,
  parentId: string | null,
) {
  const parent =
    profile.tags[parentId ?? "miscellaneous"] ?? profile.tags.miscellaneous;
  const presentation = clone(parent.presentation);
  presentation.colors = presentation.colors.map((color, index) =>
    shiftInheritedTagColor(color, name, index),
  );
  presentation.borderColor = shiftInheritedTagColor(
    presentation.borderColor,
    name,
    31,
  );
  return presentation;
}

export type InstalledTagCandidate = {
  name: string;
  packageNames: readonly string[];
};

export function installedTagCandidates(
  profile: TagProfile,
  packages: readonly InstalledPackage[],
) {
  const known = new Set(
    Object.values(profile.tags).flatMap((tag) =>
      [tag.name, ...tag.aliases].map(normalizeTag),
    ),
  );
  const detected = new Map<
    string,
    { name: string; packageNames: Set<string> }
  >();
  for (const packageItem of packages) {
    for (const rawTag of packageItem.tags) {
      const normalized = normalizeTag(rawTag);
      if (!normalized || known.has(normalized)) continue;
      const displayName = tagDisplayName(rawTag);
      if ([...displayName].length > 120 || detected.size >= 5_000) continue;
      const candidate = detected.get(normalized) ?? {
        name: displayName,
        packageNames: new Set<string>(),
      };
      candidate.packageNames.add(packageItem.name);
      detected.set(normalized, candidate);
    }
  }
  return [...detected.values()]
    .map(({ name, packageNames }) => ({
      name,
      packageNames: [...packageNames].sort(),
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

export function refreshInstalledTags(
  profile: TagProfile,
  packages: readonly InstalledPackage[],
) {
  let next = profile;
  const candidates = installedTagCandidates(profile, packages);
  for (const candidate of candidates)
    next = addTag(next, candidate.name, "acquired").profile;
  return { profile: next, added: candidates };
}

function validPresentation(value: unknown, fallback: TagPresentation) {
  if (typeof value !== "object" || value === null) return clone(fallback);
  const candidate = value as Partial<TagPresentation>;
  const colors =
    Array.isArray(candidate.colors) &&
    candidate.colors.length >= 2 &&
    candidate.colors.length <= 6 &&
    candidate.colors.every(validHex)
      ? candidate.colors.map((color) => color.toLowerCase())
      : fallback.colors;
  const positions =
    Array.isArray(candidate.positions) &&
    candidate.positions.length === colors.length &&
    candidate.positions.every((position) => typeof position === "number") &&
    candidate.positions[0] === 0 &&
    candidate.positions.at(-1) === 100 &&
    candidate.positions.every(
      (position, index) =>
        index === 0 || position > candidate.positions![index - 1],
    )
      ? [...candidate.positions]
      : fallback.positions;
  const allowed = <T extends string>(
    input: unknown,
    values: readonly T[],
    defaultValue: T,
  ) =>
    typeof input === "string" && values.includes(input as T)
      ? (input as T)
      : defaultValue;
  return {
    background: allowed(
      candidate.background,
      ["solid", "gradient", "transparent"],
      fallback.background,
    ),
    colors,
    positions,
    angle:
      typeof candidate.angle === "number" &&
      candidate.angle >= 0 &&
      candidate.angle <= 360
        ? candidate.angle
        : fallback.angle,
    borderColor: validHex(candidate.borderColor)
      ? candidate.borderColor.toLowerCase()
      : fallback.borderColor,
    borderWidth: allowed(
      candidate.borderWidth,
      ["none", "thin", "medium"],
      fallback.borderWidth,
    ),
    corners: allowed(
      candidate.corners,
      ["pill", "rounded", "square"],
      fallback.corners,
    ),
    padding: allowed(
      candidate.padding,
      ["compact", "standard", "roomy"],
      fallback.padding,
    ),
    textMode: allowed(
      candidate.textMode,
      ["auto", "custom"],
      fallback.textMode,
    ),
    textColor: validHex(candidate.textColor)
      ? candidate.textColor.toLowerCase()
      : fallback.textColor,
    weight: allowed(
      candidate.weight,
      ["normal", "medium", "bold"],
      fallback.weight,
    ),
    fontStyle: allowed(
      candidate.fontStyle,
      ["normal", "italic"],
      fallback.fontStyle,
    ),
    decoration: allowed(
      candidate.decoration,
      ["none", "underline", "strike"],
      fallback.decoration,
    ),
    textEffect: allowed(
      candidate.textEffect,
      ["none", "outline", "shadow", "glow"],
      fallback.textEffect,
    ),
    animation: allowed(
      candidate.animation,
      ["none", "rainbow", "marquee", "ghost", "bounce"],
      fallback.animation,
    ),
  } satisfies TagPresentation;
}

export function wouldCreateParentCycle(
  profile: TagProfile,
  childId: string,
  parentId: string,
) {
  let current: string | null = parentId;
  const visited = new Set<string>();
  while (current) {
    if (current === childId || visited.has(current)) return true;
    visited.add(current);
    current = profile.tags[current]?.parent ?? null;
  }
  return false;
}

export function hydrateTagProfile(
  value: unknown,
  fallback: TagProfile,
): TagProfile {
  if (typeof value !== "object" || value === null) return clone(fallback);
  const raw = value as { schemaVersion?: unknown; tags?: unknown };
  if (
    raw.schemaVersion !== 1 ||
    typeof raw.tags !== "object" ||
    raw.tags === null
  )
    return clone(fallback);
  const profile = createDefaultTagProfile();
  for (const [rawId, rawEntry] of Object.entries(raw.tags)) {
    if (typeof rawEntry !== "object" || rawEntry === null) continue;
    const input = rawEntry as Partial<TagProfileEntry>;
    if (typeof input.name !== "string" || !normalizeTag(input.name)) continue;
    const id = normalizeTag(rawId).replaceAll(" ", "-");
    const existing = profile.tags[id];
    const source: TagSource = existing
      ? "builtin"
      : ["acquired", "manual", "imported"].includes(String(input.source))
        ? (input.source as TagSource)
        : "imported";
    const parent = primaryTagIds.has(id)
      ? null
      : typeof input.parent === "string"
        ? input.parent
        : (existing?.parent ?? "miscellaneous");
    const base =
      existing?.presentation ??
      derivedPresentation(profile, input.name, parent);
    profile.tags[id] = {
      id,
      name: tagDisplayName(input.name),
      source,
      parent,
      aliases: Array.isArray(input.aliases)
        ? input.aliases
            .slice(0, 100)
            .filter((alias): alias is string => typeof alias === "string")
            .filter((alias) => [...alias].length <= 120)
            .map(tagDisplayName)
        : (existing?.aliases ?? []),
      appearanceSource:
        source === "builtin"
          ? input.appearanceSource === "custom"
            ? "custom"
            : "builtin"
          : ["derived", "custom"].includes(String(input.appearanceSource))
            ? (input.appearanceSource as AppearanceSource)
            : "derived",
      presentation:
        source === "builtin" && input.appearanceSource !== "custom"
          ? base
          : validPresentation(input.presentation, base),
    };
  }
  for (const tag of Object.values(profile.tags)) {
    if (
      !primaryTagIds.has(tag.id) &&
      (!tag.parent ||
        !profile.tags[tag.parent] ||
        wouldCreateParentCycle(profile, tag.id, tag.parent))
    )
      tag.parent = builtinTagPresetById[tag.id]?.parent ?? "miscellaneous";
    const aliases = new Map<string, string>();
    for (const alias of tag.aliases) {
      const display = tagDisplayName(alias);
      const normalized = normalizeTag(display);
      if (
        display &&
        normalized !== normalizeTag(tag.name) &&
        !aliases.has(normalized)
      )
        aliases.set(normalized, display);
    }
    tag.aliases = [...aliases.values()];
    if (tag.appearanceSource === "derived")
      tag.presentation = derivedPresentation(profile, tag.name, tag.parent);
  }
  return profile;
}

export function addTag(
  profile: TagProfile,
  name: string,
  source: "manual" | "acquired" | "imported",
) {
  const display = tagDisplayName(name);
  if (!display) return { profile, error: "Enter a non-empty tag string." };
  if ([...display].length > 120)
    return { profile, error: "Tag strings are limited to 120 characters." };
  const existing = Object.values(profile.tags).find(
    (tag) =>
      normalizeTag(tag.name) === normalizeTag(display) ||
      tag.aliases.some(
        (alias) => normalizeTag(alias) === normalizeTag(display),
      ),
  );
  if (existing)
    return {
      profile,
      selectedId: existing.id,
      error: `${display} is already in this profile.`,
    };
  const idBase = normalizeTag(display).replaceAll(" ", "-");
  let id = idBase;
  let serial = 2;
  while (profile.tags[id]) id = `${idBase}-${serial++}`;
  const next = clone(profile);
  next.tags[id] = {
    id,
    name: display,
    source,
    parent: "miscellaneous",
    aliases: [],
    appearanceSource: "derived",
    presentation: derivedPresentation(next, display, "miscellaneous"),
  };
  return { profile: next, selectedId: id };
}

export function setTagParent(
  profile: TagProfile,
  tagId: string,
  parentId: string,
) {
  const tag = profile.tags[tagId];
  const parent = profile.tags[parentId];
  if (
    !tag ||
    !parent ||
    primaryTagIds.has(tagId) ||
    wouldCreateParentCycle(profile, tagId, parentId)
  )
    return {
      profile,
      error: "That parent would create an invalid relationship.",
    };
  if (
    tag.aliases.some(
      (alias) => normalizeTag(alias) === normalizeTag(parent.name),
    )
  )
    return { profile, error: "Aliases cannot also be parent and child." };
  const next = clone(profile);
  next.tags[tagId].parent = parentId;
  if (next.tags[tagId].appearanceSource === "derived")
    next.tags[tagId].presentation = derivedPresentation(
      next,
      tag.name,
      parentId,
    );
  refreshDerived(next, tagId);
  return { profile: next };
}

function refreshDerived(
  profile: TagProfile,
  parentId: string,
  visited = new Set<string>(),
) {
  if (visited.has(parentId)) return;
  visited.add(parentId);
  for (const child of Object.values(profile.tags).filter(
    (tag) => tag.parent === parentId,
  )) {
    if (child.appearanceSource === "derived")
      child.presentation = derivedPresentation(profile, child.name, parentId);
    refreshDerived(profile, child.id, visited);
  }
}

export function toggleAlias(
  profile: TagProfile,
  firstId: string,
  secondId: string,
) {
  const first = profile.tags[firstId];
  const second = profile.tags[secondId];
  if (
    !first ||
    !second ||
    firstId === secondId ||
    first.parent === secondId ||
    second.parent === firstId
  )
    return {
      profile,
      error: "Aliases cannot be self-links or parent relationships.",
    };
  const next = clone(profile);
  const linked = first.aliases.some(
    (alias) => normalizeTag(alias) === normalizeTag(second.name),
  );
  next.tags[firstId].aliases = linked
    ? next.tags[firstId].aliases.filter(
        (alias) => normalizeTag(alias) !== normalizeTag(second.name),
      )
    : [...next.tags[firstId].aliases, second.name];
  next.tags[secondId].aliases = linked
    ? next.tags[secondId].aliases.filter(
        (alias) => normalizeTag(alias) !== normalizeTag(first.name),
      )
    : [...next.tags[secondId].aliases, first.name];
  return { profile: next };
}

export function removeAlias(profile: TagProfile, tagId: string, alias: string) {
  const tag = profile.tags[tagId];
  if (!tag) return profile;
  const next = clone(profile);
  next.tags[tagId].aliases = next.tags[tagId].aliases.filter(
    (candidate) => normalizeTag(candidate) !== normalizeTag(alias),
  );
  const reciprocal = Object.values(next.tags).find(
    (candidate) => normalizeTag(candidate.name) === normalizeTag(alias),
  );
  if (reciprocal)
    reciprocal.aliases = reciprocal.aliases.filter(
      (candidate) => normalizeTag(candidate) !== normalizeTag(tag.name),
    );
  return next;
}

export function updateTagPresentation(
  profile: TagProfile,
  tagId: string,
  patch: Partial<TagPresentation>,
) {
  const tag = profile.tags[tagId];
  if (!tag) return profile;
  const next = clone(profile);
  next.tags[tagId].presentation = validPresentation(
    { ...next.tags[tagId].presentation, ...patch },
    next.tags[tagId].presentation,
  );
  next.tags[tagId].appearanceSource = "custom";
  refreshDerived(next, tagId);
  return next;
}

export function resetTag(profile: TagProfile, tagId: string) {
  const tag = profile.tags[tagId];
  if (!tag) return profile;
  const next = clone(profile);
  if (tag.source === "builtin") {
    const data = builtinTagPresetById[tagId];
    if (!data) return profile;
    next.tags[tagId].presentation = presentationForTagDefinition(
      data.color,
      data.to,
      data.style,
    );
    next.tags[tagId].appearanceSource = "builtin";
  } else {
    next.tags[tagId].presentation = derivedPresentation(
      next,
      tag.name,
      tag.parent,
    );
    next.tags[tagId].appearanceSource = "derived";
  }
  refreshDerived(next, tagId);
  return next;
}

export function deleteTag(profile: TagProfile, tagId: string) {
  const tag = profile.tags[tagId];
  if (!tag || !["manual", "imported"].includes(tag.source)) return profile;
  const next = clone(profile);
  const replacement = tag.parent ?? "miscellaneous";
  delete next.tags[tagId];
  for (const candidate of Object.values(next.tags)) {
    candidate.aliases = candidate.aliases.filter(
      (alias) => normalizeTag(alias) !== normalizeTag(tag.name),
    );
    if (candidate.parent === tagId) candidate.parent = replacement;
  }
  refreshDerived(next, replacement);
  return next;
}

export function exportTagProfile(profile: TagProfile) {
  const aliasLinks: { tags: [string, string] }[] = [];
  const seen = new Set<string>();
  for (const tag of Object.values(profile.tags)) {
    for (const alias of tag.aliases) {
      if (
        !Object.values(profile.tags).some(
          (candidate) => normalizeTag(candidate.name) === normalizeTag(alias),
        )
      )
        continue;
      const pair = [tag.name, alias].sort((a, b) =>
        normalizeTag(a).localeCompare(normalizeTag(b)),
      ) as [string, string];
      const key = pair.map(normalizeTag).join("\0");
      if (!seen.has(key)) {
        seen.add(key);
        aliasLinks.push({ tags: pair });
      }
    }
  }
  const tags = Object.values(profile.tags).map((tag) => ({
    name: tag.name,
    source: tag.source,
    parent: tag.parent,
    aliases: tag.aliases.filter(
      (alias) =>
        !Object.values(profile.tags).some(
          (candidate) => normalizeTag(candidate.name) === normalizeTag(alias),
        ),
    ),
    appearanceSource: tag.appearanceSource,
    presentation: tag.presentation,
  }));
  return JSON.stringify(
    {
      schemaVersion: 1,
      tags,
      aliasLinks,
    },
    null,
    2,
  );
}

export function importTagProfile(
  profile: TagProfile,
  json: string,
  mode: "merge" | "replace",
) {
  if (new TextEncoder().encode(json).byteLength > 2 * 1024 * 1024)
    return { profile, error: "Import exceeds the 2 MiB profile limit." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { profile, error: "Import is not valid JSON." };
  }
  if (typeof parsed !== "object" || parsed === null)
    return { profile, error: "Expected a tag profile object." };
  const document = parsed as {
    schemaVersion?: unknown;
    tags?: unknown;
    aliasLinks?: unknown;
  };
  if (
    Object.keys(document).some(
      (key) => !["schemaVersion", "tags", "aliasLinks"].includes(key),
    )
  )
    return { profile, error: "Import contains unsupported document fields." };
  if (document.schemaVersion !== 1 || !Array.isArray(document.tags))
    return { profile, error: "Expected schemaVersion 1 with a tags array." };
  if (document.tags.length > 5_000)
    return { profile, error: "Import contains too many tag entries." };
  let next = mode === "replace" ? createDefaultTagProfile() : clone(profile);
  if (mode === "replace") {
    for (const tag of Object.values(profile.tags).filter(
      (entry) => entry.source === "acquired",
    ))
      next.tags[tag.id] = {
        ...clone(tag),
        aliases: [],
        appearanceSource: "derived",
        presentation: derivedPresentation(next, tag.name, tag.parent),
      };
  }
  const importedIds = new Set<string>();
  for (const raw of document.tags) {
    if (
      typeof raw !== "object" ||
      raw === null ||
      typeof (raw as { name?: unknown }).name !== "string"
    )
      return { profile, error: "Every imported tag needs a non-empty name." };
    const input = raw as Partial<TagProfileEntry>;
    if (
      Object.keys(input).some(
        (key) =>
          ![
            "name",
            "source",
            "parent",
            "aliases",
            "appearanceSource",
            "presentation",
          ].includes(key),
      )
    )
      return { profile, error: "An imported tag contains unsupported fields." };
    if (
      input.presentation &&
      (typeof input.presentation !== "object" ||
        Object.keys(input.presentation).some(
          (key) =>
            ![
              "background",
              "colors",
              "positions",
              "angle",
              "borderColor",
              "borderWidth",
              "corners",
              "padding",
              "textMode",
              "textColor",
              "weight",
              "fontStyle",
              "decoration",
              "textEffect",
              "animation",
            ].includes(key),
        ))
    )
      return {
        profile,
        error: "An imported presentation contains unsupported fields.",
      };
    if (
      input.aliases !== undefined &&
      (!Array.isArray(input.aliases) ||
        input.aliases.length > 100 ||
        input.aliases.some(
          (alias) => typeof alias !== "string" || [...alias].length > 120,
        ))
    )
      return {
        profile,
        error: "Imported aliases must be bounded tag strings.",
      };
    const name = tagDisplayName(input.name!);
    if (!name || [...name].length > 120)
      return { profile, error: "Every imported tag needs a non-empty name." };
    const duplicateKey = normalizeTag(name);
    if (importedIds.has(duplicateKey))
      return { profile, error: `Duplicate imported tag: ${name}.` };
    importedIds.add(duplicateKey);
    const existing = Object.values(next.tags).find(
      (tag) => normalizeTag(tag.name) === duplicateKey,
    );
    const id = existing?.id ?? duplicateKey.replaceAll(" ", "-");
    const parent = primaryTagIds.has(id)
      ? null
      : typeof input.parent === "string"
        ? input.parent
        : (existing?.parent ?? "miscellaneous");
    const base =
      existing?.presentation ?? derivedPresentation(next, name, parent);
    next.tags[id] = {
      id,
      name: existing?.name ?? name,
      source: existing?.source ?? "imported",
      parent,
      aliases: Array.isArray(input.aliases)
        ? input.aliases
            .filter((alias): alias is string => typeof alias === "string")
            .map(tagDisplayName)
        : (existing?.aliases ?? []),
      appearanceSource:
        existing?.source === "builtin"
          ? input.appearanceSource === "custom"
            ? "custom"
            : "builtin"
          : input.appearanceSource === "derived"
            ? "derived"
            : "custom",
      presentation: validPresentation(input.presentation, base),
    };
  }
  for (const tag of Object.values(next.tags)) {
    if (tag.parent && !next.tags[tag.parent]) {
      const resolved = Object.values(next.tags).find(
        (candidate) =>
          normalizeTag(candidate.name) === normalizeTag(tag.parent!),
      );
      if (resolved) tag.parent = resolved.id;
    }
    if (tag.parent && !next.tags[tag.parent])
      return {
        profile,
        error: `Unknown parent “${tag.parent}” for ${tag.name}.`,
      };
    if (tag.parent && wouldCreateParentCycle(next, tag.id, tag.parent))
      return { profile, error: `Parent cycle involving ${tag.name}.` };
  }
  if (document.aliasLinks !== undefined && !Array.isArray(document.aliasLinks))
    return { profile, error: "aliasLinks must be an array." };
  if (Array.isArray(document.aliasLinks) && document.aliasLinks.length > 10_000)
    return { profile, error: "Import contains too many alias links." };
  for (const link of Array.isArray(document.aliasLinks)
    ? document.aliasLinks
    : []) {
    if (
      typeof link !== "object" ||
      link === null ||
      Object.keys(link).some((key) => key !== "tags") ||
      !Array.isArray((link as { tags?: unknown }).tags) ||
      (link as { tags: unknown[] }).tags.length !== 2
    )
      return {
        profile,
        error: "Every alias link must contain exactly two tag strings.",
      };
    const names = (link as { tags: unknown[] }).tags;
    if (!names.every((name) => typeof name === "string"))
      return { profile, error: "Alias links must use tag strings." };
    const [first, second] = names.map(
      (name) =>
        Object.values(next.tags).find(
          (tag) => normalizeTag(tag.name) === normalizeTag(name as string),
        )?.id,
    );
    if (!first || !second)
      return { profile, error: "Alias link references an unknown tag." };
    const result = toggleAlias(next, first, second);
    if (result.error) return { profile, error: result.error };
    next = result.profile;
  }
  for (const tag of Object.values(next.tags).filter(
    (entry) => entry.appearanceSource === "derived",
  ))
    tag.presentation = derivedPresentation(next, tag.name, tag.parent);
  return { profile: next, importedCount: document.tags.length };
}

export function projectTagDefinitions(
  profile: TagProfile,
): Record<string, TagDefinition> {
  return Object.fromEntries(
    Object.values(profile.tags).map((tag) => [
      tag.id,
      {
        id: tag.id,
        label: tag.name,
        parent: tag.parent ?? undefined,
        aliases: tag.aliases,
        color: tag.presentation.colors[0],
        to: tag.presentation.colors[1] ?? tag.presentation.colors[0],
        style:
          tag.presentation.background === "gradient"
            ? "gradient"
            : tag.presentation.background === "transparent"
              ? "outline"
              : "solid",
        presentation: tag.presentation,
      } satisfies TagDefinition,
    ]),
  );
}
