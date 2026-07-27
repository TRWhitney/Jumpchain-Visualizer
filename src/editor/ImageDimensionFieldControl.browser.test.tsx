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
