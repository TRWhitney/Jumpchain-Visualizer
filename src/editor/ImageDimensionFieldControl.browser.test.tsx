import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ImageDimensionFieldControl } from "./ImageDimensionFieldControl";

test("size choices use a dropdown chevron and reverse it while open", async () => {
  render(
    <ImageDimensionFieldControl
      label="Width"
      value="md"
      tokens={["sm", "md", "lg"]}
      onChange={() => undefined}
      onBlur={() => undefined}
    />,
  );

  const choices = page.getByRole("button", {
    name: "Show size choices for Width",
  });
  await expect.element(choices).toBeVisible();
  expect(choices.element().querySelector("svg")?.style.transform).toBe(
    "rotate(90deg)",
  );

  await choices.click();
  expect(choices.element().querySelector("svg")?.style.transform).toBe(
    "rotate(270deg)",
  );
  await expect.element(page.getByRole("option", { name: "md" })).toBeVisible();
});

test("one text-size field exposes every token and accepts an exact value", async () => {
  const changes: string[] = [];
  const tokens = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];
  render(
    <ImageDimensionFieldControl
      kind="text"
      label="Text size"
      value=""
      tokens={tokens}
      onChange={(value) => changes.push(value)}
      onBlur={() => undefined}
    />,
  );

  await page
    .getByRole("button", { name: "Show text-size choices for Text size" })
    .click();
  expect(
    page
      .getByRole("listbox", { name: "Available text-size tokens" })
      .element()
      .querySelectorAll('[role="option"]'),
  ).toHaveLength(tokens.length);
  await page.getByRole("option", { name: "4xl", exact: true }).click();
  expect(changes.at(-1)).toBe("4xl");
  await page
    .getByRole("textbox", { name: "Text size", exact: true })
    .fill("48px");
  expect(changes.at(-1)).toBe("48px");
});
