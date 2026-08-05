# Jumpify conversion contract

## Contents

- Completion contract
- Source intake and transcription
- Semantic classification
- Handles, groups, Tags, and placement
- Controls, costs, and dynamic content
- Assets and crops
- Gaps and approximations
- Packaging and handoff

## Completion contract

A conversion is complete only when all of these are true:

1. Every source page is inventoried, mapped to at least one output Section, and represented by verified ledger entries.
2. Format 1 distribution diagnostics are empty.
3. The archive exports and reinspects as `ready` through `JumpPackageImportService`.
4. Mechanical paths have been exercised, not merely parsed.
5. Source/render screenshots at 1440px, 720px, and 390px pass the visual checklist.
6. Every approximation has a stable gap ID and a demonstrated reason.

Do not call an archive complete because it imports, contains accurate prose, or has roughly correct colors. Visual resemblance and interaction correctness are independent gates.

Record the source page count before authoring. Finish the page inventory for every page before writing JDEF. A partial archive is never a deliverable, even when it is valid, polished, or the remaining source is large. Continue in the same workspace across as many turns as necessary. Handoff requires a page-by-page coverage table naming each page's entries, output Sections, three comparison images, acceptance records, and applicable mechanics evidence.

## Source intake and transcription

Run `prepare-workspace.mjs` and `render-source.mjs` before authoring. Treat the copied source as authoritative. Do not embed the PDF in the package.

Workspaces use `scratch/jumpify/<global-sequence>-<readable-source-name>-<mode>/`, and the archive repeats that numbered name. The highest zero-padded sequence is the newest conversion across the whole Jumpify directory. The full source hash remains in `workspace.json`: an exact source-and-mode rerun resumes its numbered workspace, while changed bytes receive the next sequence.

Transcribe each source block twice:

- First, transcribe from the enlarged rendered page and record page coordinates.
- Second, compare the finished text against the source page line by line.

Mark the ledger entry `verified`, `uncertain`, or `externally-corroborated`. Secondary sources may clarify unreadable text, but never override legible source text. Record the URL and exact uncertainty when corroboration is used.

Before writing layouts, inventory each page's surfaces: page background, section background, cards, rails, rules, gutters, text hierarchy, images, costs, controls, and repeated alignment relationships. Record their bounds, colors, and exact parent/child topology. Name rows, columns, track counts, spans, and separators; “ordered cards” is not an adequate surface tree for a source grid. Do not infer a parent surface merely from a large patch of one color.

Before writing JDEF, complete the interaction contract for every source Choice. Map source behavior to the native Format 1 primitive first; visual resemblance cannot excuse a generic checkbox/radio substituted for an integer, select, text, continuity, or either-resolution control.

For facsimile work, also complete `facsimileContracts` before authoring. This is the guard against source display typography leaking into Tracker semantics, unconditional possessions disappearing into raster panels, dynamic entities losing their role, live Tags being omitted, and visually related blocks drifting out of alignment.

For every live Choice, separately transcribe its complete semantic description and inventory every stated cost, free entitlement, discount, grant, restriction, override, option domain, and quantity rule. In facsimile mode, preserve an exact contiguous source-effect transcription and the same words in readable live casing before authoring JDEF; a paraphrase or shorter summary fails even when the source panel remains visible. Perform the same inventory for unconditional source prose: durable possessions become Jump-level Items, while unconditional duration, continuity, memory, background, environmental, or local-rule circumstances become Jump-level Traits when they describe the current Jump. Split illustrated kits into separately identified possessions and reconcile every source label and quantity to an exact `kind:Visible Name` grant key; a generic “starting kit” record does not cover six independently granted objects. Every visible perk, item, form, companion, and Trait grant also receives its complete live `description`; a name-only Tracker record fails even when its source panel contains the prose. Text-bearing image-only headers, instructions, transitions, and outcomes need exact full visible transcription in alt text when no equivalent live text exists; topical summaries do not preserve semantics. The panel pixels do not satisfy Tracker semantics, but a complete semantic description does not have to be painted a second time beneath a facsimile panel that already displays the same words. Do not abbreviate Tracker descriptions, invent a convenient maximum, supply options the source never defines, or silently omit an override. Map money/currency as a resource rather than an Item when the source treats it as spendable currency. If Format 1 cannot express a reviewed effect, record a demonstrated gap instead of dropping it.

