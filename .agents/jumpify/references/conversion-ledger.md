# Conversion ledger

`ledger.json` is the conversion's source-to-output contract. Preserve existing entries when resuming a schema-version-4 workspace. Do not resume or hand-edit a schema-version-3 workspace into version 4: start a fresh numbered workspace from the authoritative source because clause decisions, crop measurements, interaction observations, and independent-review evidence cannot be safely inferred or auto-migrated. `render-source.mjs` scaffolds one `sourcePages` record for every rendered page; fill those records rather than replacing them.

## Coverage fields

- `sourcePages`: exact page number and rendered dimensions, review status, all entry IDs on that page, and reciprocal output Section handles.
- `sections`: stable handle, visible name, source pages represented, one-based rendered order, `incomplete` or `complete` status, and an explicit `surfaceTree` describing the source parent/child composition.
- `mechanics`: one record per exercised interaction path, or one explicit no-interaction review for a prose-only source. Each record has an ID, description, `pass`, `unreviewed`, or `gap:<id>` status, and a workspace-relative evidence file.
- `interactionContracts`: the source-to-native-control contract completed before JDEF authoring. Every source `choice` entry belongs to exactly one contract. Each contract records its Section, canonical Choice or Choice Source, placement, selection, resolution, continuity, pricing policy, required state screenshots and DOM observations, and stable or source-authorized reflow policy.
- `reviewEvidence`: always `verification/review-evidence.json`. `make-comparison-sheet.mjs` generates this clean-context review input from the factual parts of the ledger. It includes every interaction state and numeric DOM observation plus a complete inventory of authoritative interaction files, including captures referenced transitively by an authoritative observation JSON, but excludes acceptance statuses, gaps, and earlier reviewer verdicts.
- `facsimileContracts`: facsimile-only authoring checks completed before JDEF. They separate semantic names from source display text, classify each source clause and inventory every unconditional Jump grant, resolve repeated entities, specify dynamic entity names/classification Sources/owned upgrades, decide live Tag placement and exceptional cardinality review, and measure repeated alignment relationships.

Every rendered source page must appear exactly once, contain at least one entry, and map to at least one output Section. Every Section must have one comparison and all six acceptance categories at 1440px, 720px, and 390px. Facsimile mode additionally requires at least one packaged panel asset from every page and one matching packaged panel crop for every source `choice` entry; the entry and crop rectangles must be identical. This prevents a collection-sized raster from replacing distinct interactive cards. Semantic mode prohibits panel assets.

For an interactive contract, `owner` is `choice` or `choice-source`; `prose` is reserved for source material intentionally kept non-interactive. `placement` is `direct`, `source`, or `none`. Record the exact canonical `selection`, `resolution`, and `continuity` values, using `source-members` or `none` where the field belongs to a Source or prose.

A non-toggle Choice placed through a Source has two control layers. It requires a second Choice contract with `sourceHandle` and `sourceActivation`, naming the distinct first-stage decision, explaining why direct placement cannot represent it, and pointing to source PNG evidence. This nested contract does not replace the Source contract or consume the entry's primary coverage. Omit `sourceActivation` for ordinary Source-member toggles and all direct Choices. Repeated scalar fields across tiers or prices are not a source-authored two-stage interaction: create one direct scalar owner and separate toggle tier Choices.

Every canonical Choice Source requires exactly one `owner: choice-source` contract, even when its member Choices have additional contracts. This records and validates group mode, resolution, limits, and state behavior instead of checking only individual member controls.

State records use `unset`, `selected`, `manual`, `rolled`, `changed`, `limit-disabled`, `ranked`, `prose`, or `custom` and point to PNG evidence. Each state also records an `observation` written from the DOM by the same Playwright run: the primary control kind and value, any activation controls, matching resolution status, resolved resource costs, whether the requested action succeeded, Section-relative surface/rail/neighbor bounds, and detected overlaps. For a text Choice, the manual observation must contain a nonempty string different from the unset value; `actionSucceeded`, a placeholder, or a differently named PNG does not prove typed input. Do not type observations from expectation or infer them from JDEF. Bounds smaller than four CSS pixels are rejected as placeholders.

Set `pricing` to `rolled-free`, `continuity-change`, `ordinary`, or `none`. Completion rejects a rolled-free contract unless the captured manual state costs more than zero and the rolled state costs zero. It rejects a continuity-change contract unless the changed value differs from the unset continuity value and has a nonzero captured cost.

