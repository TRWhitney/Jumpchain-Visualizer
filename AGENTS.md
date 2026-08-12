# Tag presentation invariant
- Jump authors provide Tag strings and choose where the Tag slot appears; they never control badge rendering.
- The active User Tag profile always owns Tag colors, borders, shape, typography, hierarchy, and animation.
- Never reproduce source artwork by styling Tags, use Tags as authored rule targets, or report User-owned Tag appearance as a conversion fidelity gap.
- Cost badges are separate semantic elements and may use authored Cost-slot presentation.

# Verification tiers
- Use Node 24.18 or newer within the Node 24 LTS line; `.node-version` is authoritative.
- `pnpm check` is the required everyday gate. It runs formatting, lint, typechecking, unit tests, a production client build, browser component tests, Rust checks, and the Chromium smoke journeys. Its cold wall-time budget is 90 seconds.
- The warm wall-time target is 27 seconds for `pnpm check`, 3 minutes 15 seconds for `pnpm check:full`, and 5 minutes 15 seconds for `pnpm check:exhaustive`. The verifier prints command, wave, critical-path, and total timings; investigate regressions instead of removing behavioral coverage.
- Reduce duplicated setup, unnecessary output, or slow critical-path work before increasing concurrency. Do not change production rendering architecture solely to make verification faster.
- The unit runner uses isolated worker threads in its own verification wave. Do not overlap it with browser-component and Rust work on WSL; the previous mixed wave repeatedly crashed Node/V8 workers and converted a six-second suite into 40–79 second failures.
- Documentation-only changes require no pipeline or test execution.
- Domain or backend changes require `pnpm check` plus the directly affected unit tests.
- UI changes require `pnpm check` plus the exact affected Playwright interaction path.
- Changes involving layout, focus, selection, drag and drop, canvas, image decoding, IndexedDB, RTL, or browser adapters require `pnpm check:full`.
- Changes to Playwright configuration, browser-specific fixes, and broad browser-runtime changes require `pnpm check:exhaustive`.
- Exhaustive browser verification runs every product behavior in Chromium and the contract-protected `@cross-browser` engine-risk matrix in Firefox and WebKit. Add secondary-engine assignments for browser-sensitive behavior; do not restore blanket three-engine duplication of ordinary application scenarios.
- Release verification requires `pnpm check:release`, which adds the packaged Tauri smoke test.
- `pnpm test:e2e:artifacts` is the only ordinary workflow allowed to update tracked review screenshots and comparison JSON. Other verification commands must leave `artifacts/` unchanged.
- Do not hide flaky tests with retries. A retry that recovers is still a failed verification run.

# Rust build artifacts
- Ordinary development uses line-table debug information and keeps incremental compilation enabled. Use `cargo build --workspace --all-features --profile debugging` only when full native debugger symbols are required.
- `pnpm rust:cache:status` reports the workspace target cache and warns above 10 GiB without failing verification.
- Rust cache deletion must be explicit. `pnpm rust:cache:clean` runs Cargo's workspace-aware clean operation and makes the next Rust build cold; verification must never invoke it automatically.

# Playwright
- Browser verification creates dismissed-onboarding state once through the real UI and loads an isolated copy into each ordinary test context. First-launch tests explicitly use empty state; generated state is additional evidence and does not replace any product-test assignment.
- Ordinary runs capture screenshots only when an assertion needs the pixels or Playwright records a failure. Success-only review captures belong to `pnpm test:e2e:artifacts`.
- Playwright writes an ignored `test-results/e2e-performance.json` with project, file, test, and action-category timings; it must not contain source, traces, storage state, or application data.
- Playwright HTML reports never open automatically. Use `pnpm test:e2e:report` to view the most recent report after the command has exited.
