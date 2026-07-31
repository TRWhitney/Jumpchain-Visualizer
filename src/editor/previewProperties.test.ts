import { describe, expect, it } from "vitest";
import type { CanonicalJumpPackage, JumpChoice } from "../markup";
import type { EvaluatedActorJump } from "../domain";
import {
  interpolationHandles,
  previewBasicDataGroups,
  previewPropertyRows,
  previewPropertyRowsForHandles,
} from "./previewProperties";

const choice = (
  handle: string,
  property: string,
  inputProperty?: string,
): JumpChoice => ({
  handle,
  name: { base: "Gender choice", variants: [] },
  tags: [],
  groups: [],
  selection: "select",
  resolution: "manual",
  options: [],
  text: [],
  images: [],
  costs: [],
  grants: [
    {
      kind: "property",
      handle: property,
      tags: [],
      text: [],
      images: [],
    },
  ],
  inputs: inputProperty
    ? [
        {
          handle: "detail",
          selection: "text",
          options: [],
          grants: [
            {
              kind: "property",
              handle: inputProperty,
              tags: [],
              text: [],
              images: [],
            },
          ],
        },
      ]
    : [],
});

const packageItem = {
  id: "preview",
  logicalId: "preview",
  exactHash: "preview",
  format: 1,
  name: { base: "Preview", variants: [] },
  authors: ["Tester"],
  version: "1",
  description: "",
  source: "mock",
  nativeGauntlet: false,
  startingPoints: 1000,
  pointsName: { base: "Choice Points", variants: [] },
  pointsAbbreviation: { base: "CP", variants: [] },
  resources: [],
  sections: [
    {
      handle: "identity",
      name: { base: "Identity", variants: [] },
      sources: [],
      directChoices: [{ handle: "gender_field", target: "gender_choice" }],
      members: [{ kind: "choice", handle: "gender_field" }],
      text: [],
      images: [],
    },
  ],
  choices: [choice("gender_choice", "gender", "nickname")],
  layouts: [],
  themes: {},
  tags: [],
  diagnostics: [],
} satisfies CanonicalJumpPackage;

const evaluation = {
  balance: 1000,
  resources: {},
  properties: {
    gender: { value: "Female", sourceLabel: "Gender choice" },
  },
  choices: {},
  traits: [],
  diagnostics: [],
} satisfies EvaluatedActorJump;

