import { useState } from "react";
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ContextMenuProvider } from "../ui";
import { SpellingTextArea } from "./SpellingTextControl";
import type { SpellingEngine } from "./spelling";

const engine: SpellingEngine = {
  correct: (word) => word.toLowerCase() !== "thd",
  suggest: (word) => (word.toLowerCase() === "thd" ? ["the", "tad"] : []),
};

function Harness() {
  const [value, setValue] = useState("thd location");
  return (
    <ContextMenuProvider>
      <SpellingTextArea
        aria-label="Text"
        spellingEngine={engine}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onSpellingChange={setValue}
      />
    </ContextMenuProvider>
  );
}

function contextMenu(control: HTMLTextAreaElement, init: MouseEventInit = {}) {
  const event = new control.ownerDocument.defaultView!.MouseEvent(
    "contextmenu",
    {
      bubbles: true,
      cancelable: true,
      clientX: 20,
      clientY: 20,
      ...init,
    },
  );
  control.dispatchEvent(event);
  return event;
}

test("right click offers and applies a correction for the exact word", async () => {
  render(<Harness />);
  const text = page.getByLabelText("Text");
  await expect
    .element(text)
    .toHaveAttribute("data-spelling-suggestions", "ready");
  const control = text.element() as HTMLTextAreaElement;
  control.focus();
  control.setSelectionRange(0, 3);

  const event = contextMenu(control);
  expect(event.defaultPrevented).toBe(true);
  const menu = page.getByRole("menu", {
    name: "Spelling suggestions for “thd”",
  });
  await expect.element(menu).toBeVisible();
  await userEvent.click(menu.getByRole("menuitem", { name: "the" }));

  await expect.element(text).toHaveValue("the location");
  await expect.poll(() => document.activeElement).toBe(control);
  expect(control.selectionStart).toBe(3);
  expect(control.selectionEnd).toBe(3);
});

test("correct words and Shift-right-click retain the native menu path", async () => {
  render(<Harness />);
  const text = page.getByLabelText("Text");
  await expect.element(text).toBeVisible();
  const control = text.element() as HTMLTextAreaElement;

  control.setSelectionRange(4, 12);
  expect(contextMenu(control).defaultPrevented).toBe(false);
  await expect
    .element(page.getByRole("menu", { name: /Spelling suggestions/ }))
    .not.toBeInTheDocument();

  control.setSelectionRange(0, 3);
  expect(contextMenu(control, { shiftKey: true }).defaultPrevented).toBe(false);
  await expect
    .element(page.getByRole("menu", { name: /Spelling suggestions/ }))
    .not.toBeInTheDocument();
});
