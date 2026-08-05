---
name: jumpify-semantic
description: Convert a Jump PDF, PNG/JPEG page, or directory of ordered page images into a live, responsive Format 1 .jmp package. Use only when the user explicitly invokes $jumpify-semantic.
---

# Jumpify Semantic

Create a semantic Format 1 conversion in ignored scratch space. Preserve source content and mechanics while expressing text and composition with live markup. Use images only for irreducible artwork.

## Required references

Read all of these before authoring:

- [Common conversion contract](../../jumpify/references/common-conversion-contract.md)
- [Native interaction mapping](../../jumpify/references/native-interactions.md)
- [Semantic workflow](../../jumpify/references/semantic-workflow.md)
- [Visual acceptance checklist](../../jumpify/references/visual-acceptance.md)
- [Conversion ledger](../../jumpify/references/conversion-ledger.md)
- [Complete Format 1 reference](../../jumpify/references/format-1-authoring.md)

Treat the source as authoritative. Treat `schema/format-1.json` as authoritative if the generated reference and schema ever disagree.

## Workflow

1. Resolve the supplied source path. Accept one PDF, one PNG/JPEG, or a directory containing only naturally ordered PNG/JPEG pages.
2. From the repository root, run:

   ```sh
   node .agents/jumpify/scripts/prepare-workspace.mjs <source> semantic
   node .agents/jumpify/scripts/render-source.mjs <workspace>
   ```

3. Read `extracted/pages/pages.json`, state the total source-page count, and inspect every rendered page before authoring. Populate every scaffolded `sourcePages` record and add the complete output `sections` inventory, including an explicit parent/child `surfaceTree` for each Section. Each source page must have entries and a reciprocal Section mapping.
4. Populate `ledger.json` with page rectangles, first-pass transcription, semantic mapping, surface measurements, asset crops, color samples, comparisons, mechanics, acceptance records, and complete `interactionContracts`. Choose the native Format 1 construct, direct-versus-Source placement, pricing policy, required state observations, and geometry policy before JDEF. Do not begin JDEF after inventorying only a sample or representative page.
5. Transcribe every block a second time against the rendered source. Do not proceed with silent uncertainties.
6. Write editable `project/jump.jdef`, `project/choices.jdef`, and `project/layout.jdef`. Exhaust valid Stack, Inline, Grid, Rule, Text, Image, Slot, growth, tracks, spans, spacing, typography, list, density, alignment, and adornment syntax before declaring a visual gap.
7. Crop only irreducible artwork:

   ```sh
   node .agents/jumpify/scripts/crop-assets.mjs <workspace>
   node .agents/jumpify/scripts/sample-colors.mjs <workspace>
   ```

8. Build only through the application validator:

   ```sh
   corepack pnpm exec tsx .agents/jumpify/scripts/build-and-inspect.ts <workspace>
   ```

9. Start the application preview, then capture the imported archive through the real Tracker path:

   ```sh
   corepack pnpm exec tsx .agents/jumpify/scripts/capture-and-audit.ts <workspace> http://127.0.0.1:4173
   node .agents/jumpify/scripts/make-comparison-sheet.mjs <workspace>
   ```

10. Compare every Section directly at 1440px, 720px, and 390px. Fix every visible mismatch or record a demonstrated gap. Repeat build, capture, and comparison until all acceptance records pass.
11. Exercise rolled/manual pricing, continuity, exclusive and limited Sources, repeated ranks, discounts, locks, grants, Traits, companions, dynamic names, controls, and final prose as applicable. Capture every `interactionContracts` state. In the same Playwright action, assert the resulting value and visible price and write the DOM observation for control kind/value, activation layers, resolved costs, Section-relative card/rail/neighbor bounds, and overlaps. Never use a fallback action without asserting its postcondition or treat differently named screenshots as proof. Reuse the readiness sequence established by `capture-and-audit.ts`; never convert a first-launch race or inferred state into a passing ledger record. After the final evidence or ledger edit, rerun `make-comparison-sheet.mjs` so `review-evidence.json` is current.
12. Require the completed ledger before handoff:

```sh
node .agents/jumpify/scripts/validate-ledger.mjs <workspace> --complete
```

## Hard stops

Do not finish while any of these remain:

- Rasterized text or card composition without a demonstrated syntax failure.
- Unverified or omitted source blocks.
- Overflow, clipping, crossed borders, merged cards, incorrect rules, background seas, poor contrast, contaminated crops, weak hierarchy, misplaced costs, or detached control rails.
- Controls for Home, Stay, or Next-Jump prose.
- Generic checkbox/radio activation in place of a native scalar, continuity, or either-resolution control.
- A scalar input repeated across tier, rarity, price, or classification Choices instead of one direct scalar owner that creates the stable grant exactly once plus toggle tiers; duplicated tier grants, untargeted upgrades for that entity, or any non-toggle Source member without a source-evidenced two-stage contract.
- Any interaction that unexpectedly reveals its primary control or shifts neighboring layout after selection.
- Any action whose observed value or resolved Cost does not prove the named state, any live-element overlap at 1440/720/390, or any stable-contract bound changing by more than one CSS pixel.
- Package warnings, errors, missing alt text, or unexercised mechanics.
- Any source page, output Section, required width, acceptance category, comparison sheet, or evidence file missing from the ledger.
- A missing, stale, or hand-edited `review-evidence.json`.
- A partial package offered because the source is large or the current turn is ending. Resume and continue instead.

## Handoff

Report the absolute archive and project paths, source hash, verification result, uncertain transcription, remaining gap IDs, and a source-page coverage table naming the mapped Sections and comparison evidence. Do not commit anything under `scratch/`.
