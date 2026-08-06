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
- In facsimile mode, visually identifying prose typography remains in measured paragraph or block panels. Exact live transcription does not excuse a different typeface, wrapping pattern, hierarchy, or dramatically taller narrow render.
- Treat a `microscopicTextPanels` audit finding as evidence that dense or physically tiny raster prose needs finer decomposition or a demonstrated responsive gap; absence of clipping does not make underscaled glyphs readable. Short display headings still require direct review because scale alone cannot judge their glyph size.
- Semantic Choice and grant names use readable ordinary casing even when their measured source panels preserve all-caps display typography.
- Ordinary casing changes capitalization only. A semantic name that does not occur anywhere in its complete source-entry transcription is a suspected rewrite, not normalization; preserve apparent typos and awkward grammar unless explicit Developer authorization is recorded.
- Introductory prose is audited for live current-Jump semantics, not merely readable pixels. Retained memory, new-memory effects shared by backgrounds, environmental danger, population/travel assumptions, authority responses, and other circumstances that remain true during the Jump appear as direct or Choice-granted Traits when the source states them.
- A heavy condensed source face uses the closest approved system stack and appropriate bold/black weight.
- Paragraph and list gaps match the source density.
- Text reaches at least 4.5:1 contrast against its actual painted background for ordinary sizes.

## Artwork and crops

- Artwork identity and aspect ratio match.
- Crops contain no neighboring borders, rules, gutters, or partial glyphs.
- Crops contain no partial artwork touching an edge claimed as outside or clear of content; a recognizable icon cut at the boundary is still clipped and often renders as a stray stripe. A 90–100% uniform edge is only a measurement candidate, not proof that the pixels belong: compare adjacent source rows/columns and reject foreign solid rules, stripes, neighboring borders, and partial artwork.
- Edge-ownership prose cannot waive pixel completeness. An owned foreground edge identifies a complete authored border, complete artwork edge, or unavoidable source-page boundary; it never legitimizes a crop through a glyph, rule, or object.
- Schema-version-2 `crop-audit.json` exactly matches the current source hash, ledger asset inventory, and every asset's page, rectangle, output, package state, alt text, interior metric, and four edge metrics. Regenerate it after any source, tool, or crop-contract edit; stale or stripped edge evidence is not review evidence.
- Title-only crops contain exactly the complete title artwork and no effect prose, price, map, neighboring label, or fully contained sentence fragment. If the title cannot be isolated, retain the intact source panel.
- A crop begins outside its first complete glyph and ends after its last complete line, price, and owned border; no source card is fragmented across multiple crops.
- Shared headings, sentences, rules, and bands belong to a parent crop; no word or line is divided between sibling crops. Re-read rendered raster text after responsive stacking because a bisected desktop word can otherwise become two distant fragments.
- The facsimile crop audit reports no non-structural shared vertical seam between adjacent panel crops.
- Every crop edge has an explicit ownership decision.
- Repeated sibling crops have source-consistent content insets. Shared column gutters are excluded rather than becoming extra leading gray or blank pixels on right-column cards when they later stack.
- Artwork remains legible against its card background.
- Semantic output contains no rasterized text or card composition.
- Facsimile output uses measured panels rather than arbitrary page-sized images.
- A facsimile page containing multiple visually distinct headings, prose blocks, rules, banners, illustrations, or card groups is decomposed into corresponding measured panels/live nodes. A whole-page panel is acceptable only when the page is genuinely one indivisible surface.
- Each interactive facsimile Choice renders its intact measured source panel. A title fragment plus retyped body copy does not replace that panel, and full-width banners retain their natural aspect ratio rather than becoming letterboxed fixed-height strips.
- A narrow render whose total Section height exceeds three times the source surface at equal display width receives a `responsiveHeightInflation` finding. Treat it as evidence of excessive stacked expansion—not as successful reflow—until finer grouping or a demonstrated responsive limitation explains it.

## Costs and controls

