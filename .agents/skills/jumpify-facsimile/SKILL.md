---
name: jumpify-facsimile
description: Convert a Jump PDF, PNG/JPEG page, or directory of ordered page images into a measured-panel Format 1 .jmp facsimile with live mechanics and controls. Use only when the user explicitly invokes $jumpify-facsimile.
---

# Jumpify Facsimile

Create a facsimile Format 1 conversion in ignored scratch space. Preserve measured source panels while keeping costs, controls, Tags, grants, and Tracker behavior live.

## Required references

Read all of these before authoring:

- [Common conversion contract](../../jumpify/references/common-conversion-contract.md)
- [Native interaction mapping](../../jumpify/references/native-interactions.md)
- [Facsimile workflow](../../jumpify/references/facsimile-workflow.md)
- [Visual acceptance checklist](../../jumpify/references/visual-acceptance.md)
- [Conversion ledger](../../jumpify/references/conversion-ledger.md)
- [Complete Format 1 reference](../../jumpify/references/format-1-authoring.md)

Treat the source as authoritative. Treat `schema/format-1.json` as authoritative if the generated reference and schema ever disagree.

## Workflow

1. Resolve the supplied source path. Accept one PDF, one PNG/JPEG, or a directory containing only naturally ordered PNG/JPEG pages.
2. From the repository root, run:

   ```sh
   node .agents/jumpify/scripts/prepare-workspace.mjs <source> facsimile
   node .agents/jumpify/scripts/render-source.mjs <workspace>
   ```

3. Read `extracted/pages/pages.json`, state the total source-page count, and inspect every rendered page before authoring. Populate every scaffolded `sourcePages` record and add the complete output `sections` inventory, including an explicit parent/child `surfaceTree` for each Section. Each source page must have verified entries, at least one packaged panel, and a reciprocal Section mapping.
4. Populate `ledger.json` with verified transcription, mechanics, measured panel rectangles, edge ownership, palette samples, comparisons, action-rail placement, and acceptance records. Complete every `interactionContracts` record before JDEF: choose the native Format 1 construct, direct-versus-Source placement, pricing policy, required states, and geometry policy. Do not begin JDEF after inventorying only a sample or representative page.
5. Crop deliberate panels and sample colors:

   ```sh
   node .agents/jumpify/scripts/crop-assets.mjs <workspace>
   node .agents/jumpify/scripts/sample-colors.mjs <workspace>
   ```

6. Inspect all four edges of every crop. Remove neighboring gutters, borders, rules, and partial glyphs. Give every source Choice entry its own matching measured panel; never replace independent cards with one collection image and duplicate live expansions beneath it. Do not use arbitrary whole-page images where independent panels are required. Never split a shared heading, sentence, rule, band, or word between sibling crops: place shared content in one parent crop, then crop each child below or inside that boundary. Re-read rasterized text in rendered order at 720px and 390px so a desktop seam cannot hide separated sentence fragments.
7. Write editable `project/jump.jdef`, `project/choices.jdef`, and `project/layout.jdef`. Retain verified live names, descriptions, costs, Tags, grants, ownership, selections, and controls beneath the visual panels. Use direct Choice associations for standalone scalar controls; never place a scalar Choice in a Source merely to obtain an activation checkbox or radio.
8. Compose compact additive control/cost rails in measured unused space. Treat the panel and rail as one bounded card: align their outer edges, continue the source accent frame around both, and keep the rail from dissolving into the Section background. For a simple control plus Cost, start with opposite-edge placement and change it only when the source demonstrates another relationship. Do not cluster both actions at the start while leaving an unused opposite edge. Make adornment and alignment decisions locally; never append generic full-width bars by habit.
9. Build only through the application validator:

   ```sh
   corepack pnpm exec tsx .agents/jumpify/scripts/build-and-inspect.ts <workspace>
   ```

10. Start the application preview, then capture the imported archive through the real Tracker path:

```sh
corepack pnpm exec tsx .agents/jumpify/scripts/capture-and-audit.ts <workspace> http://127.0.0.1:4173
node .agents/jumpify/scripts/make-comparison-sheet.mjs <workspace>
```

11. Compare every panel with its source rectangle at the primary width, then inspect 720px and 390px behavior. Iterate until every acceptance record passes or a demonstrated gap remains.
12. Exercise rolled/manual pricing, continuity, limits, repeated ranks, discounts, locks, grants, Traits, companions, dynamic names, and controls. Capture every state required by `interactionContracts`. Isolate contracts or clear each tested purchase after capturing it so cumulative spending cannot prevent later controls from activating; establish only the prerequisite state needed by the contract under test. In the same Playwright run, assert the requested value and visible price, then write the DOM observation with control kind/value, activation layers, resolved costs, Section-relative surface/rail/neighbor bounds, and overlaps. Never use a fallback action without asserting its postcondition; differently named screenshots do not prove different states. Compare the numeric geometry and tightly cropped screenshots before and after each interaction. Reuse the readiness sequence established by `capture-and-audit.ts`; never convert a first-launch race, insufficient-balance refusal, or inferred state into a passing ledger record. Keep Home, Stay, and Next-Jump outcomes as prose and visuals only.
13. Require the completed ledger before handoff:

```sh
node .agents/jumpify/scripts/validate-ledger.mjs <workspace> --complete
```

## Hard stops

Do not finish while any of these remain:

- Unverified source content or mechanics.
- Crop-edge contamination, distorted panels, poor contrast, detached controls, duplicate cost meaning, or arbitrary full-page rasterization.
- An additive rail whose width, outer frame, or edge alignment does not visibly belong to its source panel, including a rail that disappears into a same-color Section where the source card has an accent boundary.
- A non-structural seam between adjacent panel crops, any word or line divided between sibling images, or shared parent content repeated or separated when those siblings responsively stack.
- Controls for final outcomes.
- Generic checkbox/radio activation in place of a native integer, select, text, continuity, or either-resolution control.
- A scalar input repeated across tier, rarity, price, or classification Choices instead of one direct scalar owner that creates the stable grant exactly once plus toggle tiers; duplicated tier grants, untargeted upgrades for that entity, or any non-toggle Source member without a source-evidenced two-stage contract.
- Any interaction that unexpectedly reveals its primary control or shifts neighboring layout after selection.
- An avoidably wrapped primary-width scalar rail when the measured Roll/value/Clear/Cost group fits in one row, or adjacent scalar cards whose action rails do not share a deliberate baseline and spacing system.
- A panel and live rail that do not read as one bounded card; mismatched outer edges; an accent frame that stops before the rail; a rail that merges into the Section background; or a simple Control and Cost clustered on one edge despite source-consistent space on the other.
- Any action whose observed value or resolved Cost does not prove the named state, any live-element overlap at 1440/720/390, or any stable-contract bound changing by more than one CSS pixel.
- Missing alt text, package diagnostics, or unexercised interaction paths.
- A visual mismatch dismissed only because the archive imports or the pixels are approximately similar.
- Any source page, output Section, required width, acceptance category, comparison sheet, or evidence file missing from the ledger.
- A partial package offered because the source is large or the current turn is ending. Resume and continue instead.

## Handoff

Report the absolute archive and project paths, source hash, verification result, uncertain transcription, accessibility/reflow limitations, remaining gap IDs, and a source-page coverage table naming the mapped Sections and comparison evidence. Do not commit anything under `scratch/`.
