# Native interaction mapping

## Contents

- Map behavior before layout
- Choose the native construct
- Reserved identity properties
- Direct placement versus Choice Sources
- Stable interaction geometry
- Facsimile action rails
- Record and verify the contract

## Map behavior before layout

Inventory each source interaction before writing JDEF or cropping around it. Record what value the User supplies, whether it is optional, how it is resolved, what continuity means, what it costs, and whether the source selects one member from a group. Select the narrowest native Format 1 construct that expresses that behavior.

Do not infer the control from the source's visual mark. A printed circle does not require an authored radio button, and words such as “choose,” “roll,” or “swap” are not independent toggle Choices. The control follows the source behavior.

Do not reproduce a scalar interaction with a generic activation Choice when Format 1 has a scalar Choice. A checkbox or radio that merely reveals the real integer, select, or text control is a failed mapping unless the source itself first selects among genuinely separate interaction mechanisms.

## Choose the native construct

| Source behavior                                 | Format 1 construct                            | Prohibited substitute                                                         |
| ----------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| Set an integer manually                         | one `choice` with `selection: integer`        | toggle Choice plus integer Input                                              |
| Roll an integer                                 | one integer Choice with `resolution: random`  | “Roll” toggle Choice                                                          |
| Roll or manually set the same integer           | one integer Choice with `resolution: either`  | separate Roll and Choose Choices                                              |
| Select one scalar value                         | one Choice with `selection: select`           | one toggle Choice per label                                                   |
| Keep a prior scalar value for free or change it | one select Choice with `continuity: previous` | “Swap” radio/toggle Choice                                                    |
| Roll or manually select one member of a group   | one `choice-source` with `resolution: either` | separate roll and manual Sources                                              |
| Select zero or one member of a group            | one `choice-source` with `mode: single`       | a required/default selection                                                  |
| Select up to N independent members              | one multi Source with `max: N`                | runtime prose only or mutually exclusive toggles                              |
| Enter text                                      | one Choice with `selection: text`             | toggle that reveals a text Input                                              |
| Buy a repeated quantity                         | one integer Choice with `cost mode: each`     | a separate Choice for each quantity                                           |
| Final Home/Stay/Next outcome                    | exact prose and visuals only                  | any Choice, Source, control, selection state, property, or outcome projection |

Use an `input` child only for a genuinely secondary value owned by the same Choice. Do not use it to hide the primary interaction behind an activation control.

## Reserved identity properties

Treat `age`, `gender`, `location`, and `origin` as values, not labels for ad hoc Choices.

For a roll-or-choose age:

```text
choice
  handle: age
  name: "Age"
  selection: integer
  min: 10
  max: 17
  resolution: either
  cost: 100
  grant
    kind: property
    handle: age
```

This produces one integer control with native Roll, manual value, Clear, and resolution-aware pricing. Never split it into “Roll Age” and “Choose Age.”

For a previous gender that may be changed:

```text
choice
  handle: gender
  name: "Gender"
  selection: select
  continuity: previous
  option: "Female"
  option: "Male"
  cost: 100
  grant
    kind: property
    handle: gender
```

Options come from the source and may contain any authored values; do not assume a binary list. Never replace this with a “Swap Gender” toggle or radio.

For roll-or-choose Region outcomes, use one Source:

```text
choice-source
  handle: region
  group: region
  mode: single
  resolution: either
```

Each member Choice writes the `location` Property. The Source owns the roll/manual policy; do not create separate roll Choices.

Keep each member's ordinary manual cost. Format 1's roll allowance makes the recorded rolled member free while it remains the rolled result; a manually selected member pays its normal cost. Do not remove the base cost, hard-code a free member, or declare resolution-sensitive pricing unsupported before exercising the rolled and manual states in the real Tracker.

## Direct placement versus Choice Sources

A direct Choice association renders the Choice's native control without adding a source-member activation control:

```text
section
  handle: identity
  name: "Identity"
  choice
    handle: age_field
    target: age
  choice
    handle: gender_field
    target: gender
```

Use direct associations for standalone scalar controls such as Age and Gender. Use a Choice Source only when the User is choosing among a real group of member Choices.

Do not also add that direct Choice to a group consumed by a Choice Source in the same Section. That renders a second activation path and defeats the direct placement.

Placing an integer or select Choice inside a Source adds the Source's checkbox/radio activation before the scalar control. This is correct only when the source document truly has both interaction layers. It is a conversion defect when it creates a checkbox/radio whose only purpose is to reveal the actual control.

Before accepting a Source that contains a non-toggle Choice, answer both questions in the ledger:

1. What distinct source-authored decision does the Source selector represent?
2. Why is direct placement insufficient?

If either answer is absent, use a direct association.

Record the exception as a separate Choice interaction contract with `sourceHandle` and `sourceActivation` source evidence. The package gate rejects every non-toggle Source member without exactly one such exception contract. Do not use the exception for repeated copies of one entered value across tier, rarity, price, or classification Choices; model one direct scalar owner and toggle tier Choices instead.

The direct scalar owner creates the durable grant once. Tier Choices modify price/classification without creating duplicate entities, and related upgrades target that same stable companion or form. Exercise the entered name in the corresponding Tracker tab and exercise at least one owned upgrade.

