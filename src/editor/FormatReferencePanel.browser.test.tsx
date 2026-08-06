import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { FormatReferencePanel } from "./FormatReferencePanel";

test("the Format 1 reference uses the shared hovering panel focus path", async () => {
  const close = vi.fn();
  const entryChange = vi.fn();
  render(
    <FormatReferencePanel
      entryId={null}
      onClose={close}
      onEntryChange={entryChange}
    />,
  );

  const dialog = page.getByRole("dialog", {
    name: "Format 1 author reference",
  });
  const closeButton = page.getByRole("button", {
    name: "Close Format 1 author reference",
  });
  await expect.element(dialog).toBeVisible();
  await expect.element(closeButton).toHaveFocus();

  const frame = document.querySelector<HTMLIFrameElement>(
    'iframe[title="Format 1 author reference"]',
  );
  expect(frame?.getAttribute("src")).toBe(
    "/documentation/guides/format-1-reference.html?embedded=1",
  );
  expect(frame?.tabIndex).toBe(0);

  window.dispatchEvent(
    new MessageEvent("message", {
      source: frame?.contentWindow,
      data: {
        type: "jumpchain:format-reference-location",
        entryId: "field-description",
      },
    }),
  );
  expect(entryChange).toHaveBeenCalledWith("field-description");

  await userEvent.keyboard("{Escape}");
  expect(close).toHaveBeenCalledOnce();
});