describe("preview properties", () => {
  it("collects unique interpolated handles across source files", () => {
    expect(
      interpolationHandles({
        "jump.jdef": "Text {{gender}} and {{ gender }} and {{age}}.",
        "choices.jdef": "Again {{gender}}.",
      }),
    ).toEqual(["age", "gender"]);
  });

  it("reports current values and the Choices or Inputs capable of setting them", () => {
    expect(
      previewPropertyRows(packageItem, evaluation, {
        "jump.jdef":
          "Gender {{gender}}, nickname {{nickname}}, age {{age}}, gauntlet {{gauntlet}}.",
      }),
    ).toEqual([
      {
        handle: "age",
        value: undefined,
        sourceLabel: undefined,
        setters: [],
      },
      {
        handle: "gauntlet",
        value: false,
        sourceLabel: "Jump declaration",
        setters: [],
      },
      {
        handle: "gender",
        value: "Female",
        sourceLabel: "Gender choice",
        setters: [
          {
            choiceHandle: "gender_choice",
            choiceName: "Gender choice",
          },
        ],
      },
      {
        handle: "nickname",
        value: undefined,
        sourceLabel: undefined,
        setters: [
          {
            choiceHandle: "gender_choice",
            choiceName: "Gender choice",
            inputHandle: "detail",
          },
        ],
      },
    ]);
  });

  it("always audits gender, age, origin, and location independently of authored placeholders", () => {
    const basicPackage: CanonicalJumpPackage = {
      ...packageItem,
      sections: [
        {
          ...packageItem.sections[0]!,
          directChoices: [
            { handle: "gender_field", target: "gender_choice" },
            { handle: "age_field", target: "age_choice" },
            { handle: "origin_field", target: "origin_choice" },
            { handle: "location_field", target: "location_choice" },
          ],
          members: [
            { kind: "choice", handle: "gender_field" },
            { kind: "choice", handle: "age_field" },
            { kind: "choice", handle: "origin_field" },
            { kind: "choice", handle: "location_field" },
          ],
        },
      ],
      choices: [
        {
          ...choice("gender_choice", "gender"),
          name: { base: "Gender choice", variants: [] },
        },
        {
          ...choice("age_choice", "age"),
          name: { base: "Age choice", variants: [] },
          selection: "integer",
        },
        {
          ...choice("origin_choice", "origin"),
          name: { base: "Origin choice", variants: [] },
        },
        {
          ...choice("location_choice", "location"),
          name: { base: "Location choice", variants: [] },
        },
      ],
    };
    const basicEvaluation: EvaluatedActorJump = {
      ...evaluation,
      properties: {
        gender: { value: "Female", sourceLabel: "Gender choice" },
        age: { value: 24, sourceLabel: "Age choice" },
        origin: { value: "Scholar", sourceLabel: "Origin choice" },
        location: { value: "Crossroads", sourceLabel: "Location choice" },
      },
    };

    expect(
      previewPropertyRowsForHandles(
        basicPackage,
        basicEvaluation,
        previewBasicDataGroups.flatMap((group) => [...group.handles]),
      ).map(({ handle, value, setters }) => ({
        handle,
        value,
        setters: setters.map((setter) => setter.choiceName),
      })),
    ).toEqual([
      { handle: "gender", value: "Female", setters: ["Gender choice"] },
      { handle: "age", value: 24, setters: ["Age choice"] },
      { handle: "origin", value: "Scholar", setters: ["Origin choice"] },
      {
        handle: "location",
        value: "Crossroads",
        setters: ["Location choice"],
      },
    ]);
  });

  it("does not claim an unreachable Choice can set preview data", () => {
    expect(
      previewPropertyRowsForHandles(
        {
          ...packageItem,
          sections: [],
        },
        evaluation,
        ["gender"],
      ),
    ).toEqual([
      {
        handle: "gender",
        value: "Female",
        sourceLabel: "Gender choice",
        setters: [],
      },
    ]);
  });

  it("recognizes a specially named basic-data Choice without an extra Grant", () => {
    const genderChoice = {
      ...choice("gender", "unused"),
      name: { base: "Gender", variants: [] },
      grants: [],
    };
    expect(
      previewPropertyRowsForHandles(
        {
          ...packageItem,
          sections: [
            {
              ...packageItem.sections[0]!,
              directChoices: [{ handle: "gender_field", target: "gender" }],
            },
          ],
          choices: [genderChoice],
        },
        {
          ...evaluation,
          properties: {},
        },
        ["gender"],
        {
          choices: { gender: "Male" },
          inputs: {},
          sourceSelections: {},
          choiceRolls: {},
          sourceRolls: {},
        },
      ),
    ).toEqual([
      {
        handle: "gender",
        value: "Male",
        sourceLabel: "Gender",
        setters: [
          {
            choiceHandle: "gender",
            choiceName: "Gender",
          },
        ],
      },
    ]);
  });

  it("recognizes a non-integer Location Choice without an extra Grant", () => {
    const locationChoice = {
      ...choice("location", "unused"),
      name: { base: "Location (Poolside)", variants: [] },
      grants: [],
      selection: "toggle" as const,
    };
    expect(
      previewPropertyRowsForHandles(
        {
          ...packageItem,
          sections: [
            {
              ...packageItem.sections[0]!,
              directChoices: [{ handle: "location_field", target: "location" }],
            },
          ],
          choices: [locationChoice],
        },
        {
          ...evaluation,
          properties: {},
        },
        ["location"],
        {
          choices: { location: true },
          inputs: {},
          sourceSelections: {},
          choiceRolls: {},
          sourceRolls: {},
        },
      ),
    ).toEqual([
      {
        handle: "location",
        value: "Poolside",
        sourceLabel: "Location (Poolside)",
        setters: [
          {
            choiceHandle: "location",
            choiceName: "Location (Poolside)",
          },
        ],
      },
    ]);
    expect(
      previewPropertyRowsForHandles(
        {
          ...packageItem,
          sections: [
            {
              ...packageItem.sections[0]!,
              directChoices: [{ handle: "location_field", target: "location" }],
            },
          ],
          choices: [locationChoice],
        },
        {
          ...evaluation,
          properties: {},
        },
        ["location"],
        {
          choices: { location: false },
          inputs: {},
          sourceSelections: {},
          choiceRolls: {},
          sourceRolls: {},
        },
      ),
    ).toEqual([
      {
        handle: "location",
        value: undefined,
        sourceLabel: undefined,
        setters: [
          {
            choiceHandle: "location",
            choiceName: "Location (Poolside)",
          },
        ],
      },
    ]);
  });

  it("recognizes an ungrouped non-integer Origin Choice without an extra Grant", () => {
    const originChoice = {
      ...choice("origin", "unused"),
      name: { base: "Origin (Local)", variants: [] },
      grants: [],
      groups: [],
      selection: "toggle" as const,
    };
    expect(
      previewPropertyRowsForHandles(
        {
          ...packageItem,
          sections: [
            {
              ...packageItem.sections[0]!,
              sources: [],
              directChoices: [{ handle: "origin_field", target: "origin" }],
            },
          ],
          choices: [originChoice],
        },
        {
          ...evaluation,
          properties: {},
        },
        ["origin"],
        {
          choices: { origin: true },
          inputs: {},
          sourceSelections: {},
          choiceRolls: {},
          sourceRolls: {},
        },
      ),
    ).toEqual([
      {
        handle: "origin",
        value: "Local",
        sourceLabel: "Origin (Local)",
        setters: [
          {
            choiceHandle: "origin",
            choiceName: "Origin (Local)",
          },
        ],
      },
    ]);
  });

  it("recognizes members of an Origin Choice group as property writers", () => {
    const roadborn = {
      ...choice("roadborn", "unused"),
      name: { base: "Roadborn", variants: [] },
      groups: ["backgrounds"],
      grants: [],
      selection: "toggle" as const,
    };
    expect(
      previewPropertyRowsForHandles(
        {
          ...packageItem,
          sections: [
            {
              ...packageItem.sections[0]!,
              sources: [
                {
                  handle: "origin",
                  group: "backgrounds",
                  mode: "single",
                  resolution: "manual",
                },
              ],
              directChoices: [],
              members: [{ kind: "source", handle: "origin" }],
            },
          ],
          choices: [roadborn],
        },
        {
          ...evaluation,
          properties: {
            origin: { value: "Roadborn", sourceLabel: "Roadborn" },
          },
        },
        ["origin"],
        {
          choices: {},
          inputs: {},
          sourceSelections: { "identity:origin": ["roadborn"] },
          choiceRolls: {},
          sourceRolls: {},
        },
      ),
    ).toEqual([
      {
        handle: "origin",
        value: "Roadborn",
        sourceLabel: "Roadborn",
        setters: [
          {
            choiceHandle: "roadborn",
            choiceName: "Roadborn",
          },
        ],
      },
    ]);
  });

  it("reports contextual Choice and Input answers used by owned text", () => {
    expect(
      previewPropertyRows(
        packageItem,
        evaluation,
        {
          "jump.jdef": "Choice {{gender_choice}}, input {{detail}}.",
        },
        {
          choices: { gender_choice: "Female" },
          inputs: { gender_choice: { detail: "She/her" } },
          sourceSelections: {},
          choiceRolls: {},
          sourceRolls: {},
        },
      ),
    ).toEqual([
      {
        handle: "detail",
        value: "She/her",
        sourceLabel: "Gender choice · detail",
        setters: [
          {
            choiceHandle: "gender_choice",
            choiceName: "Gender choice",
            inputHandle: "detail",
          },
        ],
      },
      {
        handle: "gender_choice",
        value: "Female",
        sourceLabel: "Gender choice",
        setters: [
          {
            choiceHandle: "gender_choice",
            choiceName: "Gender choice",
          },
        ],
      },
    ]);
  });
});
