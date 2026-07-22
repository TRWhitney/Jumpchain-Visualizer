import { useState } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ColorFieldControl } from "./ColorFieldControl";

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
