# Light-theme visual verification

These Chromium captures are written by `e2e/browser/lightTheme.spec.ts` and
retain the exact application paths used to verify the light-theme repair.
They cover the shell and hubs, both deletion dialogs, Editor Source,
Properties and Diagnostics hover/expanded states, Chain Tracker secondary
tabs and dialogs, every supplement module page, contextual supplement tools,
and the contextual Supp dialog with a non-gold accent in both themes.
The Editor audit also follows the exact structured-authoring paths for content
tiles, conditional variants, the selected `stack[1]` layout control, sidebar
group and item context menus, pressed raster controls above and beside the
canvas, the narrow canvas tool rail without native scrollbar chevrons, and
the valid SVG diagnostics notice.
Follow-up captures also retain Developer Logs, the Editor Add menu and hub,
the Chain rail Library, and transparent tag rendering in the Settings preview
and Inventory under both Light and Dark themes. Settings coverage also retains
the Tags Import, Export, and Reset controls plus their hover treatment and the
Notifications trigger-row hover state. Paired Editor layout-preview captures
verify that an authored section text token paints identically in Light and Dark
without the application shell substituting its muted-text color.

The dark Settings captures confirm that its controls and hover states retain
their pre-existing palette. The contextual Supp capture intentionally changes
only its two context labels and selected left rail to the active accent; all
other dark-mode presentation remains governed by the pre-existing styles.
