# Mock data verification

These Chromium Playwright captures exercise the developer-owned mock-data boundary:

- `mock-data-disabled-settings.png` shows **See Mock Data** off and **Reset Mock Data** disabled.
- `mock-data-enabled-settings.png` shows visibility enabled and reset available.
- `mock-data-library.png` shows the explicit **Mock** source with exactly the three maintained fixture packages.
- `mock-data-restored-morgan.png` shows the canonical three-Jump Morgan chain after resetting modified state.

The matching Playwright flow also deletes and restores Morgan, reloads after each reset, verifies the canonical Trial Name choice, hides mock data again without hiding a user-created chain, and confirms direct Morgan routes remain usable.
