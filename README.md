# Jumpchain Visualizer

Jumpchain Visualizer is a local-first React/Tauri application for authoring Format 1 Jump packages and evaluating them in chains.

## Development

Use Node 22.12 or newer, pnpm through Corepack, and the Rust toolchain:

```sh
corepack pnpm install
corepack pnpm dev
```

The Editor is available from Home → Build a Jump → Open Editor. Browser projects are stored in IndexedDB; desktop builds can open canonical project folders. A Format 1 Jump’s authored root `description` supplies its package summary in the Editor hub, previews, and Chain Tracker library. Portable `.jmp` packages pass the same staged, bounded import gate in Editor and Chain Tracker.

Run the complete verification surface with `corepack pnpm check`. Native packaged smoke tests use `corepack pnpm test:native`. Product and format documentation starts at [`documentation/index.html`](documentation/index.html).

## Package security

Archives, markup, and assets are untrusted. Imports enforce byte, entry, compression-ratio, path, file-type, integrity, image-decode, schema, reference, and atomic-commit protections. Developer package-size overrides increase byte budgets only and cannot disable mandatory malicious-archive safeguards.