- Cost badges occupy the source-authored edge or available matching rail, including bottom-right placement where demonstrated.
- Applicable live Tags occupy the recorded additive-rail space, normally between Control and Cost; a missing Tag decision is a semantic failure.
- A `not-applicable` Tag decision explains why the Choice has no useful filtering effect. “No Tag appears in the source” fails because source documents are not expected to contain application Tag strings.
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
- At 720px, test the greatest source-authored track count that fits measured card minimums before reducing it. A generic breakpoint that collapses a fitting two-track Grid to one column fails.
- For repeated Wrap children containing wide panel images, intrinsic raster width is not evidence that authored minimums cannot share the row. Test valid Wrap and Grid alternatives; `grow` is not valid under Wrap. If current responsive behavior still prevents the measured track count, preserve both experiments and record a responsive-authoring gap.
- Narrow action rails wrap tightly around their live-element union. A mostly empty rail taller than its panel or separated by unexplained vertical space fails even when nothing overlaps.
- Test a rail with direct Control, Tags, and Cost children before nesting any one slot in an Inline or Stack. A nested container can reserve a full wrap track and create an unnecessary second row; edge alignment alone does not justify that wrapper.
- State evidence proves the requested value actually changed and the visible resolved price changed with it; the existence of differently named PNG files is not evidence.
- A text Choice's manual DOM observation contains a nonempty typed string different from unset; a placeholder or `actionSucceeded` flag cannot substitute for the observed value.
- Cross-section same-state proof uses readable element crops plus a shared-state observation manifest and labeled evidence sheet. A full-page capture dominated by blank space or microscopic targets is invalid.
- A repeatable discounted Choice visibly shows both its base per-unit price and resolved total in same-state evidence. Compact Cost density or accessible-only text does not satisfy this check.
- Final interaction evidence is manifest-clean. Every file in `verification/interactions/` is authoritative and referenced; obsolete or failed captures are preserved under `verification/rejected/` rather than mixed into the review set.

## Content and application semantics

- All prose and source labels are present and verified.
- A text-bearing header, instruction, transition, or outcome image without equivalent live Text exposes the exact full visible wording in its alt text; a topical summary does not satisfy live semantics.
- Verify spelling and wording from the authoritative source pixels or extracted text, never from an asset filename, handle, ledger label, or prior transcription. Filenames are navigation aids and may themselves contain mistakes.
- Live Choice and grant descriptions preserve the complete source effects instead of abbreviating prose already visible in the raster panel.
- Complete Tracker descriptions do not require duplicate visible prose. If a facsimile panel already contains the same complete description, painting a second copy beneath it is a fidelity failure unless the source itself repeats it.
- An unreadable intact Choice panel may use only an explicitly recorded measured-source-fragment decomposition: every fragment is contained by the source entry, rendered, and compared; no omitted fragment is repainted in a substitute system font.
- Equivalent siblings use a consistent intact or decomposed strategy unless an independently visible source difference justifies the exception; one enlarged card among otherwise microscopic peers fails hierarchy review.
- Every source cost, free entitlement, discount, grant, option domain, limit, quantity rule, restriction, and override is implemented or linked to a demonstrated gap.
- Roll-or-pay Sources verify the manual price for every exceptional member as well as a representative ordinary member. A nested Free Pick does not become manually free merely because its inner selection has no additional cost.
- Finite source-authored option domains use exactly those options rather than unrestricted text.
- No control contains an invented maximum, default, or option merely for authoring convenience.
- Spendable source currency uses resource semantics rather than an Item grant.
- Tag classification follows the live effect rather than the source section heading. Generic `World`, `Background`, `Origin`, `Companion`, `Perk`, `Item`, `Form`, `Trait`, `Flaw`, or `Drawback` labels cannot be the only Tag because they merely repeat placement, cost class, or grant kind. An entity noun such as `Pokémon` is not useful as the only Tag on a control that merely names a Pokémon; use the contextual effect such as `Starter`, while retaining `Pokémon` where an effect broadly operates on Pokémon. A currency Resource does not receive an `Item` Tag merely because it is sold in Gear.
- Every visible Perk, Item, Companion, Form, and Trait grant has one to five useful effect Tags. Taggable Choices also use one to five as appropriate. Counts vary with actual filtering dimensions; mechanically assigning exactly one Tag to every entry in a substantial conversion fails semantic review. A genuine all-one set passes only with a justified `tagCardinalityReview` whose exact Choice handles and owner/index-qualified grant refs reconcile with every affected canonical entry, including duplicate-named grants.
- Unconditional grants require no claim control.
- Grant decisions follow each distinct clause's semantic force: explicit giving differs from retaining prior possessions, narration, instructions, and later references to the same entity. A mixed paragraph has multiple clause decisions, and only explicit-grant/current-Jump-rule clauses own unconditional keys. Choice grant kinds match contextual roles such as acquisition, classification, enhancement, ability, possession, circumstance, identity, or resource change; labels alone do not decide the kind.
- Referent resolutions quote the ambiguous mention with contiguous relationship context and point to an existing canonical Choice grant or exact indexed Jump grant; a bare noun, nonexistent handle, or unrelated grant is not evidence. Every `new-entity` conclusion compares exact `choiceHandle:grantHandle` references for all same-kind dynamic entities and records a source-grounded basis: explicit additionality, a separate slot/count, simultaneous possession, or incompatible identity. Do not accept or reject from an English keyword alone. Provenance or chronology—met earlier, rescued, inherited, raised, follows, joins, or tags along—does not prove a second entity. Mutually exclusive backgrounds that introduce one same-role entity before a later singular defining Section default to the same later entity and must not create origin-specific duplicate grants. Reconcile the derived canonical Companion/Form inventory: every non-dynamic grant coexisting with a same-kind dynamic entity has exactly one independently reviewed `new-entity` resolution, direct Jump grants bind their indexed ref to the same source inventory record, and an omitted record cannot hide a duplicate. The clean reviewer returns an explicit supported/unsupported adjudication for every new entity; a converter-authored basis alone never passes completion.
- Dynamic entities keep one direct scalar identity owner outside their classification Source. They explicitly inventory one single-select Source whose complete membership exactly equals all classification Choices. Each member that only classifies the same entity grants one shared Property with an explicit source-authored value, and the selected value appears in that entity's Tracker name; repeated name controls, copied toggle booleans, grantless selectors, and fixed substitute labels fail review.
- Every source-authored unconditional durable possession appears in Tracker inventory as a Jump-level Item grant.
- Illustrated kits reconcile item-for-item and quantity-for-quantity across source labels, `grantKeys`, canonical Jump grants, and clean-baseline Inventory; one generic kit grant never substitutes for multiple independently granted possessions.
- Traits appear only in the current Jump.
- Entered Companion/Form names include their source role in the corresponding Tracker tab, and owned upgrades appear under that same stable entity. Companion upgrades use Companion ownership and Form upgrades use Form ownership. Verify creation, contextual Tracker identity, and owned-upgrade projection in three explicit evidence states rather than inferring all three from the input control. When an earlier Choice narrates the same entity's origin, verify a fourth combined continuity state with that Choice active and confirm exactly one contextual Tracker record exists.
- Cross-choice discounts and free entitlements are captured with the granting Choice active and the affected downstream Cost, resource, balance, or Tracker record visible in the same chain state.
- Repeated quantities are verified in both resolved total cost/resource effects and Tracker quantity, not only by changing the rank input or showing a per-unit badge.
- Open Inventory confirms the exact unconditional records and their live descriptions from a clean baseline captured before any conditional grant is activated. The screenshot and DOM observations cover the complete list and agree with each other.
- Final Home/Stay/Next-Jump outcomes have exact prose and visuals but no Choice, Source, control, selection state, property, or outcome projection. This deliberate exception is a required pass condition; do not report the absence of Future interaction as a semantic gap.

