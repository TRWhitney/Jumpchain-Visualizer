# Visual acceptance checklist

Use this checklist on every Section at 1440px, 720px, and 390px. Record each result in `ledger.json`; do not collapse these checks into “looks close.”

Before judging fidelity, reject invalid evidence: both comparison columns must use the same display width; the full Section must be present; no application shell, toast, sticky header, or unrelated UI may cover it; and no unexplained black or blank region may replace content. A screenshot of only the visible viewport is not proof for a taller Section.

An element screenshot can silently become wider than the requested browser viewport. Treat the capture audit's viewport-boundary finding as real horizontal overflow even when the resulting PNG contains all content. It blocks a pass; retain it only when the matching `responsive-fit` record names a demonstrated gap.

## Structure and surfaces

- Section boundaries match the source hierarchy.
- Distinct cards remain distinct; source gutters remain visible.
- Text/background polarity matches the source.
- Rules occur between the correct blocks, with the correct orientation and ownership.
- Distinct source blocks have not been collapsed into one multiline Text node; every source column, nested Stack, side note, and separator is visible in the rendered parent/child structure.
- Every source same-row, same-column, track-count, and span relationship is recorded explicitly rather than summarized as “ordered cards”; the primary-width render preserves it.
- The facsimile capture audit reports no primary-width `sourceRowMismatches`.
- Inline siblings share the intended row extent; internal Stack growth is distributed as authored.
- Grid cards that should share a row height differ by no more than one CSS pixel.
- Full-row and multi-column cards use the correct span.
- No accidental cyan or other background sea surrounds unrelated cards or control-only regions.

## Text

- No glyph, word, list marker, or line crosses a painted boundary.
- No text is clipped, hidden, or horizontally scrollable.
- Wrapping resembles the source at the comparison width.
- Explicit source line breaks remain explicit.
- Size differences are proportional rather than exaggerated.
- Weight, case, line height, and letter spacing reproduce the source hierarchy.
- A heavy condensed source face uses the closest approved system stack and appropriate bold/black weight.
- Paragraph and list gaps match the source density.
- Text reaches at least 4.5:1 contrast against its actual painted background for ordinary sizes.

## Artwork and crops

- Artwork identity and aspect ratio match.
- Crops contain no neighboring borders, rules, gutters, or partial glyphs.
- A crop begins outside its first complete glyph and ends after its last complete line, price, and owned border; no source card is fragmented across multiple crops.
- Shared headings, sentences, rules, and bands belong to a parent crop; no word or line is divided between sibling crops. Re-read rendered raster text after responsive stacking because a bisected desktop word can otherwise become two distant fragments.
- The facsimile crop audit reports no non-structural shared vertical seam between adjacent panel crops.
- Every crop edge has an explicit ownership decision.
- Artwork remains legible against its card background.
- Semantic output contains no rasterized text or card composition.
- Facsimile output uses measured panels rather than arbitrary page-sized images.

## Costs and controls

- Cost badges occupy the source-authored edge or available matching rail, including bottom-right placement where demonstrated.
- Each live Cost, Control, and Roll target appears once per layout; printed facsimile pixels do not justify duplicate live badges.
- Controls sit beside their related content and cost instead of in a generic full-width bar.
- The source panel and additive rail read as one bounded card: their widths and outer edges align, and any source accent frame encloses both instead of leaving the rail visually merged into the Section.
- Roll, clear, and value controls form a coherent group and align like neighboring controls.
- At the primary width, a Roll + scalar + Cost rail remains one row when its measured intrinsic width fits; a generic component's avoidable internal wrap is a failed authored layout, not responsive behavior.
- Adjacent scalar cards, such as Age and Gender, use consistent rail baselines, edge alignment, gaps, and Cost placement even when their control types differ.
- No two live Controls, Clear/Roll actions, or Cost surfaces overlap at any required width. A readable-looking label partially covered by another control is still a hard failure.
- Centered content has centered controls only where that relationship is demonstrated.
- Control adornments are explicitly present or suppressed.
- Disabled controls at a source maximum retain the same geometry as enabled controls.
- Negative-cost and drawback controls do not introduce a contrasting box unsupported by the source.
- Selected, unselected, rolled, manual, repeated-rank, discounted, and limit states have been inspected.
- Standalone integer, select, text, and continuity values use their native controls without a Source-member checkbox/radio activation layer.
- Roll-or-manual entry of one value uses one native `either` control rather than separate activation Choices.
- Outer card, action rail, neighboring card, and Section bounds remain stable across interaction states unless the source itself demonstrates expansion.
- Repeated cards reflow before their live Controls, Costs, padding, or action rails exceed the available track width; verify intrinsic control width rather than assuming a source column count can remain fixed on narrow screens.
- State evidence proves the requested value actually changed and the visible resolved price changed with it; the existence of differently named PNG files is not evidence.

## Content and application semantics

- All prose and source labels are present and verified.
- Unconditional grants require no claim control.
- Traits appear only in the current Jump.
- Entered companion names appear in the Companions tab.
- Final outcomes have prose and visuals but no controls.

## Completion decision

Summarize these bullets under exactly six required ledger categories for every Section and width: `structure-and-surfaces`, `text`, `artwork-and-crops`, `costs-and-controls`, `content-and-semantics`, and `responsive-fit`. Pass only when every applicable check is recorded as `pass`. Record `gap:<id>` only after a minimal valid syntax experiment fails. Any `fail`, `unreviewed`, missing screenshot, invalid capture, or missing interaction state blocks completion.