Final Home/Stay/Next-Jump outcomes are an explicit exception to ordinary source-choice modeling. Preserve their exact prose and visual alternatives, using exact full alt text for facsimile panels, but do not create a Choice, Source, control, selection state, property, or outcome projection. Their non-interactivity is a required acceptance condition and must not be reported as a missing semantic mechanic.

Build a reverse-reference index across the whole source before JDEF. Later pages often say “free for,” “discounted for,” “requires,” or “overrides” an earlier origin, background, item, or perk. Attach each reverse reference to the granting/affected Choice even when the evidence appears on another page. Page-local transcription is not a complete mechanics inventory.

## Semantic classification

Use these durable distinctions consistently:

- Durable ability: `perk` grant.
- Durable possession: `item` grant.
- Acquired person, creature, or Pokémon: `companion` grant.
- Alternate body or state: `form` grant.
- Identity answer such as age, gender, location, or origin: `property` grant.
- Current-Jump circumstance, background effect, drawback, local legal status, or temporary terms: `trait` grant.
- Unconditional source grant: Jump-level `grant`, never an artificial claim Choice.
- Currency modification: `resource` grant or cost, according to the source.

Traits are Jump-local and must not be modeled as chain-wide perks or items. If the source grants a named companion from entered text, interpolate that answer and its source role into the visible companion name, then verify it in the Companions tab. For example, use `"{{species}} (Starter)"`, not a bare `"{{species}}"` plus a generic `Starter` perk. A role belongs in the entity name or description; a perk is reserved for an ability or effect. Preserve separate evidence for the populated input, the contextual Tracker record, and an owned upgrade under that same record when one exists.

Interpolation uses doubled braces around the owning answer or copied Property handle. For example, a text Choice can grant `kind: property`, `handle: species`, then grant one companion with `name: "{{species}}"`. A single-brace string such as `{species}` is literal text and is a failed dynamic-name check.

When one entered identity is priced or classified by several tiers, model the identity input once and the tier selection separately. All tier and upgrade effects must target the same stable grant when Format 1 provides the required reference or interpolation path. Do not create a separate companion merely because each tier has its own Choice. Effects explicitly belonging to a companion or form must use the corresponding ownership target.

Do not turn incidental narrative people, Pokémon, possessions, or scenery into durable Tracker grants unless the source clearly grants them mechanically. Use continuity semantics for an unchanged previous identity when the source makes continuity free; do not replace it with a charged ordinary option.

Do not create controls for final Home/Stay/Next-Jump prose. Format 1 has no meaningful end-choice execution contract; reproduce the prose and visual composition only.

## Handles, groups, Tags, and placement

Use stable snake-case handles based on meaning rather than page position. Preserve direct Choice placements when a Section names particular Choices. Use Choice Sources for a shared selection policy. A `single` source permits zero or one selection; `max` limits a multi-source without creating a default or minimum.

Use groups for authored mechanics such as discounts. Target discounts by group, never by Tags, names, or invented query syntax.

Tags describe effects. Prefer one to three concrete existing built-ins; add a narrow custom Tag only when it improves User filtering. Do not Tag costs, discounts, prerequisites, sections, or redundant grant kinds.

Source documents are not expected to contain Tag strings. “The source supplies no Tag” is never a valid `not-applicable` reason. Derive useful effect Tags from the verified semantics—for example capture, transportation, mobility, medicine, protection, or weapon effects—without merely repeating the grant kind. Use `not-applicable` only when the Choice truly has no meaningful filtering effect.

