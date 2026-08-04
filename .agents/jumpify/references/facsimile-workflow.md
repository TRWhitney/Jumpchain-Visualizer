# Facsimile conversion workflow

## Contents

- Contract
- Measure and crop panels
- Add live interaction
- Verify fidelity and behavior

## Contract

Produce an ordinary Format 1 archive whose authored visual panels deliberately preserve source pixels. Facsimile is a caller-selected conversion workflow, not an application mode or Format 1 feature. Do not add package metadata, application preferences, or renderer branches for it.

Keep the underlying Choice names, descriptions, costs, Tags, grants, and controls live. Use source pixels for measured visual panels, not to replace mechanics. Keep final outcomes as source prose and visuals without controls.

## Measure and crop panels

Record a visual specification before cropping:

- Page and panel rectangles.
- Source reading order.
- Card and group boundaries.
- Which borders and rules belong to each crop edge.
- Where live costs and controls can be added without covering source content.

Name every same-row, same-column, and spanning relationship explicitly. A generic phrase such as “ordered cards” is not a surface tree when the source has two- or three-column groups. At the primary comparison width, a source row must remain a row and a source grid must retain its track count unless a measured control minimum makes that impossible.

Crop the smallest complete panel that preserves the intended typography and composition. Every source Choice card receives its own ledger entry and matching packaged panel crop with the same rectangle. A panel rectangle begins outside every glyph and ends after every line, price, border, and owned rule; never cut at a convenient coordinate through the first letter, last price digit, description line, or adjacent card. Do not replace a collection of independent cards with one collection-sized or whole-page image and then duplicate it with live expansions. Run the crop audit, inspect all four edges against the page with coordinates visible, and remove neighboring gutters, partial glyphs, and unrelated rules.

Do not split shared parent content between sibling crops. A heading, sentence, rule, or background band that spans two cards belongs in one parent-level crop above or around those cards. This is especially important for adjacent scalar cards: a desktop seam can look continuous while bisecting a word, then turn into two distant sentence fragments when the cards stack at 720px or 390px. The crop audit rejects adjacent vertical seams unless both crop edges are clean structural edges. If it rejects a seam, move the shared content into a separate parent image and begin each child crop below or inside that boundary; never override the finding with a prose assertion.

Provide alt text that conveys the panel's meaningful content. Record that text-bearing images reduce selectable text, reflow, localization, and accessibility fidelity.

## Add live interaction

Place live slots in deliberate additive rails:

- Keep source cost pixels only as visual reference; the live Cost slot remains authoritative.
- Place the live cost beside its control when the source leaves a suitable action area.
- Suppress control adornments when the authored rail already provides its boundary.
- Match local alignment: center only under centered content, otherwise follow the panel's relationship.
- Keep rails compact and card-local. Do not create full-width bars by habit.
- Preserve the card's enclosing boundary around both panel and rail. If the panel uses an accent frame against the Section, extend that visual ownership around the additive rail; do not let a same-color rail dissolve into the Section or extend beyond the panel for no measured reason.
- Start simple panel-only cards with the proven opposite-edge Inline rail from the native-interaction reference: live Control on one edge, Cost on the other, and no detached blank well. For multi-part native controls, measure the complete rail at every track width and use card reflow or a deliberate Wrap before anything overlaps.
- Use the relationship-specific `either` and continuity rails from the native-interaction reference for adjacent scalar cards. At the primary width, keep Roll, scalar input/select, Clear behavior, and Cost in one coherent row when their measured intrinsic widths fit; do not accept a generic Control slot's avoidable internal wrap.
- Attach a Source Roll/Clear group immediately to its instruction panel. Do not center it in arbitrary blank space between the header and first card.
- Interpolate entered names into visible grants and confirm them in Tracker tabs.
- Before fixing repeated cards into columns, measure the rendered minimum width of each card's live Control, Cost, padding, and action rail. Use responsive Grid or wrapping composition when the declared column count cannot fit that minimum at a required comparison width; never compress controls past their intrinsic width merely to preserve a desktop column count.
- When Source members occupy authored rows, columns, or spans, place those members individually in the Section layout while retaining the Source for mechanics. Use `expand` only when its actual rendered arrangement matches the source; Source membership does not require default vertical expansion.

Do not cover, crop, or distort source text to make room for controls. If no additive placement works, record the conflict and choose the least disruptive transparent rail.

## Verify fidelity and behavior

Compare each rendered panel directly with its source rectangle at the primary comparison width. Then test 720px and 390px for intentional reflow, readable panels, and usable controls.

Reject crops with truncated glyphs or lines, inconsistent border remnants, visible neighboring content, poor contrast around additive rails, or controls that appear detached from their content. Reject an additive rail whose outer frame, width, or edge alignment makes it look unrelated to its panel; compare against a neighboring accepted card, not merely against empty Section space. Reject a wide render when source siblings that share a row are stacked, when a source grid becomes a list, or when a crop fragments one source card into multiple rendered cards. Exercise selection, rolling, clearing, ranks, discounts, limits, grants, and dynamic names. Capture unset and changed states, assert the intended value and price after every action, record DOM observations, and reject any overlap or unexpected card, rail, neighbor, or Section reflow. A close pixel match does not excuse broken semantics, duplicate cost meaning, missing alt text, or inaccessible controls.

At every responsive width, read the rasterized text in rendered order. Reject a result where a shared sentence is split across cards (for example one card ending in `YOUR GE` and the next beginning in `NDER`), even when the two halves appear adjacent at the primary width.

The shared capture audit infers same-row relationships from non-overlapping Choice rectangles on unambiguous source pages and verifies them at 1440px. Any `sourceRowMismatches` finding blocks `structure-and-surfaces` and `responsive-fit`; fix the placement rather than weakening the source rectangles or marking the source page ambiguous.

Comparison evidence is invalid if source and render panels use different display widths, application shell or toast UI covers the Section, the capture contains unexplained black/blank regions, or any source panel is missing. Fix the capture before recording a visual pass.
