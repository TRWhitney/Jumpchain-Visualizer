# Semantic conversion workflow

## Contents

- Contract
- Decompose before authoring
- Author mechanics
- Author layouts
- Iterate against evidence

## Contract

Produce live, responsive Format 1 markup. Use raster assets only for irreducible artwork such as maps, sprites, logos, illustrations, textures, and decorative marks. Do not rasterize text, cards, rules, cost labels, or layout composition while valid syntax can express them.

Read `format-1-authoring.md` before authoring. Read `visual-acceptance.md` before the first screenshot pass.

## Decompose before authoring

For every source page:

1. Draw a surface tree from page to Section, block, card, content, and action rail.
2. Record the rectangle, background, border/rule ownership, padding, and alignment of each surface.
3. Record column widths and whether rows are intrinsic, stretched, or explicitly aligned.
4. Record typography by role: family class, weight, size, line height, letter spacing, case, wrapping, and explicit breaks.
5. Record which costs and controls share a row or column with prose.

Put the explicit parent/child tree in each relevant ledger `presentation.surfaceTree`; do not record only a generic word such as `stack`, `row`, or `card`. Distinct rectangles separated by a rule, gutter, background change, column boundary, or typography role are distinct source blocks and normally require distinct Text handles and layout nodes. Never combine a heading line, an instruction Stack, and a side note into one multiline Text merely because they belong to the same Section.

Never turn adjacent distinct cards into a shared colored sea. Never reverse text/background polarity or rule order. When the source has charcoal between cyan cards, preserve separate cyan card surfaces and charcoal gutters.

## Author mechanics

Model content before presentation:

- Use Jump grants for unconditional possessions and circumstances.
- Keep optional sources optional; use only source-authored maximums.
- Encode discounts through Choice groups and discount grants.
- Encode initial and Choice-controlled Section locks directly.
- Preserve rolled/manual pricing, repeated quantity semantics, grants, ownership, and dynamic names.
- Separate a user-entered entity identity from mutually exclusive rarity, quality, or price tiers. Create one stable companion/form/property grant and target it from tier and upgrade Choices; do not create one entity per tier.
- Use continuity inputs for unchanged prior identity when the source prices continuity differently. Do not model incidental narrative companions as grants.
- Keep end outcomes as prose and visuals without controls.

Exercise each path after layout work so visual changes do not conceal broken behavior.

## Author layouts

Build the smallest live hierarchy that matches the surface tree:

- Use Stack for vertical relationships and Inline for horizontal relationships.
- Use Grid for repeated cards and measured tracks; use spans for source-authored wide cards.
- Derive a repeated card's minimum viable width from its live Control, Cost, padding, and action rail before choosing fixed tracks. Use responsive Grid or wrapping composition when those intrinsic widths cannot fit at 720px or 390px; a desktop column count is not a reason to crush or overflow interactive content.
- Use grow only when the source allocates free space proportionally.
- Use alignment on the direct parent relationship. Verify the target is not stretched before expecting movement.
- Use Rule nodes for visible rules, including vertical separators.
- Use axis padding, minimum dimensions, list controls, and hard breaks where measured.
- Use explicit text sizes only when tokens cannot reproduce the hierarchy closely.
- Use condensed system typography and stronger weight when the source uses a heavy condensed face, while recording exact unavailable font identity as a limitation.
- Compose cost and control slots inside deliberate title or action rails; never add a generic bottom rail without source evidence.

At narrow widths, preserve reading order, card distinction, control usability, and absence of horizontal overflow. Responsive reflow may differ from fixed pagination, but it must remain intentional.

## Iterate against evidence

Capture at 1440px, 720px, and 390px. For each Section, compare in this order:

1. Surface tree, card boundaries, gutters, and rule order.
2. Major proportions, track widths, spans, and shared heights.
3. Type hierarchy, wrapping, weight, line height, and explicit breaks.
4. Artwork identity, scale, crop ownership, and contrast.
5. Cost and control placement in every state.
6. Fine spacing and color.

Fix the smallest mismatch without restructuring verified content or replacing correct artwork. Repeat until `visual-acceptance.md` passes or a demonstrated gap is recorded.

Comparison evidence is invalid if the source and render are shown at different display widths, if application shell or toast UI covers the Section, if the capture contains unexplained black/blank regions, or if the Section is only partially visible. Fix the capture before making a fidelity decision.
