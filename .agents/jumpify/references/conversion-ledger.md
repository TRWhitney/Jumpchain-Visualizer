# Conversion ledger

`ledger.json` is the conversion's source-to-output contract. Preserve existing entries when resuming. `render-source.mjs` scaffolds one `sourcePages` record for every rendered page; fill those records rather than replacing them.

## Coverage fields

- `sourcePages`: exact page number and rendered dimensions, review status, all entry IDs on that page, and reciprocal output Section handles.
- `sections`: stable handle, visible name, source pages represented, one-based rendered order, `incomplete` or `complete` status, and an explicit `surfaceTree` describing the source parent/child composition.
- `mechanics`: one record per exercised interaction path, or one explicit no-interaction review for a prose-only source. Each record has an ID, description, `pass`, `unreviewed`, or `gap:<id>` status, and a workspace-relative evidence file.
- `interactionContracts`: the source-to-native-control contract completed before JDEF authoring. Every source `choice` entry belongs to exactly one contract. Each contract records its Section, canonical Choice or Choice Source, placement, selection, resolution, continuity, pricing policy, required state screenshots and DOM observations, and stable or source-authorized reflow policy.

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

`validate-ledger.mjs --complete` cross-checks the ledger against `pages.json`, crop and package reviews, the archive, the rendered audit, screenshots, DOM observations, and comparison manifest. Missing files, missing pages, missing Sections, missing widths, missing categories, unreviewed mechanics, non-structural facsimile crop seams, overlap/boundary findings, invalid state changes, unstable geometry, or nonreciprocal mappings fail completion.