`geometry.policy` is normally `stable`; use `intentional-source-reflow` only when the source visibly expands, and identify that source behavior in the note. For a stable contract, every recorded surface, rail, and neighbor coordinate must remain within one CSS pixel of the unset state. The geometry evidence must be a tightly cropped PNG that makes those same bounds directly reviewable.

Example for a direct roll-or-manual Age control:

```json
{
  "id": "age_control",
  "entryIds": ["identity_age"],
  "sourcePage": 3,
  "sourceBehavior": "Roll 1d8+9 for free or manually choose the same age for 100 CP.",
  "section": "identity",
  "owner": "choice",
  "handle": "age",
  "placement": "direct",
  "selection": "integer",
  "resolution": "either",
  "continuity": "none",
  "pricing": "rolled-free",
  "states": [
    {
      "name": "unset",
      "evidence": "verification/interactions/age-unset.png",
      "observation": {
        "controlKind": "number",
        "controlValue": null,
        "activationControlKinds": [],
        "resolutionStatus": "unset",
        "resolvedCosts": { "jump_points": 100 },
        "actionSucceeded": false,
        "bounds": {
          "surface": { "x": 0, "y": 0, "width": 640, "height": 52 },
          "rail": { "x": 0, "y": 28, "width": 640, "height": 24 }
        },
        "overlaps": []
      }
    },
    {
      "name": "manual",
      "evidence": "verification/interactions/age-manual.png",
      "observation": {
        "controlKind": "number",
        "controlValue": 12,
        "activationControlKinds": [],
        "resolutionStatus": "manual",
        "resolvedCosts": { "jump_points": 100 },
        "actionSucceeded": true,
        "bounds": {
          "surface": { "x": 0, "y": 0, "width": 640, "height": 52 },
          "rail": { "x": 0, "y": 28, "width": 640, "height": 24 }
        },
        "overlaps": []
      }
    },
    {
      "name": "rolled",
      "evidence": "verification/interactions/age-rolled.png",
      "observation": {
        "controlKind": "number",
        "controlValue": 15,
        "activationControlKinds": [],
        "resolutionStatus": "rolled",
        "resolvedCosts": { "jump_points": 0 },
        "actionSucceeded": true,
        "bounds": {
          "surface": { "x": 0, "y": 0, "width": 640, "height": 52 },
          "rail": { "x": 0, "y": 28, "width": 640, "height": 24 }
        },
        "overlaps": []
      }
    }
  ],
  "geometry": {
    "policy": "stable",
    "evidence": "verification/interactions/age-geometry.png",
    "note": "The card, rail, neighboring Gender card, and Section retain their bounds."
  }
}
```

## Entry fields

- `id`: stable snake-case identifier.
- `page`: one-based source page.
- `rect`: integer `{x,y,width,height}` in rendered-page pixels.
- `sourceKind`: `prose`, `choice`, `artwork`, `rule`, `heading`, or `decoration`.
- `transcription`: exact text for prose, choices, and headings.
- `verification`: `unreviewed`, `verified`, `uncertain`, or `externally-corroborated`.
- `corroboration`: optional URL and note.
- `handles`: Format 1 handles representing the block.
- `semantic`: object recording grant kind, selection behavior, costs, groups, and ownership.
- `presentation`: object recording surface, layout, typography, colors, rules, and action-rail decisions.
- `approximation`: `none` or a stable gap ID.

## Facsimile contracts

Every `grantInventory.entryDecisions` record identifies one prose or Choice entry and contains a nonempty `clauses` array. Each semantically distinct clause quotes its own exact `sourceEvidence`, classifies its `semanticForce` as explicit grant, retained-existing possession, narrative, current-Jump rule, conditional Choice effect, mechanical instruction, or presentation, records its dispositions and reason, and owns only the keys/effects produced by that clause. Do not assign one force to an entry that mixes, for example, retained possessions with newly supplied possessions. Only an explicit-grant or current-Jump-rule clause may use `jump-grant` or own unconditional `grantKeys`. A noun appearing in prose is not itself evidence of a grant.

`choiceGrantSemantics` contains exactly one record for every canonical grant under every Choice. It identifies the owning Choice and grant index, source entry, exact source evidence, contextual effect role, and reasoning. Match roles to kinds: acquisition to Companion/Form, classification or identity to Property, enhancement or ability to Perk, possession to Item, form to Form, current-Jump circumstance to Trait, and resource change to Resource. These are contextual roles, not label dictionaries: a “tier” can classify an entity in one source and grant an ability in another. One Choice may require multiple records and grants when separate clauses play separate roles—for example, a classification Property plus an explicit targeted enhancement Perk. When a classification is visibly projected in an entity name, record `projection: entity-name` and the stable subject grant so the gate can verify interpolation.