Classify Tags from the live semantic result, not from the source page's section heading. `World`, `Background`, `Origin`, `Companion`, `Perk`, `Item`, `Form`, `Trait`, `Flaw`, and `Drawback` cannot stand alone as a Choice's useful classification because they merely repeat placement, cost class, or grant kind. Likewise, an entity noun such as `Pokémon` is useful for an effect that broadly operates on Pokémon, but not as the only Tag on a control whose entire purpose is simply naming a Pokémon; use its contextual effect such as `Starter` instead. A Choice that grants spendable currency is a resource effect and does not acquire an `Item` Tag merely because it appears in a Gear section.

Facsimile panels do not make Tags optional. Record a placement decision for every Choice. When Tags apply, include the live `tags` slot in the additive rail, normally between Control and Cost when that space is available. When they do not apply, record the semantic reason.

## Controls, costs, and dynamic content

Treat every control and cost as part of a specific visual relationship:

- Place a cost at the source-authored edge of its card when space exists, commonly in the title row or bottom-right action rail.
- Place a control beside its related text or cost when the source composition supports it. Do not append a full-width control bar by habit.
- Center a control only where the associated content is centered or the source demonstrates centering.
- Make an explicit `control-adornments` decision. Suppress framework borders when the source rail already supplies its boundary.
- Use compact control or cost density only when the full behavior remains legible and operable.
- Do not use compact Cost density on a repeatable Choice that can be discounted: compact ranked Costs hide the resolved total visually. The same-state proof must visibly show the granting Choice plus the affected base-per-unit and resolved-total values; accessible text alone is insufficient visual evidence.
- Preserve roll, clear, rank, selection, validation, keyboard, and accessible-name behavior.

Treat alignment as a relationship, not a vague card property. Record the source bounds for the smallest related group, select the machine-readable relation, and capture corresponding rendered bounds at 1440px. Use a separate record for each repeated row or column. A short phrase sharing a baseline with a neighboring instruction must still share it after the live rail is added. Do not accept “roughly nearby” when the source gives an unambiguous edge or center.

Use direct Choice associations for standalone scalar controls. A Choice Source adds its own activation selector; do not put a scalar Choice in a Source when that selector merely reveals the primary control. Use one `either` Choice when rolling or manually choosing the same value, and use `continuity` when retaining the previous value is free.

Reserved identity properties do not impose an option domain or required selection. In particular, never infer that `gender` is binary, invent Male/Female options, or force an Origin merely because those properties have application-wide meaning. Use native continuity only when the source supplies a finite valid option domain. If the prior value is unknown and the source allows an unrestricted changed value, preserve an optional unrestricted control, charge only an entered change, and demonstrate any inability to project that value back through native continuity as a Format 1 gap.

When the source enumerates a finite manual domain, use a `select` with exactly those options rather than unrestricted text. This is not an invented option list. When an origin, background, or other Choice changes downstream prices or grants, capture the granting Choice and the affected Cost, balance, resource, or Tracker record together in the same active chain state; isolated screenshots do not prove the cross-reference.

For `resolution: either`, preserve ordinary authored costs. The recorded rolled Choice or scalar value receives the native free roll allowance, while a manual result uses the normal cost. Verify both Cost states in Tracker before reporting a pricing gap. Audit every exceptional Source member as well as a representative ordinary member: an option such as Free Pick may make its nested value free without waiving the Source's manual-choice price.

Inspect and screenshot selected, unselected, disabled-at-limit, rolled, manual, discounted, repeated-rank, and negative-cost states. The same Playwright action must assert its resulting value and visible price, record DOM observations, and capture Section-relative card/rail/neighbor bounds; a file named `changed.png` is not proof that anything changed. Discount evidence must keep both the granting Choice and affected resolved Cost visible in one stable chain state. When they are far apart, take readable element crops without changing that state and assemble a labeled comparison sheet with one shared-state observation manifest; never use a full-page screenshot dominated by blank space and microscopic targets. Quantity evidence must keep the rank, aggregate balance/resource effect, and Tracker quantity in one stable chain state. Do not capture while the application displays a loading, preparing, or stale-state indicator. Compare bounds before and after interaction and require empty live-element overlap findings at 1440px, 720px, and 390px. A pick limit must disable only additional selections; it must not resize or stretch remaining controls. Selecting a primary value must not reveal that value's real control behind a generic activation checkbox/radio.

