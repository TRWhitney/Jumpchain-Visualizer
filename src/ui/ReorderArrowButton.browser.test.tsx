import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ReorderArrowButton } from "./ReorderArrowButton";

test("an unavailable reorder arrow is hidden but retains its layout cell", async () => {
  render(
    <div style={{ display: "grid", gridTemplateColumns: "2rem 2rem" }}>
      <ReorderArrowButton
        aria-label="Move first up"
        direction="up"
        unavailable
      />
      <ReorderArrowButton
        aria-label="Move first down"
        direction="down"
        unavailable={false}
      />
    </div>,
  );

  await expect
    .element(page.getByRole("button", { name: "Move first down" }))
    .toBeVisible();

  const hidden = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Move first up"]',
  )!;
  expect(getComputedStyle(hidden).visibility).toBe("hidden");
  expect(hidden.disabled).toBe(true);
  expect(hidden.getBoundingClientRect().width).toBe(32);
  expect(page.getByRole("button").all()).toHaveLength(1);
});
