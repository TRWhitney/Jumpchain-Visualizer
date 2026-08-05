# Facsimile conversion workflow

## Contents

- Contract
- Measure and crop panels
- Add live interaction
- Verify fidelity and behavior

## Contract

Produce an ordinary Format 1 archive whose authored visual panels deliberately preserve source pixels. Facsimile is a caller-selected conversion workflow, not an application mode or Format 1 feature. Do not add package metadata, application preferences, or renderer branches for it.

Keep the underlying Choice names, descriptions, costs, Tags, grants, and controls live. Use source pixels for measured visual panels, not to replace mechanics. Source prose whose typeface, weight, line breaks, or hierarchy contributes to the visual identity remains in measured paragraph or block panels; a live transcription stored for semantics is not permission to repaint that prose in a different system font. Final Home/Stay/Next-Jump outcomes are deliberately not underlying live Choices: keep them as exact source prose and visuals without a Choice, Source, control, selection state, property, or outcome projection. Exact full alt text supplies their facsimile prose semantics. Reviewers treat this non-interactivity as required, not missing.

Separate semantic identity from pixels. The crop may preserve `SHINY`, while the Choice and granted perk are named `Shiny`. Normalize display capitalization, not spelling: the semantic name must occur in the source entry after ignoring case and punctuation. A concept clarified by the source's own effect prose is valid when that complete phrase occurs there. Use `intentionalAllCaps` only for a genuine acronym or proper all-caps name. When a decorative heading maps to an exact phrase elsewhere in the same source entry, leave the measured panel unchanged and record the evidenced reason in `normalizationNote`. If the proposed name occurs nowhere in the entry transcription, preserve the apparent typo or awkward grammar unless the Developer explicitly authorized the change and quote that authorization in `developerAuthorization`. Source typography never determines Tracker casing. Verify spelling against the source pixels or extracted source text; never treat an asset filename, handle, conventional grammar, or agent confidence as transcription evidence.

Inventory unconditional grants before writing Choices. Every durable possession the source gives automatically is a direct Jump-level Item grant, including stated quantities in the visible name when Format 1 has no owning quantity control. Give each independently labeled illustrated possession its own source entry, inventory record, and Item; where the source block is inseparable, enumerate every resulting `kind:Visible Name` key on that one entry. Compare the source count, reconciliation count, canonical grant count, and clean-baseline Inventory count before passing. Also review introductory and transition prose for unconditional current-Jump circumstances: duration, stopped home time, retained memories, imposed background, environmental conditions, and local restrictions are Jump-level Trait candidates rather than possessions or invisible flavor. The raster panel and prose do not count as a Tracker grant, and an unconditional grant never receives a claim control.

Transcribe full live descriptions even though the same prose appears in pixels. Preserve those descriptions in Choice/grant semantics and Tracker records; do not automatically render a duplicate text block beneath a panel that already contains the complete prose. Reconcile each source rule with the authored control, bounds, options, costs, grants, discounts, ownership, and gaps. Never introduce a cap or option list merely because the control is easier to author that way. A “free for” or “half price for” line must become its native discount/grant behavior or a demonstrated gap.

After inventorying all pages, make a reverse pass for cross-page rule text. Index every named free entitlement, discount, prerequisite, conflict, and override by the Choice that causes it. Do not finish an origin/background when its benefits are printed later on Skill or Gear cards.

## Measure and crop panels

Record a visual specification before cropping:

- Page and panel rectangles.
- Source reading order.
- Card and group boundaries.
- Which borders and rules belong to each crop edge.
- Where live costs and controls can be added without covering source content.
- Content insets on repeated siblings. A right-column crop starts after the shared column gutter; it does not inherit extra leading gutter pixels merely because its source `x` begins at that gutter boundary.

