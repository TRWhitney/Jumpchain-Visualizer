import { useState } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ColorFieldControl } from "./ColorFieldControl";
import type { ScreenColorSampler } from "./screenColorSampler";

test("color-picker movement stays local until the drag settles", async () => {
  const commits: string[] = [];
  let parentRenders = 0;

  function Harness() {
    const [value, setValue] = useState("#000000");
    parentRenders += 1;
    return (
      <ColorFieldControl
        label="background"
        value={value}
        choices={[]}
        allowTokens={false}
        onChange={(nextValue) => {
          commits.push(nextValue);
          setValue(nextValue);
        }}
        onBlur={() => undefined}
      />
    );
  }

  render(<Harness />);
  const picker = page.getByLabelText("Choose background with color picker");

  for (const color of [
    "#110000",
    "#220000",
    "#330000",
    "#440000",
    "#550000",
    "#660000",
    "#770000",
    "#880000",
    "#990000",
    "#aa0000",
  ]) {
    await picker.fill(color);
  }

  expect(commits).toEqual([]);
  expect(parentRenders).toBe(1);
  await expect.element(page.getByPlaceholder("#RRGGBB")).toHaveValue("#AA0000");

  await new Promise((resolve) => window.setTimeout(resolve, 150));
  expect(commits).toEqual(["#AA0000"]);
  expect(parentRenders).toBe(2);
});

test("leaving the color picker immediately commits its final drag value", async () => {
  const commits: string[] = [];

  function Harness() {
    const [value, setValue] = useState("#000000");
    return (
      <ColorFieldControl
        label="background"
        value={value}
        choices={[]}
        allowTokens={false}
        onChange={(nextValue) => {
          commits.push(nextValue);
          setValue(nextValue);
        }}
        onBlur={() => undefined}
      />
    );
  }

  render(<Harness />);
  const picker = page.getByLabelText("Choose background with color picker");
  await picker.fill("#123456");
  await page.getByPlaceholder("#RRGGBB").click();

  expect(commits).toEqual(["#123456"]);
  await expect.element(page.getByPlaceholder("#RRGGBB")).toHaveValue("#123456");
});

test("hex-only colors expose a screen sampler in the trailing control segment", async () => {
  const commits: string[] = [];
  const sampler: ScreenColorSampler = {
    isAvailable: async () => true,
    sample: async () => ({ status: "selected", color: "#0a5bcd" }),
  };

  function Harness() {
    const [value, setValue] = useState("#000000");
    return (
      <ColorFieldControl
        label="color"
        value={value}
        choices={[]}
        allowTokens={false}
        screenColorSampler={sampler}
        onChange={(nextValue) => {
          commits.push(nextValue);
          setValue(nextValue);
        }}
        onBlur={() => undefined}
      />
    );
  }

  render(<Harness />);
  const sampleButton = page.getByRole("button", {
    name: "Sample a screen color for color",
  });
  await expect.element(sampleButton).toBeVisible();
  await sampleButton.click();

  expect(commits).toEqual(["#0A5BCD"]);
  await expect.element(page.getByPlaceholder("#RRGGBB")).toHaveValue("#0A5BCD");
});

test("screen sampling cancellation is inert", async () => {
  const commits: string[] = [];
  const sampler: ScreenColorSampler = {
    isAvailable: async () => true,
    sample: async () => ({ status: "cancelled" }),
  };

  render(
    <ColorFieldControl
      label="color"
      value="#123456"
      choices={[]}
      allowTokens={false}
      screenColorSampler={sampler}
      onChange={(value) => commits.push(value)}
      onBlur={() => undefined}
    />,
  );
  const sampleButton = page.getByRole("button", {
    name: "Sample a screen color for color",
  });
  await expect.element(sampleButton).toBeVisible();
  await sampleButton.click();
  expect(commits).toEqual([]);
});

test("token colors retain their choices control instead of a screen sampler", async () => {
  const sampler: ScreenColorSampler = {
    isAvailable: async () => true,
    sample: async () => ({ status: "selected", color: "#0a5bcd" }),
  };
  render(
    <ColorFieldControl
      label="background"
      value="red"
      choices={[{ value: "red", color: "#B84A4F", source: "built-in" }]}
      allowTokens
      screenColorSampler={sampler}
      onChange={() => undefined}
      onBlur={() => undefined}
    />,
  );
  await expect
    .element(
      page.getByRole("button", {
        name: "Show color choices for background",
      }),
    )
    .toBeVisible();
  await expect
    .element(
      page.getByRole("button", {
        name: "Sample a screen color for background",
      }),
    )
    .not.toBeInTheDocument();
});

test("token choices expose contextual theme creation without changing the field", async () => {
  const commits: string[] = [];
  let creations = 0;
  render(
    <ColorFieldControl
      label="background"
      value="#123456"
      choices={[]}
      allowTokens
      onChange={(value) => commits.push(value)}
      onCreateTheme={() => {
        creations += 1;
      }}
      onBlur={() => undefined}
    />,
  );

  await page
    .getByRole("button", { name: "Show color choices for background" })
    .click();
  await page.getByRole("button", { name: "New Theme…" }).click();

  expect(creations).toBe(1);
  expect(commits).toEqual([]);
  await expect
    .element(page.getByRole("button", { name: "New Theme…" }))
    .not.toBeInTheDocument();
});