`referentResolutions` records ambiguous cross-entry mentions of people, creatures, objects, and forms. Quote the actual ambiguous mention and enough contiguous surrounding words to show the relationship; a bare repeated noun or a different occurrence of the noun in the same entry is not resolving evidence. Decide whether it is the same entity, a genuinely additional entity, or narrative only. A same/new entity resolution targets exactly one canonical owner shape: either `targetChoiceHandle` plus `targetGrantHandle`, or an exact indexed direct `targetJumpGrantRef`. Missing, mixed, nonexistent, or unrelated targets fail.

Before calling an entity new, compare it with every dynamic entity of the same canonical kind in `comparedDynamicEntityRefs`, using exact `choiceHandle:grantHandle` references so multiple dynamic entities owned by one Choice remain distinct. Quote `distinctnessEvidence` and classify its source-grounded `distinctnessBasis` as explicit additionality, an independent slot/count, simultaneous possession, or an incompatible source identity. Mere chronology ("before the later section"), an origin story, or verbs such as joins, follows, is rescued, is inherited, or is taken along do not prove an additional entity. Do not infer the basis from an English keyword alone; judge the complete clause in context, including non-English sources and alternate wording. When mutually exclusive backgrounds each introduce one entity in the same functional role and a later singular Section defines or classifies that role, the strong default is one continuous entity: point each earlier mention at the later dynamic grant and do not add background-specific grants. A distinct conclusion without explicit source evidence fails.

The canonical audit derives continuity coverage from the actual JDEF. Every non-dynamic Choice-owned Companion/Form grant that coexists with a same-kind dynamic entity must have exactly one `new-entity` resolution targeting its Choice and grant handle. Every direct Jump/prose-owned Companion/Form grant in the same situation must have exactly one resolution targeting its exact indexed `targetJumpGrantRef`, such as `jump:2:companion:Guide`. Its `grantInventory.grants` record carries the same `canonicalGrantRef`, binding that exact canonical index to the source entry even when two grants share a kind and name. Omitting the record cannot bypass review, and a `same-entity` resolution cannot coexist with the extra grant it claims is identical. Use the complete source and reverse-reference pass; do not create duplicate grants from narrative setup and a later defining Choice.

Use one to five effect Tags for every visible grant and taggable Choice. Record an effect-by-effect `tagRationale` on each placed Choice and unconditional grant, and on each visible Choice grant's semantic record. A substantial conversion with exactly one Tag on every Choice or grant fails as a presumptively mechanical bulk assignment unless the effects genuinely have only one useful filtering dimension. In that exceptional case, add `tagCardinalityReview` with `status: justified`, exact complete `choiceHandles` and owner/index-qualified `grantRefs` arrays for every all-one set under review, and an effect-specific `reason`. A Jump grant ref is `jump:<index>:<kind>:<name>`; a Choice grant ref is `choice:<choiceHandle>:<grantIndex>:<kind>:<name>`. The reviewed arrays must exactly match the affected canonical Choices and visible grants, including duplicate-named grants; an incomplete review cannot excuse uniform tagging.

Schema-version-2 `crop-audit.json` is bound to the complete current source and asset contract. Its source hash, IDs, page, rectangle, output, package state, alt text, interior metric, and all four edge metrics must be present and reconcile with `assets`; regenerate crops and the audit after the source, crop tool, or any asset value changes. A stale or metric-stripped audit is not evidence.

`semanticNames` contains one record for every canonical Choice: its handle, source entry, exact display name, semantic name, exact contiguous `sourceEffectText`, the same wording in readable `liveDescription` casing, and an exceptional `intentionalAllCaps` flag for genuine acronyms. Copy the complete effect prose while excluding only the display name, standalone Cost, and mechanically modeled discount/free label; do not summarize it. The source-effect text must occur in the entry transcription, and the canonical Choice description must contain the same words in the same order. The package gate rejects source display capitalization copied into ordinary semantic names. The semantic name must occur in the source entry transcription after ignoring case and punctuation; a concept clarified by the source's own effect prose is therefore valid. When semantic wording differs from the display heading beyond case and punctuation, record the evidenced decision in `normalizationNote` instead of silently rewriting it. If the proposed semantic name does not occur anywhere in the entry transcription, preserve the source wording unless the Developer explicitly authorized the change and quote that authorization in `developerAuthorization`. Apparent typos remain source-authoritative; filenames, handles, conventional grammar, and an agent's confidence are never evidence that the source pixels are wrong. The optional `panelStrategy` defaults to `intact`. Use `measured-fragments` only after direct narrow comparison demonstrates unreadable intact text; then list every packaged fragment output in `sourcePanelAssets` and record the measured `decompositionReason`. Every fragment must lie inside the source entry and be rendered by the Choice layout.

