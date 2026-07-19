# Light-theme visual verification

These Chromium captures are written by `e2e/browser/lightTheme.spec.ts` and
retain the exact application paths used to verify the light-theme repair.
They cover the shell and hubs, both deletion dialogs, Editor Source,
Properties and Diagnostics hover/expanded states, Chain Tracker secondary
tabs and dialogs, every supplement module page, contextual supplement tools,
and the contextual Supp dialog with a non-gold accent in both themes.
Follow-up captures also retain Developer Logs, the Editor Add menu and hub,
the Chain rail Library, and transparent tag rendering in the Settings preview
and Inventory under both Light and Dark themes. Settings coverage also retains
the Tags Import, Export, and Reset controls plus their hover treatment and the
Notifications trigger-row hover state.

The dark Settings captures confirm that its controls and hover states retain
their pre-existing palette. The contextual Supp capture intentionally changes
only its two context labels and selected left rail to the active accent; all
other dark-mode presentation remains governed by the pre-existing styles.