Name every same-row, same-column, and spanning relationship explicitly. A generic phrase such as “ordered cards” is not a surface tree when the source has two- or three-column groups. Each visually distinct surface named in that tree must map to its own measured panel or live layout node. A full-page raster fails whenever it collapses multiple headings, prose blocks, rules, banners, illustrations, or card groups into one node; it is allowed only when the source page is genuinely one indivisible visual surface. At the primary comparison width, a source row must remain a row and a source grid must retain its track count unless a measured control minimum makes that impossible.

Crop the smallest complete panel that preserves the intended typography and composition. Every source Choice card receives its own ledger entry and normally a matching packaged panel crop with the same rectangle. When direct 390px comparison proves that intact text unreadable, use the explicit `measured-fragments` strategy: record at least two contained packaged panel assets and the measured reason, render every declared fragment, and preserve their source relationships. A panel rectangle begins outside every glyph and ends after every line, price, border, and owned rule; never cut at a convenient coordinate through the first letter, last price digit, description line, map, or adjacent card. A deliberately separate title fragment contains only the complete title artwork; any prose it excludes remains in another measured source fragment rather than retyped system-font text. If title and prose cannot be separated without cutting content, retain the intact source panel. Do not replace a collection of independent cards with one collection-sized or whole-page image and then duplicate it with live expansions. Run the crop audit, inspect all four edges against the page with coordinates visible, and remove neighboring gutters, partial glyphs, and unrelated rules.

For long non-interactive prose, crop at paragraph or visual-group boundaries so narrow layouts can stack and scale meaningful blocks without turning a whole source page into microscopic text. Compare the source and render at equal display width. Replacing condensed source prose with wide live body text, changing its wrapping and page rhythm, is a facsimile failure even when every word is present. If Format 1 cannot keep measured prose readable at a narrow width without degrading the accepted primary facsimile, preserve the primary measured panel and demonstrate the responsive limitation; never sacrifice the primary composition merely to silence the narrow audit.

Text-bearing headers, instruction bands, transitions, and outcome panels also need complete live semantics. When their wording is not represented by a Choice description or another live Text node, put the exact full visible transcription in the image alt text. “Section heading and instructions” or “outcome prose” is a summary, not a transcription. Render full-width banners at their natural aspect ratio; a shallow fixed-height `contain` box that turns a banner into a small centered strip is not fidelity.

The capture audit reports `microscopicTextPanels` when a dense-text source panel falls below the conservative scale floor or a low-scale panel becomes physically tiny. It deliberately leaves short, large-display headings to direct visual review. Resolve a finding through finer source-surface decomposition or cover it with a minimal valid experiment and responsive-fidelity gap; never dismiss it because the DOM itself has no overflow.

The capture audit also reports `responsiveHeightInflation` when a 720px or 390px Section becomes more than three times taller than its source surface at equal display width. This is the characteristic failure produced by turning each small member of a source row into a full-width block or allowing a narrow separator to scale as a large portrait. Recompose the affected group and test the greatest fitting track count before claiming a responsive gap.

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
- Include the entity's source role in its visible dynamic name, such as `"{{species}} (Starter)"`. Do not manufacture a role-named perk; upgrades remain companion-owned perks targeting the stable entity.
- Capture the populated creation control, contextual name in the Companions or Forms tab, and at least one owned-upgrade projection as separate evidence. The first screenshot cannot stand in for the other two.
- Place applicable live Tags in the same additive rail, normally in available space between Control and Cost. Derive them from the live effect; the source is not expected to print Tag strings, so their absence from source art never makes a Choice `not-applicable`. Record a semantic reason for every Choice that truly has no useful effect Tag.
- Before fixing repeated cards into columns, measure the rendered minimum width of each card's live Control, Cost, padding, and action rail. Use responsive Grid or wrapping composition when the declared column count cannot fit that minimum at a required comparison width; never compress controls past their intrinsic width merely to preserve a desktop column count.
- At each required width, preserve the greatest source-authored track count whose measured minimum widths fit. Test that count directly at 720px before collapsing to one column; a generic breakpoint is not evidence that two tracks cannot fit.
- When a Wrap collapses despite fitting authored minimums, inspect its flex basis. A wide raster panel can dominate an auto basis and force premature wrapping. Preserve minimal valid Wrap and Grid experiments; do not put `grow` under Wrap because current Format 1 permits it only under Stack or Inline. If neither valid composition can retain the fitting track count, record the responsive-authoring gap with both experiments.
- When Source members occupy authored rows, columns, or spans, place those members individually in the Section layout while retaining the Source for mechanics. Use `expand` only when its actual rendered arrangement matches the source; Source membership does not require default vertical expansion.

