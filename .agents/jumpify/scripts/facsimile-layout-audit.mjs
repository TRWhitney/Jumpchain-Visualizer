function verticalOverlapRatio(left, right) {
  const overlap =
    Math.min(left.y + left.height, right.y + right.height) -
    Math.max(left.y, right.y);
  return Math.max(0, overlap) / Math.min(left.height, right.height);
}

export function facsimileSourceRows(ledger) {
  const rowsByRenderIndex = new Map();
  for (const section of ledger.sections ?? []) {
    const unambiguousPages = new Set(
      (ledger.sourcePages ?? [])
        .filter(
          (page) =>
            page.sectionHandles.length === 1 &&
            page.sectionHandles[0] === section.handle,
        )
        .map((page) => page.page),
    );
    const panels = (ledger.entries ?? [])
      .filter(
        (entry) =>
          entry.sourceKind === "choice" &&
          section.sourcePages.includes(entry.page) &&
          unambiguousPages.has(entry.page),
      )
      .flatMap((entry) => {
        const asset = (ledger.assets ?? []).find(
          (candidate) =>
            candidate.package &&
            candidate.kind === "panel" &&
            candidate.page === entry.page &&
            ["x", "y", "width", "height"].every(
              (field) => candidate.rect[field] === entry.rect[field],
            ),
        );
        return asset ? [{ entry, alt: asset.alt }] : [];
      });
    const relationships = panels.flatMap((left, leftIndex) =>
      panels.slice(leftIndex + 1).flatMap((right) => {
        const horizontalOverlap =
          Math.min(
            left.entry.rect.x + left.entry.rect.width,
            right.entry.rect.x + right.entry.rect.width,
          ) - Math.max(left.entry.rect.x, right.entry.rect.x);
        return verticalOverlapRatio(left.entry.rect, right.entry.rect) >= 0.5 &&
          horizontalOverlap <= 1
          ? [{ left: left.alt, right: right.alt }]
          : [];
      }),
    );
    rowsByRenderIndex.set(section.renderIndex, relationships);
  }
  return rowsByRenderIndex;
}

export function facsimileSourceRowMismatches(relationships, imageBounds) {
  return relationships.flatMap((relationship) => {
    const left = imageBounds.find((image) => image.alt === relationship.left);
    const right = imageBounds.find((image) => image.alt === relationship.right);
    if (!left || !right)
      return [
        {
          ...relationship,
          reason: "matching rendered panel image was not found",
        },
      ];
    return verticalOverlapRatio(left.rect, right.rect) < 0.5
      ? [
          {
            ...relationship,
            reason: "source panels share a row but rendered panels stack",
          },
        ]
      : [];
  });
}

/**
 * Reports text-bearing source panels rendered far below their extracted pixel
 * scale. Source pages are normalized at 2x, so 0.25 corresponds to roughly
 * half-size relative to the source document rather than an arbitrary device
 * pixel ratio. This is evidence for decomposition or a documented responsive
 * gap; it does not attempt OCR or claim that every source font has one limit.
 */
export function microscopicTextPanel(
  image,
  minimumScale = 0.25,
  minimumDenseTextLength = 120,
  maximumTinyHeight = 48,
) {
  if (
    !image ||
    ![
      image.naturalWidth,
      image.naturalHeight,
      image.rect?.width,
      image.rect?.height,
    ].every(Number.isFinite) ||
    image.naturalWidth <= 0 ||
    image.naturalHeight <= 0 ||
    image.rect.width <= 0 ||
    image.rect.height <= 0
  )
    return null;
  const scale = Math.min(
    image.rect.width / image.naturalWidth,
    image.rect.height / image.naturalHeight,
  );
  const denseText = (image.alt?.trim().length ?? 0) >= minimumDenseTextLength;
  const physicallyTiny = image.rect.height < maximumTinyHeight;
  return scale < minimumScale && (denseText || physicallyTiny)
    ? {
        alt: image.alt,
        scale: Number(scale.toFixed(3)),
        minimumScale,
        reason: denseText ? "dense text at low scale" : "physically tiny panel",
        rendered: { width: image.rect.width, height: image.rect.height },
        natural: {
          width: image.naturalWidth,
          height: image.naturalHeight,
        },
      }
    : null;
}

