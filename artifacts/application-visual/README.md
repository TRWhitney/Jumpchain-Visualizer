# Application visual verification

Playwright retains production screenshots for application-shell interactions that are not part of an individual feature's mock comparison suite. The chain-deletion artifact verifies the requested card-control placement and the shared confirmation-dialog treatment, including its accent border, neutral theme surface, and card-matched semantic red Delete hover/focus treatment.

`home-empty-recent-cards.png` verifies that a fresh root route reserves one equal-height card row for both empty recent-work sections, with concise directions to the Editor and Chain Tracker. The matching Playwright flow also verifies that each placeholder disappears independently when its first record is created.