`grantInventory.entryDecisions` contains exactly one entry record for every prose and Choice entry, and every entry record contains one or more clause decisions. Each clause records one or more dispositions—`jump-grant`, `choice-grant`, `shared-choice-grant`, or `no-grant`—plus its own semantic force, exact evidence, and source-specific reason. `no-grant` cannot be combined with another disposition in the same clause. Every `jump-grant` clause also lists its complete `grantKeys` in exact `kind:Visible Name` form; keys are forbidden on clauses without `jump-grant`, and every key must reconcile one-for-one with the `grantInventory.grants` records produced by that clause's entry. No key may appear under more than one clause. Split an illustrated starting kit into one source entry per independently labeled possession whenever possible. If several possessions genuinely share one indivisible source block, list each key under the exact explicit-grant/current-Jump-rule clause that produces it; never summarize the block as one “kit” grant or attach retained possessions to a neighboring explicit clause. A shared introduction effect inherited by several Choices is `shared-choice-grant`; that clause also records the exact contiguous `sharedEffectText` and every affected Choice in `targetHandles`. The package gate verifies that every target grants a Trait whose description contains that shared effect, so copying only each card's individual prose is incomplete. `sourceEntryIds` then names exactly the entries containing at least one clause that produced direct Jump grants. Each Jump grant includes the complete contiguous source-derived live description expected on the canonical grant. Set the inventory to `complete` only after checking introductory prose, illustrated starting kits, and every later rule block for both durable grants and Jump-local Traits. Explicitly consider duration, stopped home time, retained memory, moral or cognitive carryover, background/environmental circumstances, population and travel assumptions, authority responses, and local restrictions. A statement that remains true during the Jump is a Trait candidate even when it appears in introductory world prose rather than a card. Durable possessions are Items. Counts belong in the visible Item name when no owning quantity control exists. A name-only Tracker record does not preserve an effect already printed in source pixels.

`dynamicEntities` records the direct scalar owning Choice, stable grant handle, visible interpolation template, contextual role, classification Choices, and upgrades targeting the entity. `classificationChoiceHandles` is always present. Leave it empty only when no mutually exclusive source Choices classify that entity. Otherwise `classificationSourceHandle` names one single-select Source whose complete canonical membership exactly equals the classification handle set. The scalar name/species/identity owner remains a separate direct Choice above that Source and cannot be one of its members. Every classification member is independently selectable through that Source, grants the shared `classificationPropertyHandle`, declares an `entity-classification` semantic projected into the entity name, and supplies its own explicit source-authored value; omission cannot copy a toggle boolean. The visible template interpolates the selected Property value. Preserve separate evidence for the populated creation control, the resulting contextual name in the Companions or Forms Tracker tab, and—when upgrades exist—the correctly owned upgrade under that same record. When earlier same-entity referents point at the dynamic grant, also provide `continuityEvidence` from one combined state that activates the earlier source Choice, populates the dynamic control, and proves the Tracker contains one continuous record rather than an earlier grant plus a later duplicate. Companion upgrades use `companion` ownership and Form upgrades use `form` ownership. A context-free `"{{answer}}"`, a fixed label that replaces the selected classification, a repeated scalar input, a grantless tier selector, or separate origin-specific entity grants is insufficient, and a control screenshot alone is not Tracker evidence.

`tagPlacements` contains one decision per Choice. A placed decision records the exact Tag strings, Choice layout, and semantic rail order. When Control, Tags, and Cost all exist, use the available middle space in `control`, `tags`, `cost` order; another order requires a source- or measurement-based `reason`. A `not-applicable` decision requires a semantic reason.

`alignmentRelationships` records the smallest testable group of entry IDs, one machine-readable relation, their exact ledger rectangles, corresponding 1440px rendered rectangles, tolerances, evidence, and result. Supported relations are same row/column, matching left/right/top/bottom edge, matching horizontal/vertical center, and equal width/height. Split repeated grids into one relationship per source row or column instead of describing six rows in one prose record. The completion gate recalculates the declared relation, rejects stacked cards recorded as a source row, and automatically preserves every stricter edge, center, width, or height relationship demonstrated by those same source rectangles. Choosing the weakest relation cannot excuse uneven rendered cards. Use these records for paired scalar prompts, repeated cards, headings aligned with side notes, and any visually unambiguous relationship a rail or responsive container could disturb.