## Stable interaction geometry

Capture every interaction in all materially different states. At minimum capture unset and selected/manual states; also capture rolled state for `random` or `either`, disabled-at-limit state for capped Sources, and a nonzero rank for repeated purchases. The capture script must assert the requested postcondition before writing evidence. Never catch a failed exact-label action by choosing an arbitrary option index: select by actual value, then assert the resulting value and Cost text.

Keep interaction contracts independent. Clear a tested purchase after its selected or ranked evidence unless another named contract explicitly depends on it. Before each action, establish only the prerequisites that contract requires. A selection rejected because earlier tests exhausted the point balance is a failed test setup, not evidence for the control.

Compare the outer card, visual panel, action rail, neighboring card, and Section bounds before and after interaction. Record their Section-relative numeric bounds in each state's DOM observation; screenshots alone are not proof. Selection may change indicators and values. It must not unexpectedly add a new activation layer, move neighboring content, enlarge a rail, or reveal the actual primary control after a generic checkbox/radio.

Use `stable` geometry unless the source itself contains an expanding disclosure. An `intentional-source-reflow` contract requires source coordinates and a note naming the expanding source surface. Application behavior alone is not source authorization for reflow.

## Facsimile action rails

Attach live mechanics to the measured panel they control. When a source panel has no internal live-control space, start from this proven rail and adjust only from direct comparison:

```text
stack
  gap: none
  image
    target: source_card
    fit: contain
  inline
    gap: xs
    padding: xs
    background: source_charcoal
      slot
        target: control
        control-adornments: false
      slot: tags
      inline
      grow: 1
      gap: xs
      align: center
      justify: end
      slot: cost
```

This keeps a simple control on one edge, live Tags in available middle space, the Cost on the other, and the rail directly attached to the panel. A tags leaf collapses when the Choice has no Tags. Preserve the enclosing card surface as well: when the source uses a cyan or other accent frame, that frame must visibly enclose both the panel and its additive rail. Do not globally remove the boundary and leave a charcoal rail merging into the charcoal Section, and do not let the rail grow wider than its panel without a measured reason. The panel, rail, and outer card must read as one unit like the proven Kanto treatment.

```text
accent card boundary
┌─────────────────────────────────────────────┐
│ measured source panel                       │
├─────────────────────────────────────────────┤
│ live Control       live Tags     live Cost  │
└─────────────────────────────────────────────┘
```

The diagram describes ownership, not a mandatory left/right order. Follow the source when it demonstrates another relationship.

Before using the rail for a multi-part control such as Roll + number + range + Clear + Cost, measure its intrinsic width at every allocated track width. If it cannot fit, let the containing cards reflow or use a deliberate Wrap; never preserve a desktop Inline by allowing controls and Costs to overlap.

Do not leave an `either` scalar in the generic Control slot when the source and available width call for one coherent action row. Start from a relationship-specific rail that exposes Roll separately:

```text
choice-layout
  handle: facsimile_either_rail
  inline
    gap: xs
    padding: xs
    background: source_charcoal
    align: center
    slot
      target: roll
      control-adornments: false
      control-density: compact
    slot
      target: control
      control-adornments: false
      control-density: compact
    inline
      grow: 1
      justify: end
      slot
        target: cost
        cost-density: compact
```

For a continuity select, use the same compact relationship without a Roll slot:

```text
choice-layout
  handle: facsimile_continuity_rail
  inline
    gap: xs
    padding: xs
    background: source_charcoal
    align: center
    slot
      target: control
      control-adornments: false
      control-density: compact
    inline
      grow: 1
      justify: end
      slot
        target: cost
        cost-density: compact
```

At the primary width, keep the specialized rail on one row whenever its measured intrinsic width fits. A default component wrapping internally is not evidence that wrapping is necessary. Compare neighboring scalar cards as a pair: their rails should share a baseline and spacing logic even when one has a Roll action and the other does not. At narrow widths, wrap deliberately before overlap and keep each action group visually attached to its panel.

Render each live `control`, `roll`, and `cost` target at most once in one layout. Source artwork may visibly contain its printed price, but the live Cost slot appears only once; never repeat it in both a heading and an action rail.

Place a Source Roll slot in a compact row immediately attached to the source instruction panel. Do not let it float in unmeasured blank space above the member cards. Exercise Roll and Clear and compare the header, rail, and first card bounds in both states.

## Record and verify the contract

Populate `interactionContracts` in `ledger.json` before JDEF authoring. Every source `choice` entry must belong to exactly one contract. Record the canonical owner, placement, selection, resolution, continuity, relevant Source, required states, and geometry policy.

`build-and-inspect.ts` compares each contract with the canonical package. A contract naming a direct integer `either` Choice cannot pass when the JDEF contains two Source-member Choices. This check verifies that authored syntax matches the planned native construct; it does not replace source interpretation or screenshot review.

Do not mark `costs-and-controls` or `content-and-semantics` as passed until every required state image and DOM observation exists, the requested action postcondition is true, captured pricing matches the contract, overlap arrays are empty, and numeric geometry remains within the declared policy.
