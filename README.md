# Jumpchain Visualizer

Jumpchain Visualizer is a local-first React/Tauri application for authoring Format 1 Jump packages and evaluating them in chains.

## Development

Use Node 22.12 or newer, pnpm through Corepack, and the Rust toolchain:

```sh
corepack pnpm install
corepack pnpm dev
```

The Editor is available from Home → Build a Jump → Open Editor. Browser projects are stored in IndexedDB; desktop builds can open canonical project folders when the default-off Developer setting exposes that workflow. Saved Editor projects and Chains can be deleted only through the shared explicit confirmation dialog. A Format 1 Jump’s authored root `description` supplies its package summary in the Editor hub, previews, and Chain Tracker library. Source editing uses CodeMirror with Format 1 highlighting, single-control declaration folding, layered contextual completion, modifier-based Quick Add mnemonics, visible rebindable command shortcuts, diagnostics, and advanced find/replace; Structured edits share the same parser-ranged document and package history and reuse renderer controls where behavior overlaps. Files navigation is Source-only, while Content keeps both Structured and Source available. Portable `.jmp` packages pass the same staged, bounded import gate in Editor and Chain Tracker. The evidence ledger for controls and mutation root causes is at [`documentation/editor-control-audit.html`](documentation/editor-control-audit.html).

The maintained Threshold of a Thousand Roads, Confluence Engine, Last Trial, and Morgan development fixtures use explicit Mock provenance. They are hidden from the Jump Library and saved-chain lists by default. Enable Developer → **See Mock Data** to expose them; **Reset Mock Data** then restores the canonical filled-in Morgan chain without affecting user-created chains or imported Jumps.

Run the complete verification surface with `corepack pnpm check`. Native packaged smoke tests use `corepack pnpm test:native`. Product and format documentation starts at [`documentation/index.html`](documentation/index.html).

## Translating the application

Application-owned interface text lives in feature files under `src/localization/languages/English/`; Jump package content and user-authored chain data do not. English is the canonical fallback. To add a translation, create a sibling folder named with the language's own display name (for example `Español/`), copy `manifest.json`, set its canonical BCP 47 `languageTag` and `direction`, and add any subset of the English feature files and message leaves. A rebuild is required because Vite bundles discovered JSON packs. Keep semantic keys unchanged, and do not add HTML, URLs, React properties, or alter interpolation/component tokens. Run `corepack pnpm test` to validate pack structure and the source audit, then the complete `corepack pnpm check` surface. See [`documentation/localization.html`](documentation/localization.html) for the folder schema, boundaries, fallback, tag customization, spell-check behavior, and security rules.

## Package security

Archives, markup, and assets are untrusted. Imports enforce byte, entry, compression-ratio, path, file-type, integrity, image-decode, schema, reference, and atomic-commit protections. Developer package-size overrides increase byte budgets only and cannot disable mandatory malicious-archive safeguards.
