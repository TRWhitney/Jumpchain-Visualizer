# Glossary of Terms
- Developer: The one talking to you and providing tasks
- Agent: An AI coding agent, not necessarily you
- User: A consumer of the product, potentially the developer

# When removing features
- Assume there are no current users of the product, if a developer requests something be removed, then remove it without attempting to support backward compatibility unless explicitly told otherwise
- Do not add tests to verify the feature is gone, we never need to test that a feature does not exist

# Before a task is complete
- Fixtures are updated.
- Documentation is updated.
- Security implications are considered.
- Refactoring is complete to ensure reuse of code, maintainability, and readability.
- You must verify Code compiles (if applicable) and runs.
- You must run the verification tier required by the change and verify its complete test set passes.
- You must verify type-checkers are clean.
- You must verify linters are all run and are clean.
- You must verify via playwright, see below for more details.
- You must verify that formatters are all run (if applicable).
- Commit as it makes sense, if the sandbox refuses, elevate to developer.
- If the issue is rework, then squash commits as necessary.

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
- Use Playwright to verify issues and features before and after changes, use question tool or prompt the developer for more information if you cannot verify an issue.
- When fixing a GUI visual issue, compare the fresh Playwright screenshot directly against the developer-reported problem before declaring success. If the screenshot still shows the complained-about issue, the task is not done.
- For any bug fix, define the acceptance criterion in terms of the developer-observable symptom before making changes.
- Do not treat implementation proxies such as code shape, DOM structure, intended layout, internal state, or partial improvement as proof that a bug is fixed; verify the exact reported symptom directly.
- If the direct verification artifact still shows the reported symptom, the task is not complete even if the implementation appears logically correct.
- Before editing code for a bug fix, write down the concrete acceptance checks that will be used to decide whether the bug is actually fixed.
- After making a bug-fix change, evaluate each acceptance check explicitly against the verification artifact or test result. Do not collapse multiple checks into a vague summary.
- Do not claim a bug is fixed without citing the exact artifact used for verification, such as the screenshot, test output, or reproduced developer flow.
- If the acceptance checks and the verification artifact disagree with the implementation reasoning, trust the artifact and continue debugging.
- For GUI bugs, Playwright verification must exercise the exact developer-reported interaction path, not a nearby, similar, or inferred path. If the report says "right click folder X", then the verification must right click folder X.
- A passing Playwright check for one UI path does not justify claims about a different UI path unless that different path was also exercised directly.
- When multiple similar UI targets exist, verify the specific target named in the report before generalizing from any other passing case.
- If Playwright fixtures, seed projects, or sample content were mutated during debugging, restore or recreate a known-clean baseline before using later verification runs as evidence.
- Do not mark a GUI bug fixed if the verified Playwright flow did not include the exact triggering action, the exact target element, and the exact post-action state described by the developer.

# Testing
- All changes and features, aside from changes which only include removing features or documentation only changes, require tests whether they be E2E, Gerhkin Style, or Unit Tests.
- If a Gerhkin or E2E test is included, likely a unit test is needed too.
- Dependency injection is highly encouraged to facilitate.
- Backend code should be separate from GUI representation to the fullest extent possible.
- Fuzzing and mutation testing (killing mutants) is encouraged.
- No vendor specific CI/CD infra, do not add a .github or any similar

# Documentation
- AGENTS.md and README.md should all be markdown at the top level of the repo.
- NEVER add a README.md unless explicitly directed to do so.
- Otherwise keep documentation in a separate folder structure and make all docuemntation HTML, CSS, and Javascript (as necessary).
- HTML documentation should include mockups and where necessary several options with sliders and tweaks to allow the developer to select a way forward.
- When a design choice is not clear, and the choice isn't necessary solvable by asking the user a simple question, use the above method to ask the developer to select an option; an export feature so they can tell you what they chose is also helpful.
- Write ADRs, look for ADRs to assist decision making.
- Documentation changes never require pipeline or testing verification

# Research
- When doing research, use the search tool.
- Be thorough and consider different approaches and resources.
- Look at multiple sources to develop a well-rounded approach.
