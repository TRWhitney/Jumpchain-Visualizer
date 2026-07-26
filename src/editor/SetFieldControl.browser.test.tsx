import { useState } from "react";
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { SetFieldControl } from "./SetFieldControl";

test("set composer rejects blank and duplicate drafts and commits stored suggestion values", async () => {
  const additions: string[] = [];

  function Harness() {
    const [values, setValues] = useState<string[]>(["technology"]);
    return (
      <SetFieldControl
        kind="tag"
        label="Tags"
        help="Tag help"
        values={values}
        suggestions={[
          {
            value: "quality_world",
            label: "World quality",
            description: "Primary tag",
          },
        ]}
        placeholder="Type any tag or choose a primary tag."
        addLabel="Add tag"
        addedListLabel="Added tags"
        emptyValueLabel="Empty tag"
        removeLabel={(value) => `Remove tag ${value}`}
        normalize={(value) => value.trim().toLocaleLowerCase()}
        renderValue={(value, removeAction) => (
          <span className="test-tag-badge">
            {value}
            {removeAction}
          </span>
        )}
        onAdd={(value) => {
          additions.push(value);
          setValues((current) => [...current, value]);
        }}
        onRemove={(occurrence) =>
          setValues((current) =>
            current.filter((_, index) => index !== occurrence),
          )
        }
      />
    );
  }

  render(<Harness />);
  const composer = page.getByRole("combobox", { name: "Tags" });
  const add = page.getByRole("button", { name: "Add tag" });

  await composer.fill("   ");
  await expect.element(add).toBeDisabled();
  await userEvent.keyboard("{Enter}");
  expect(additions).toEqual([]);

  await composer.fill(" TECHNOLOGY ");
  await expect.element(add).toBeDisabled();
  await userEvent.keyboard("{Enter}");
  expect(additions).toEqual([]);

  await page.getByRole("button", { name: "Show suggestions for Tags" }).click();
  await page.getByRole("option", { name: /World quality/ }).click();
  await expect.element(composer).toHaveValue("quality_world");
  expect(additions).toEqual([]);
  await userEvent.keyboard("{Enter}");
  expect(additions).toEqual(["quality_world"]);
  await expect
    .element(page.getByRole("button", { name: "Remove tag quality_world" }))
    .toBeVisible();
  const qualityRemoval = document.querySelector(
    'button[aria-label="Remove tag quality_world"]',
  );
  expect(qualityRemoval?.closest(".test-tag-badge")).not.toBeNull();

  await composer.fill("handmade");
  await userEvent.keyboard("{Enter}");
  expect(additions).toEqual(["quality_world", "handmade"]);
});

test("group composer rejects blank and duplicate drafts, then removes the exact middle value with predictable focus", async () => {
  const removals: number[] = [];
  const additions: string[] = [];

  function Harness() {
    const [values, setValues] = useState(["one", "two", "three"]);
    return (
      <SetFieldControl
        kind="group"
        label="Groups"
        help="Group help"
        values={values}
        suggestions={[]}
        placeholder="Type a group."
        addLabel="Add group"
        addedListLabel="Added groups"
        emptyValueLabel="Empty group"
        removeLabel={(value) => `Remove group ${value}`}
        normalize={(value) => value.trim()}
        onAdd={(value) => {
          additions.push(value);
          setValues((current) => [...current, value]);
        }}
        onRemove={(occurrence) => {
          removals.push(occurrence);
          setValues((current) =>
            current.filter((_, index) => index !== occurrence),
          );
        }}
      />
    );
  }

  render(<Harness />);
  const composer = page.getByRole("combobox", { name: "Groups" });
  await composer.fill("  ");
  await userEvent.keyboard("{Enter}");
  await composer.fill("two");
  await userEvent.keyboard("{Enter}");
  expect(additions).toEqual([]);

  await page.getByRole("button", { name: "Remove group two" }).click();
  expect(removals).toEqual([1]);
  await expect
    .element(page.getByRole("button", { name: "Remove group two" }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole("button", { name: "Remove group three" }))
    .toHaveFocus();
});

test("optional help is associated with the composer only while enabled", async () => {
  function Harness() {
    const [showHelp, setShowHelp] = useState(true);
    return (
      <>
        <SetFieldControl
          kind="group"
          label="Groups"
          help="Groups connect choices to sources."
          showHelp={showHelp}
          values={[]}
          suggestions={[]}
          placeholder="Type a group."
          addLabel="Add group"
          addedListLabel="Added groups"
          emptyValueLabel="Empty group"
          removeLabel={(value) => `Remove group ${value}`}
          normalize={(value) => value}
          onAdd={() => undefined}
          onRemove={() => undefined}
        />
        <button type="button" onClick={() => setShowHelp(false)}>
          Hide help
        </button>
      </>
    );
  }
  render(<Harness />);

  const composer = page.getByRole("combobox", { name: "Groups" });
  await expect.element(composer).toBeVisible();
  const descriptionId = composer.element().getAttribute("aria-describedby");
  expect(descriptionId).toBeTruthy();
  expect(document.getElementById(descriptionId ?? "")?.textContent).toBe(
    "Groups connect choices to sources.",
  );

  await page.getByRole("button", { name: "Hide help" }).click();
  await expect
    .element(page.getByText("Groups connect choices to sources."))
    .not.toBeInTheDocument();
  await expect.element(composer).not.toHaveAttribute("aria-describedby");
});

test("author composer is a plain text field with no suggestion affordance", async () => {
  const additions: string[] = [];

  function Harness() {
    const [values, setValues] = useState(["Existing Author"]);
    return (
      <SetFieldControl
        kind="author"
        label="Authors"
        help="Add each author once."
        values={values}
        suggestions={[]}
        placeholder="Type an author name."
        addLabel="Add author"
        addedListLabel="Added authors"
        emptyValueLabel="Empty author"
        removeLabel={(value) => `Remove author ${value}`}
        normalize={(value) => value.trim().toLocaleLowerCase()}
        onAdd={(value) => {
          additions.push(value);
          setValues((current) => [...current, value]);
        }}
        onRemove={(occurrence) =>
          setValues((current) =>
            current.filter((_, index) => index !== occurrence),
          )
        }
      />
    );
  }

  render(<Harness />);
  const composer = page.getByRole("textbox", { name: "Authors" });
  await expect.element(composer).toBeVisible();
  await expect
    .element(page.getByRole("combobox", { name: "Authors" }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole("button", { name: /suggestions for Authors/i }))
    .not.toBeInTheDocument();

  await composer.fill("  New Author  ");
  await userEvent.keyboard("{Enter}");
  expect(additions).toEqual(["New Author"]);
  await expect
    .element(page.getByRole("button", { name: "Remove author New Author" }))
    .toBeVisible();
});
