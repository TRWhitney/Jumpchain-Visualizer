# Conversion ledger

`ledger.json` is the conversion's source-to-output contract. Preserve existing entries when resuming. `render-source.mjs` scaffolds one `sourcePages` record for every rendered page; fill those records rather than replacing them.

## Coverage fields

- `sourcePages`: exact page number and rendered dimensions, review status, all entry IDs on that page, and reciprocal output Section handles.
- `sections`: stable handle, visible name, source pages represented, one-based rendered order, `incomplete` or `complete` status, and an explicit `surfaceTree` describing the source parent/child composition.
- `mechanics`: one record per exercised interaction path, or one explicit no-interaction review for a prose-only source. Each record has an ID, description, `pass`, `unreviewed`, or `gap:<id>` status, and a workspace-relative evidence file.
- `interactionContracts`: the source-to-native-control contract completed before JDEF authoring. Every source `choice` entry belongs to exactly one contract. Each contract records its Section, canonical Choice or Choice Source, placement, selection, resolution, continuity, pricing policy, required state screenshots and DOM observations, and stable or source-authorized reflow policy.
- `reviewEvidence`: always `verification/review-evidence.json`. `make-comparison-sheet.mjs` generates this clean-context review input from the factual parts of the ledger. It includes every interaction state and numeric DOM observation plus a complete inventory of authoritative interaction files, including captures referenced transitively by an authoritative observation JSON, but excludes acceptance statuses, gaps, and earlier reviewer verdicts.
- `facsimileContracts`: facsimile-only authoring checks completed before JDEF. They separate semantic names from source display text, inventory every unconditional Jump grant, specify dynamic entity names and owned upgrades, decide live Tag placement for every Choice, and measure repeated alignment relationships.

Every rendered source page must appear exactly once, contain at least one entry, and map to at least one output Section. Every Section must have one comparison and all six acceptance categories at 1440px, 720px, and 390px. Facsimile mode additionally requires at least one packaged panel asset from every page and one matching packaged panel crop for every source `choice` entry; the entry and crop rectangles must be identical. This prevents a collection-sized raster from replacing distinct interactive cards. Semantic mode prohibits panel assets.

For an interactive contract, `owner` is `choice` or `choice-source`; `prose` is reserved for source material intentionally kept non-interactive. `placement` is `direct`, `source`, or `none`. Record the exact canonical `selection`, `resolution`, and `continuity` values, using `source-members` or `none` where the field belongs to a Source or prose.

A non-toggle Choice placed through a Source has two control layers. It requires a second Choice contract with `sourceHandle` and `sourceActivation`, naming the distinct first-stage decision, explaining why direct placement cannot represent it, and pointing to source PNG evidence. This nested contract does not replace the Source contract or consume the entry's primary coverage. Omit `sourceActivation` for ordinary Source-member toggles and all direct Choices. Repeated scalar fields across tiers or prices are not a source-authored two-stage interaction: create one direct scalar owner and separate toggle tier Choices.

Every canonical Choice Source requires exactly one `owner: choice-source` contract, even when its member Choices have additional contracts. This records and validates group mode, resolution, limits, and state behavior instead of checking only individual member controls.

State records use `unset`, `selected`, `manual`, `rolled`, `changed`, `limit-disabled`, `ranked`, `prose`, or `custom` and point to PNG evidence. Each state also records an `observation` written from the DOM by the same Playwright run: the primary control kind and value, any activation controls, matching resolution status, resolved resource costs, whether the requested action succeeded, Section-relative surface/rail/neighbor bounds, and detected overlaps. Do not type observations from expectation or infer them from JDEF. Bounds smaller than four CSS pixels are rejected as placeholders.

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

`semanticNames` contains one record for every canonical Choice: its handle, source entry, exact display name, semantic name, exact contiguous `sourceEffectText`, the same wording in readable `liveDescription` casing, and an exceptional `intentionalAllCaps` flag for genuine acronyms. Copy the complete effect prose while excluding only the display name, standalone Cost, and mechanically modeled discount/free label; do not summarize it. The source-effect text must occur in the entry transcription, and the canonical Choice description must contain the same words in the same order. The package gate rejects source display capitalization copied into ordinary semantic names. The semantic name must occur in the source entry transcription after ignoring case and punctuation; a concept clarified by the source's own effect prose is therefore valid. When semantic wording differs from the display heading beyond case and punctuation, record the evidenced decision in `normalizationNote` instead of silently rewriting it. If the proposed semantic name does not occur anywhere in the entry transcription, preserve the source wording unless the Developer explicitly authorized the change and quote that authorization in `developerAuthorization`. Apparent typos remain source-authoritative; filenames, handles, conventional grammar, and an agent's confidence are never evidence that the source pixels are wrong. The optional `panelStrategy` defaults to `intact`. Use `measured-fragments` only after direct narrow comparison demonstrates unreadable intact text; then list every packaged fragment output in `sourcePanelAssets` and record the measured `decompositionReason`. Every fragment must lie inside the source entry and be rendered by the Choice layout.

