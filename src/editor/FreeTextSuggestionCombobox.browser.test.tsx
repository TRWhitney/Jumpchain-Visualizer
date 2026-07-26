import { useState } from "react";
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  FreeTextSuggestionCombobox,
  type FreeTextSuggestion,
} from "./FreeTextSuggestionCombobox";

test("select-only suggestions display localized labels and commit canonical values", async () => {
  const changes: string[] = [];
  const suggestions: FreeTextSuggestion[] = [
    {
      value: "toggle",
      label: "Toggle",
      description:
        "An on/off choice. In a single-choice group, it appears as a radio button.",
    },
    {
      value: "text",
      label: "Text",
      description: "Let the user enter text.",
    },
    {
      value: "integer",
      label: "Integer",
      description: "Let the user choose a whole number.",
    },
    {
      value: "select",
      label: "Select",
      description: "Let the user choose one of the ordered options below.",
    },
  ];

  function Harness() {
    const [value, setValue] = useState("toggle");
    return (
      <FreeTextSuggestionCombobox
        label="Selection"
        value={value}
        suggestions={suggestions}
        showSuggestionsLabel="Show selection types"
        suggestionsLabel="Available selection types"
        selectOnly
        onChange={(nextValue) => {
          changes.push(nextValue);
          setValue(nextValue);
        }}
      />
    );
  }

  render(<Harness />);
  const selection = page.getByRole("combobox", { name: "Selection" });
  await expect.element(selection).toHaveValue("Toggle");
  await expect.element(selection).toHaveAttribute("readonly");

  await selection.click();
  await expect
    .element(
      page.getByRole("option", {
        name: "Toggle. An on/off choice. In a single-choice group, it appears as a radio button.",
      }),
    )
    .toBeVisible();
  await page
    .getByRole("option", {
      name: "Integer. Let the user choose a whole number.",
    })
    .click();
  expect(changes).toEqual(["integer"]);
  await expect.element(selection).toHaveValue("Integer");

  await userEvent.keyboard("{Enter}");
  await expect
    .element(
      page.getByRole("option", {
        name: "Integer. Let the user choose a whole number.",
      }),
    )
    .toHaveFocus();
  await userEvent.keyboard("{ArrowDown}{Enter}");
  expect(changes).toEqual(["integer", "select"]);
  await expect.element(selection).toHaveValue("Select");
});

test("option descriptions leave both the visual and accessibility trees when disabled", async () => {
  render(
    <FreeTextSuggestionCombobox
      label="Input type"
      value="integer"
      suggestions={[
        {
          value: "integer",
          label: "Integer",
          description: "Enter a whole number.",
        },
      ]}
      showSuggestionsLabel="Show input types"
      suggestionsLabel="Available input types"
      selectOnly
      showDescriptions={false}
      onChange={() => undefined}
    />,
  );

  await page.getByRole("combobox", { name: "Input type" }).click();
  await expect
    .element(page.getByRole("option", { name: "Integer", exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText("Enter a whole number."))
    .not.toBeInTheDocument();
});