/**
 * Reports a text-bearing image constrained into a contain box whose aspect
 * ratio leaves most of one axis empty. This catches full-width banners turned
 * into tiny centered strips by an arbitrary fixed height even when the image
 * element's outer rectangle itself spans the Section.
 */
export function excessiveImageLetterboxing(image, minimumAxisUse = 0.7) {
  if (
    image?.objectFit !== "contain" ||
    ![
      image.naturalWidth,
      image.naturalHeight,
      image.rect?.width,
      image.rect?.height,
    ].every(Number.isFinite) ||
    image.naturalWidth <= 0 ||
    image.naturalHeight <= 0 ||
    image.rect.width <= 0 ||
    image.rect.height <= 0
  )
    return null;
  const scale = Math.min(
    image.rect.width / image.naturalWidth,
    image.rect.height / image.naturalHeight,
  );
  const contentWidth = image.naturalWidth * scale;
  const contentHeight = image.naturalHeight * scale;
  const inlineUse = contentWidth / image.rect.width;
  const blockUse = contentHeight / image.rect.height;
  if (inlineUse >= minimumAxisUse && blockUse >= minimumAxisUse) return null;
  return {
    alt: image.alt,
    objectFit: image.objectFit,
    minimumAxisUse,
    inlineUse: Number(inlineUse.toFixed(3)),
    blockUse: Number(blockUse.toFixed(3)),
    rendered: { width: image.rect.width, height: image.rect.height },
    content: {
      width: Number(contentWidth.toFixed(2)),
      height: Number(contentHeight.toFixed(2)),
    },
  };
}

/**
 * Reports a responsive Section that becomes dramatically taller than the
 * corresponding source surface at the same display width. This catches
 * technically-contained but visually broken compositions such as every small
 * item in a source row becoming a full-width panel or a narrow separator
 * scaling into a viewport-sized image. Moderate growth for live rails and
 * ordinary wrapping remains allowed.
 */
export function excessiveResponsiveHeight(
  sourceRect,
  renderedRect,
  maximumRatio = 3,
) {
  if (
    !sourceRect ||
    !renderedRect ||
    ![
      sourceRect.width,
      sourceRect.height,
      renderedRect.width,
      renderedRect.height,
    ].every(Number.isFinite) ||
    sourceRect.width <= 0 ||
    sourceRect.height <= 0 ||
    renderedRect.width <= 0 ||
    renderedRect.height <= 0
  )
    return null;
  const equalWidthSourceHeight =
    (sourceRect.height * renderedRect.width) / sourceRect.width;
  const ratio = renderedRect.height / equalWidthSourceHeight;
  return ratio > maximumRatio
    ? {
        ratio: Number(ratio.toFixed(3)),
        maximumRatio,
        equalWidthSourceHeight: Number(equalWidthSourceHeight.toFixed(2)),
        renderedHeight: Number(renderedRect.height.toFixed(2)),
      }
    : null;
}

function overlapLength(firstStart, firstLength, secondStart, secondLength) {
  return Math.max(
    0,
    Math.min(firstStart + firstLength, secondStart + secondLength) -
      Math.max(firstStart, secondStart),
  );
}

/**
 * Report a multi-row action rail only when its measured actions would fit on
 * one ordinary row. This remains reviewer evidence rather than a universal
 * failure because a source may deliberately author more than one row.
 */
