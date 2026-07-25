import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ContextMenuProvider } from "./ContextMenu";
import { useContextMenu, type ContextMenuRequest } from "./contextMenuModel";

function Harness() {
  const { openContextMenu, openContextMenuFromKeyboard } = useContextMenu();
  const [result, setResult] = useState("none");
  const request: ContextMenuRequest = {
    label: "Example actions",
    actions: [
      { id: "open", label: "Open", onAction: () => setResult("open") },
      {
        id: "disabled",
        label: "Unavailable",
        disabled: true,
        onAction: () => setResult("disabled"),
      },
      {
        id: "delete",
        label: "Delete",
        danger: true,
        separatorBefore: true,
        onAction: () => setResult("delete"),
      },
    ],
  };
  return (
    <div data-context-menu-suppress-noneditable-controls>
      <button
        type="button"
        aria-haspopup="menu"
        onContextMenu={(event) => openContextMenu(event, request)}
        onKeyDown={(event) => openContextMenuFromKeyboard(event, request)}
      >
        Target
      </button>
      <button type="button">Settings control</button>
      <select aria-label="Settings dropdown" defaultValue="one">
        <option value="one">One</option>
      </select>
      <input
        aria-label="Standalone color"
        type="color"
        defaultValue="#335577"
      />
      <input aria-label="Editable value" />
      <output aria-label="Result">{result}</output>
    </div>
  );
}

afterEach(() => {
  document.documentElement.dir = "ltr";
});

test("context menus support pointer and WAI keyboard navigation", async () => {
  render(
    <ContextMenuProvider>
      <Harness />
    </ContextMenuProvider>,
  );

  const target = page.getByRole("button", { name: "Target" });
  await expect.element(target).toBeVisible();
  const targetElement = target.element();
  targetElement.dispatchEvent(
    new targetElement.ownerDocument.defaultView!.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 20,
      clientY: 20,
    }),
  );
  const menu = page.getByRole("menu", { name: "Example actions" });
  await expect.element(menu).toBeVisible();
  await expect
    .element(menu.getByRole("menuitem", { name: "Open" }))
    .toHaveFocus();

  await userEvent.keyboard("{ArrowDown}");
  await expect
    .element(menu.getByRole("menuitem", { name: "Unavailable" }))
    .toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(page.getByLabelText("Result")).toHaveTextContent("none");
  await userEvent.keyboard("{End}");
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByLabelText("Result"))
    .toHaveTextContent("delete");

  target.element().focus();
  await userEvent.keyboard("{Shift>}{F10}{/Shift}");
  await expect.element(menu).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(menu).not.toBeInTheDocument();
});

test("application controls suppress browser chrome but editable values retain it", async () => {
  render(
    <ContextMenuProvider>
      <Harness />
    </ContextMenuProvider>,
  );
  await expect
    .element(page.getByRole("button", { name: "Settings control" }))
    .toBeVisible();
  const settingsControl = page
    .getByRole("button", { name: "Settings control" })
    .element();
  const controlEvent =
    new settingsControl.ownerDocument.defaultView!.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
  expect(settingsControl.dispatchEvent(controlEvent)).toBe(false);
  expect(controlEvent.defaultPrevented).toBe(true);

  for (const label of ["Settings dropdown", "Standalone color"]) {
    const control = page.getByLabelText(label).element();
    const event = new control.ownerDocument.defaultView!.MouseEvent(
      "contextmenu",
      {
        bubbles: true,
        cancelable: true,
      },
    );
    expect(control.dispatchEvent(event)).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  }

  const input = page.getByLabelText("Editable value").element();
  const inputEvent = new input.ownerDocument.defaultView!.MouseEvent(
    "contextmenu",
    {
      bubbles: true,
      cancelable: true,
    },
  );
  expect(input.dispatchEvent(inputEvent)).toBe(true);
  expect(inputEvent.defaultPrevented).toBe(false);
});

test("measured menus remain inside the viewport in RTL", async () => {
  render(
    <ContextMenuProvider>
      <Harness />
    </ContextMenuProvider>,
  );
  const target = page.getByRole("button", { name: "Target" });
  await expect.element(target).toBeVisible();
  target.element().ownerDocument.documentElement.dir = "rtl";
  target.element().focus();
  await userEvent.keyboard("{Shift>}{F10}{/Shift}");
  const bounds = page
    .getByRole("menu", { name: "Example actions" })
    .element()
    .getBoundingClientRect();
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
});