## Completion decision

Summarize these bullets under exactly six required ledger categories for every Section and width: `structure-and-surfaces`, `text`, `artwork-and-crops`, `costs-and-controls`, `content-and-semantics`, and `responsive-fit`. Pass only when every applicable check is recorded as `pass`. Record `gap:<id>` only after a minimal valid syntax experiment fails. Any `fail`, `unreviewed`, missing screenshot, invalid capture, or missing interaction state blocks completion.

After the converter finishes its own comparison and interaction capture, verify that every directly inventoried experiment report describes the current shipped JDEF/captures and move superseded reports under `verification/rejected/`. Rerun the comparison tool to regenerate `review-evidence.json`, then run an independent review in a fresh context. Give the reviewer all source pages, every required Section capture at all three comparison widths, comparison sheets, the editable JDEF, package review, generated `review-evidence.json`, this checklist, and current raw reports under `verification/experiments/`. Do not give it the ledger, converter acceptance statuses, prior verdicts, rejected evidence, or a list of expected defects. Experiments do not announce a gap; they are available only to classify a limitation the reviewer independently observes. The generated review manifest supplies every interaction state's numeric DOM observation, referent resolution, dynamic-entity evidence path, and authoritative evidence inventory without exposing conclusions. The reviewer must account for every path in `authoritativeInteractionFiles` and `authoritativeExperimentFiles`, compare each named state with its observation, and reject unexplained, unreadable, same-state, or stale evidence. It must inspect every page and width, inventory crop truncation, rail inflation or detachment, responsive readability, overlaps, missing semantics, invented constraints, unexercised mechanics, and unsupported entity duplication. It must also compare the JDEF controls, descriptions, grants, discounts, limits, option domains, and resource classification with the source. Record the raw report and each finding under `facsimileContracts.independentReview`. The converter may not mark the review passed; rerun the independent reviewer after fixes until it reports no open finding.
