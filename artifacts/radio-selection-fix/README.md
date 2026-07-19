# Last Trial radio-selection verification

These screenshots exercise the curated **The Last Trial** entry in the Chain
Tracker review fixture.

The `before-*` images were captured before the renderer fix. Although the
fixture state selected Scholar in the Manual, Random, and Chosen-or-Random
Assignment sections, the three sources reused one native radio group name. The
browser displayed only the last checked source, and a hand selection in Manual
Assignment remained visually empty.

The `after-*` images are attachments from the Chromium Playwright regression
test. They show the exact post-fix acceptance state: Manual Wanderer is visibly
selected after a click, while Random Scholar and Chosen-or-Random Scholar remain
visibly selected from their recorded rolls.