Keep the full working record, including failed experiments, but separate final evidence from rejected evidence. Every file directly under `verification/interactions/` must be referenced by the ledger or by a referenced evidence manifest. Move obsolete, contaminated, loading-state, shell-covered, or otherwise rejected captures under `verification/rejected/` with a short reason; do not leave them beside authoritative captures where a clean-context reviewer can mistake them for proof.

## Assets and crops

Use meaningful alt text describing the relevant image, not its filename or coordinates. For text-bearing image-only content with no equivalent live text, meaningful means the exact full visible wording plus any necessary artwork identity—not a summary. Record every crop's source page, rectangle, purpose, mode, and edge ownership.

Run `crop-assets.mjs` from ledger coordinates. Inspect all four edges and the crop interior. Remove neighboring rules, borders, gutters, and partial glyphs unless they belong to the selected artwork or facsimile panel. Prefer one intact panel. When direct narrow comparison demonstrates that an intact text-bearing panel becomes unreadable, record `panelStrategy: measured-fragments`, every fragment asset, and the measured reason; render every recorded source fragment and preserve their source relationships. A title-only crop containing even a fully bounded fragment of effect prose is contaminated unless that prose is deliberately preserved in another recorded source fragment. Never replace the omitted source fragment with retyped system-font prose. Keep semantic artwork crops separate from facsimile text-bearing panels.

Apply a decomposition strategy consistently across visually equivalent siblings. Do not enlarge one member of a repeated row or card family while leaving equivalent siblings as microscopic strips merely to silence one audit finding. A mixed strategy requires a visible source difference that independently justifies it.

Sample colors from flat interior regions, not antialiased edges. Check text contrast against the actual painted background. Poor contrast is a conversion failure even if the sampled colors are individually accurate.

## Gaps and approximations

Do not declare a gap from memory. First create the smallest valid Format 1 experiment that should express the missing behavior and render it through the real application. A gap exists only when that experiment fails to express the source requirement reasonably.

Search the complete Format 1 reference for interpolation, ownership, continuity, direct placement, and target fields before recording a missing-capability gap. A failed first model is an authoring defect, not evidence of a format limitation.

For each gap, record:

- Stable ID.
- Source page and coordinates.
- Required behavior or visual relationship.
- Minimal syntax attempted.
- Rendered evidence.
- Exact limitation and fidelity loss.
- Chosen transparent approximation.

Never simulate unsupported mechanics with misleading Tags, prose presented as enforcement, or hard-coded assumptions.

## Packaging and handoff

Run `build-and-inspect.ts`; do not hand-zip a distribution archive. Run `capture-and-audit.ts`, update the comparison entries, then run `make-comparison-sheet.mjs`.

Use `capture-and-audit.ts` as the baseline for first-launch dismissal, experience selection, Chain creation, secure import, and responsive capture. If source-specific mechanics need an additional Playwright script, give it the same readiness sequence: wait for local preferences, exit the tour, select an experience, create or open the Chain, wait for secure inspection to finish, then interact. A DOM race or an inferred internal state is not mechanical evidence; leave the ledger check `unreviewed` and continue debugging until the exact visible path passes.

The final response must give:

- Absolute final `.jmp` path.
- Absolute editable project path.
- Source hash and mode.
- Verification status.
- Uncertain transcription entries.
- Remaining gap IDs and their effects.

Leave all source material, extracted pages, crops, ledgers, screenshots, and archives under ignored `scratch/jumpify/`. Do not commit conversion outputs.
