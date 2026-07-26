import { useState } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { useSettingDefaultedState } from "./useSettingDefaultedState";

function DisclosureHarness() {
  const [collapsedByDefault, setCollapsedByDefault] = useState(false);
  const [open, setOpen] = useSettingDefaultedState(
    collapsedByDefault,
    !collapsedByDefault,
  );
  return (
    <>
      <button
        type="button"
        onClick={() => setCollapsedByDefault((value) => !value)}
      >
        Change setting
      </button>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Disclosure
      </button>
    </>
  );
}

test("a setting change resets mounted local state without persisting manual toggles", async () => {
  render(<DisclosureHarness />);
  const disclosure = page.getByRole("button", { name: "Disclosure" });
  const setting = page.getByRole("button", { name: "Change setting" });

  await expect.element(disclosure).toHaveAttribute("aria-expanded", "true");
  await disclosure.click();
  await expect.element(disclosure).toHaveAttribute("aria-expanded", "false");

  await setting.click();
  await expect.element(disclosure).toHaveAttribute("aria-expanded", "false");
  await disclosure.click();
  await expect.element(disclosure).toHaveAttribute("aria-expanded", "true");

  await setting.click();
  await expect.element(disclosure).toHaveAttribute("aria-expanded", "true");
});