export function avoidableActionRailWrap(railWidth, rects, gap = 8) {
  if (!Number.isFinite(railWidth) || railWidth <= 0 || rects.length < 2)
    return null;
  const rows = [];
  for (const rect of rects) {
    if (
      !rect ||
      ![rect.y, rect.width, rect.height].every(Number.isFinite) ||
      rect.width <= 0 ||
      rect.height <= 0
    )
      return null;
    const top = rect.y;
    const bottom = rect.y + rect.height;
    const row = rows.find((candidate) => {
      const overlap =
        Math.min(bottom, candidate.bottom) - Math.max(top, candidate.top);
      return (
        overlap >= Math.min(rect.height, candidate.bottom - candidate.top) * 0.5
      );
    });
    if (row) {
      row.top = Math.min(row.top, top);
      row.bottom = Math.max(row.bottom, bottom);
    } else rows.push({ top, bottom });
  }
  if (rows.length < 2) return null;
  const requiredWidth =
    rects.reduce((total, rect) => total + rect.width, 0) +
    Math.max(0, rects.length - 1) * gap;
  return requiredWidth <= railWidth + 1
    ? { rows: rows.length, requiredWidth, railWidth }
    : null;
}

/**
 * Report action rails whose measured height is substantially larger than the
 * union of their live controls, Costs, and Tags. Ordinary padding is allowed;
 * the finding targets the detached empty bands that can survive overflow and
 * overlap checks when a layout child stretches vertically.
 */
export function excessiveActionRailSlack(
  railHeight,
  rects,
  minimumAllowance = 24,
  proportionalAllowance = 0.75,
) {
  if (!Number.isFinite(railHeight) || railHeight <= 0 || !rects.length)
    return null;
  if (
    rects.some(
      (rect) =>
        !rect ||
        !Number.isFinite(rect.y) ||
        !Number.isFinite(rect.height) ||
        rect.height <= 0,
    )
  )
    return null;
  const top = Math.min(...rects.map((rect) => rect.y));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  const contentHeight = bottom - top;
  const unusedHeight = railHeight - contentHeight;
  const allowedUnusedHeight = Math.max(
    minimumAllowance,
    contentHeight * proportionalAllowance,
  );
  return unusedHeight > allowedUnusedHeight + 1
    ? {
        railHeight,
        contentHeight,
        unusedHeight,
        allowedUnusedHeight,
      }
    : null;
}

/**
 * Find adjacent vertical panel cuts whose shared source seam is not a clean
 * structural edge on both crops. Such a seam commonly means that a sentence,
 * glyph, or other shared parent content was cut into two sibling images. The
 * defect can be hidden at the desktop width and becomes obvious when the
 * responsive layout stacks those siblings.
 */
export function facsimileCropSeamFindings(cropAudit) {
  const assets = cropAudit?.assets ?? [];
  return assets.flatMap((first, firstIndex) =>
    assets.slice(firstIndex + 1).flatMap((second) => {
      if (first.page !== second.page) return [];
      const firstRight = first.rect.x + first.rect.width;
      const secondRight = second.rect.x + second.rect.width;
      const firstThenSecond = Math.abs(firstRight - second.rect.x) <= 2;
      const secondThenFirst = Math.abs(secondRight - first.rect.x) <= 2;
      if (!firstThenSecond && !secondThenFirst) return [];
      const overlap = overlapLength(
        first.rect.y,
        first.rect.height,
        second.rect.y,
        second.rect.height,
      );
      if (overlap < Math.min(first.rect.height, second.rect.height) * 0.5)
        return [];
      const left = firstThenSecond ? first : second;
      const right = firstThenSecond ? second : first;
      const leftEdge = left.edges?.right;
      const rightEdge = right.edges?.left;
      if (
        leftEdge?.possibleStructuralEdge === true &&
        rightEdge?.possibleStructuralEdge === true
      )
        return [];
      return [
        {
          page: left.page,
          left: left.id,
          right: right.id,
          x: right.rect.x,
          overlap,
          leftDominantRatio: leftEdge?.dominantRatio ?? null,
          rightDominantRatio: rightEdge?.dominantRatio ?? null,
          reason:
            "adjacent panel crops do not both end on a clean vertical structural edge",
        },
      ];
    }),
  );
}
