import { useState } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { HandleFieldControl } from "./HandleFieldControl";

test("handle control accepts typed values and exposes compatible choices plus creation", async () => {
  let creations = 0;

  function Harness() {
    const [value, setValue] = useState("");
    return (
      <HandleFieldControl
        label="Section layout"
        value={value}
        options={["standard_section", "dense_section"]}
        placeholder="default_section"
        createLabel="New Section layout…"
        onChange={setValue}
        onCreate={() => {
          creations += 1;
        }}
      />
    );
  }

  render(<Harness />);
  const input = page.getByRole("combobox", { name: "Section layout" });
  await expect.element(input).toHaveAttribute("placeholder", "default_section");
  await input.fill("placeholder_layout");
  await expect.element(input).toHaveValue("placeholder_layout");

  await page
    .getByRole("button", {
      name: "Show handle choices for Section layout",
    })
    .click();
  await expect
    .element(page.getByRole("option", { name: "standard_section" }))
    .toBeVisible();
  await expect
    .element(page.getByRole("option", { name: "dense_section" }))
    .toBeVisible();
  await expect
    .element(page.getByRole("option", { name: "New Section layout…" }))
    .toBeVisible();

  await page.getByRole("option", { name: "standard_section" }).click();
  await expect.element(input).toHaveValue("standard_section");

  await page
    .getByRole("button", {
      name: "Show handle choices for Section layout",
    })
    .click();
  await page.getByRole("option", { name: "New Section layout…" }).click();
  expect(creations).toBe(1);
  await expect.element(input).toHaveValue("standard_section");
});

test("deferred handle edits commit on blur", async () => {
  const commits: string[] = [];
  render(
    <>
      <HandleFieldControl
        label="Text target"
        value="intro"
        options={["intro"]}
        commitOnBlur
        onChange={(value) => commits.push(value)}
      />
      <button type="button">Outside</button>
    </>,
  );

  const input = page.getByRole("combobox", { name: "Text target" });
  await input.fill("summary");
  expect(commits).toEqual([]);
  await page.getByRole("button", { name: "Outside" }).click();
  expect(commits).toEqual(["summary"]);
});