`grantInventory.entryDecisions` contains exactly one explicit decision for every prose and Choice entry. Each decision records one or more dispositions—`jump-grant`, `choice-grant`, `shared-choice-grant`, or `no-grant`—and a source-specific reason. `no-grant` cannot be combined with another disposition. Every `jump-grant` decision also lists `grantKeys` in exact `kind:Visible Name` form; those keys must reconcile one-for-one with every `grantInventory.grants` record produced by that entry. Split an illustrated starting kit into one source entry per independently labeled possession whenever possible. If several possessions genuinely share one indivisible source block, list every one in that block's `grantKeys`; never summarize the block as one “kit” grant. A shared introduction effect inherited by several Choices is `shared-choice-grant`; that decision also records the exact contiguous `sharedEffectText` and every affected Choice in `targetHandles`. The package gate verifies that every target grants a Trait whose description contains that shared effect, so copying only each card's individual prose is incomplete. `sourceEntryIds` then names exactly the entries that produced direct Jump grants, and those entries must have `jump-grant` decisions. Each Jump grant includes the complete contiguous source-derived live description expected on the canonical grant. Set the inventory to `complete` only after checking introductory prose, illustrated starting kits, and every later rule block for both durable grants and Jump-local Traits. Explicitly consider duration, stopped home time, retained memory, moral or cognitive carryover, background/environmental circumstances, population and travel assumptions, authority responses, and local restrictions. A statement that remains true during the Jump is a Trait candidate even when it appears in introductory world prose rather than a card. Durable possessions are Items. Counts belong in the visible Item name when no owning quantity control exists. A name-only Tracker record does not preserve an effect already printed in source pixels.

`dynamicEntities` records the owning Choice, stable grant handle, visible interpolation template, contextual role, and upgrades targeting the entity. Preserve separate evidence for the populated creation control, the resulting contextual name in the Companions or Forms Tracker tab, and—when upgrades exist—the owned upgrade under that same record. A context-free `"{{answer}}"` is insufficient when the source identifies the entity as a starter, partner, vehicle, or other role, and a control screenshot alone is not Tracker evidence.

`tagPlacements` contains one decision per Choice. A placed decision records the exact Tag strings, Choice layout, and semantic rail order. When Control, Tags, and Cost all exist, use the available middle space in `control`, `tags`, `cost` order; another order requires a source- or measurement-based `reason`. A `not-applicable` decision requires a semantic reason.

`alignmentRelationships` records the smallest testable group of entry IDs, one machine-readable relation, their exact ledger rectangles, corresponding 1440px rendered rectangles, tolerances, evidence, and result. Supported relations are same row/column, matching left/right/top/bottom edge, matching horizontal/vertical center, and equal width/height. Split repeated grids into one relationship per source row or column instead of describing six rows in one prose record. The completion gate recalculates the declared relation, rejects stacked cards recorded as a source row, and automatically preserves every stricter edge, center, width, or height relationship demonstrated by those same source rectangles. Choosing the weakest relation cannot excuse uneven rendered cards. Use these records for paired scalar prompts, repeated cards, headings aligned with side notes, and any visually unambiguous relationship a rail or responsive container could disturb.

`independentReview` records a clean-context agent or independent human review performed after all screenshots and comparison sheets exist. The reviewer receives the source, rendered evidence, and visual checklist but not the converter's expected answers or acceptance statuses. Preserve every finding with evidence. Completion requires a passing review and no open finding; resolving findings requires a fresh capture and review rather than a prose assertion.

Evidence under `verification/interactions/` is authoritative and must be referenced by the ledger or by a referenced observation manifest. Ordinary `validate-ledger.mjs` validation rejects unreferenced files here before independent review; this check is not deferred to `--complete`. Move superseded, partial, wrong-state, or otherwise rejected captures under `verification/rejected/`; do not leave them beside current evidence where a reviewer could mistake them for proof. Interaction crops and comparison sheets must come from the same captured state, be bounded closely enough to read the relevant control and result, and carry their shared state in the referenced manifest.

An independent reviewer reads `verification/review-evidence.json`, never `ledger.json`. The generated manifest makes the observations reviewable without revealing the converter's conclusions. Its `sourceGrantReconciliation` exposes only the source page, rectangle, transcription, and declared `grantKeys` for each unconditional-grant block so the reviewer can independently count source possessions and compare them with Tracker inventory. Regenerate it after any interaction, mechanic, dynamic-entity, grant-inventory, or Tag-placement evidence changes; completion rejects a stale or hand-edited projection.

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