Do not cover, crop, or distort source text to make room for controls. If no additive placement works, record the conflict and choose the least disruptive transparent rail.

## Verify fidelity and behavior

Compare each rendered panel directly with its source rectangle at the primary comparison width. Then test 720px and 390px for intentional reflow, readable panels, and usable controls. Separately record source and rendered bounds for every alignment relationship. Declare each source row independently; matching left/right/top/bottom edges, centers, and dimensions must remain matching after rails and responsive layout are applied. The audit derives those stricter relationships from the recorded source rectangles even if the author labels the group only `same-row` or `same-column`. A desktop source row rendered as a vertical stack or with visibly uneven source-equal edges is always a failure.

Reject crops with truncated glyphs or lines, inconsistent border remnants, visible neighboring content, poor contrast around additive rails, or controls that appear detached from their content. Reject an additive rail whose outer frame, width, or edge alignment makes it look unrelated to its panel; compare against a neighboring accepted card, not merely against empty Section space. Reject a wide render when source siblings that share a row are stacked, when a source grid becomes a list, or when a crop fragments one source card into multiple rendered cards. Exercise selection, rolling, clearing, ranks, discounts, limits, grants, dynamic names, owned upgrades, and Tracker inventory. Capture unset and changed states, assert the intended value and price after every action, record DOM observations, and reject any overlap or unexpected card, rail, neighbor, or Section reflow. A close pixel match does not excuse broken semantics, duplicate cost meaning, missing alt text, or inaccessible controls.

At narrow widths, keep the additive rail intrinsically sized around its live elements. Do not let Grid or Stack stretching create a mostly empty rail taller than its source panel. Compare the live-element union with the rail's outer bounds; unexplained unused vertical space or visual detachment fails even when no DOM overflow exists.

At every responsive width, read the rasterized text in rendered order and at the captured display scale. Text that is technically present but too small to read fails. Split a compound raster surface into finer measured blocks and reflow those blocks before claiming an inherent facsimile limitation. Do not solve small raster text by visibly duplicating the same prose in live text at every width; if finer valid decomposition cannot preserve both primary fidelity and narrow readability, preserve the experiment and report the responsive facsimile gap. Reject a result where a shared sentence is split across cards (for example one card ending in `YOUR GE` and the next beginning in `NDER`), even when the two halves appear adjacent at the primary width.

The shared capture audit infers same-row relationships from non-overlapping Choice rectangles on unambiguous source pages and verifies them at 1440px. Any `sourceRowMismatches` finding blocks `structure-and-surfaces` and `responsive-fit`; fix the placement rather than weakening the source rectangles or marking the source page ambiguous.

Comparison evidence is invalid if source and render panels use different display widths, application shell or toast UI covers the Section, the capture contains unexplained black/blank regions, or any source panel is missing. Fix the capture before recording a visual pass.

Do not self-certify the final pass. After comparison sheets exist, use a fresh-context agent as an independent reviewer following `visual-acceptance.md`. Give it source/render evidence, definitions, package review, generated `review-evidence.json`, and raw experiment reports; never give it the ledger, prior verdicts, rejected evidence, or anticipated defects. Experiments may justify only a limitation the reviewer independently identifies. The factual manifest makes all interaction observations directly reviewable without revealing acceptance decisions. The reviewer compares both the screenshots and live JDEF semantics with the source. Resolve every reported crop, composition, responsive, interaction, or semantic issue, recapture, and rerun the review. Preserve the raw report in `verification/` and map all findings into `facsimileContracts.independentReview`.