`independentReview` records a clean-context agent or independent human review performed after all screenshots and comparison sheets exist. The reviewer receives the source, rendered evidence, and visual checklist but not the converter's expected answers or acceptance statuses. Because source meaning cannot be reduced to an English keyword rule, the reviewer must independently adjudicate every `new-entity` record as supported or unsupported after comparing its evidence, basis, exact target, and same-kind dynamic candidates. `entityContinuityReviews` reconciles exactly with those records and cites the raw report; a converter-authored basis label is never proof by itself. A pre-review build with `status: unreviewed` may leave this array empty so the archive and captures needed by the reviewer can be produced. Once review begins—and always at completion—the adjudication set must reconcile exactly. Preserve every finding with evidence. Completion requires a passing review, supported entity-continuity adjudications, and no open finding; resolving findings requires a fresh capture and review rather than a prose assertion.

Evidence under `verification/interactions/` is authoritative and must be referenced by the ledger or by a referenced observation manifest. Ordinary `validate-ledger.mjs` validation rejects unreferenced files here before independent review; this check is not deferred to `--complete`. Move superseded, partial, wrong-state, or otherwise rejected captures under `verification/rejected/`; do not leave them beside current evidence where a reviewer could mistake them for proof. Interaction crops and comparison sheets must come from the same captured state, be bounded closely enough to read the relevant control and result, and carry their shared state in the referenced manifest.

An independent reviewer reads `verification/review-evidence.json`, never `ledger.json`. The generated manifest makes the observations reviewable without revealing the converter's conclusions. Its `sourceGrantReconciliation` exposes the source page, rectangle, transcription, and each unconditional clause's exact evidence and declared `grantKeys` so the reviewer can independently distinguish mixed prose, count source grants, and compare them with Tracker inventory. Its `referentResolutions` and `dynamicEntities` expose every continuity claim and evidence path for independent semantic adjudication. Regenerate it after any interaction, mechanic, dynamic-entity, grant-inventory, referent-resolution, Tag-placement, or Tag-cardinality-review evidence changes; completion rejects a stale or hand-edited projection.

## Asset fields

Each `assets` entry provides `id`, `page`, `rect`, `output`, `kind`, `alt`, `package`, and `edgeOwnership`. `edgeOwnership` must explicitly describe `top`, `right`, `bottom`, and `left`. `kind` is `artwork` for semantic crops or `panel` for facsimile crops.

For a completed facsimile, `verification/crop-audit.json` must account for every packaged asset. Adjacent sibling crops that meet on a vertical source coordinate must both report a clean structural edge along that seam. A non-structural seam indicates that shared content may have been bisected; move the shared content to a parent crop rather than asserting ownership in prose.

## Color samples

Each `colorSamples` entry provides `id`, `page`, `x`, `y`, and optional `radius`. Sample flat interior regions.

## Comparisons

Each `comparisons` entry provides `id`, output `section`, required `width`, `sourcePage`, optional `sourceRect`, and a workspace-relative `renderPath`. Use one entry per Section and required width. The comparison tool scales the source and render to the same display width.

## Acceptance records

Use exactly six records per Section and width:

```json
{
  "section": "region",
  "width": 1440,
  "check": "text",
  "status": "pass",
  "evidence": "verification/rendered/1440-section-02.png",
  "note": "No clipping; wrapping and hierarchy checked against the equal-width sheet."
}
```

The required checks are `structure-and-surfaces`, `text`, `artwork-and-crops`, `costs-and-controls`, `content-and-semantics`, and `responsive-fit`. Allowed statuses are `pass`, `fail`, `unreviewed`, and `gap:<id>`.

## Gap records

Record `id`, requirement, minimal syntax experiment, rendered evidence, limitation, fidelity loss, and chosen approximation. Never use a gap record to excuse an unattempted layout, an incomplete package, lack of time, or a first unsuccessful model.

## Completion gate

`validate-ledger.mjs --complete` cross-checks the ledger against `pages.json`, crop and package reviews, the archive, the rendered audit, screenshots, DOM observations, and comparison manifest. Missing files, missing pages, missing Sections, missing widths, missing categories, unreviewed mechanics, non-structural facsimile crop seams, overlap/boundary findings, invalid state changes, unstable geometry, unreferenced authoritative interaction evidence, or nonreciprocal mappings fail completion.
