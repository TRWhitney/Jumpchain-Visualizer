import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ConditionalVariants } from "./ConditionalVariants";

test("inserts a named value at the conditional text caret", async () => {
  const updates: string[] = [];
  render(
    <ConditionalVariants
      fieldName="content"
      fieldLabel="Text"
      showExplanatoryText
      baseOccurrence={0}
      variants={[
        {
          baseOccurrence: 0,
          occurrence: 0,
          condition: "gauntlet",
          value: "Before after",
        },
      ]}
      fieldType="richText"
      properties={[
        {
          handle: "answer",
          type: "string",
          category: "package",
          origins: [
            {
              kind: "grant",
              ownerKind: "choice",
              ownerHandle: "prompt",
            },
          ],
          values: [],
          mayBeUnset: true,
        },
      ]}
      diagnostics={[]}
      onUpdate={(_, __, value) => updates.push(value)}
      onMove={() => undefined}
      onEndFieldEdit={() => undefined}
    />,
  );

  const text = page.getByRole("textbox", {
    name: "Text conditional value",
  });
  await expect.element(text).toBeVisible();
  (text.element() as HTMLTextAreaElement).setSelectionRange(7, 7);
  await page.getByRole("button", { name: "Insert value…" }).click();
  await page.getByRole("menuitem", { name: /answer/i }).click();

  expect(updates.at(-1)).toBe("Before {{answer}}after");
  await expect.element(text).toHaveFocus();
});

test("the Insert value menu hides teaching subtext without hiding available values", async () => {
  render(
    <ConditionalVariants
      fieldName="content"
      fieldLabel="Text"
      showExplanatoryText={false}
      baseOccurrence={0}
      variants={[
        {
          baseOccurrence: 0,
          occurrence: 0,
          condition: "gauntlet",
          value: "Answer",
        },
      ]}
      fieldType="richText"
      properties={[
        {
          handle: "input_answer",
          type: "string",
          category: "package",
          origins: [
            {
              kind: "grant",
              ownerKind: "input",
              ownerHandle: "follow_up",
            },
          ],
          values: [],
          mayBeUnset: true,
        },
      ]}
      diagnostics={[]}
      onUpdate={() => undefined}
      onMove={() => undefined}
      onEndFieldEdit={() => undefined}
    />,
  );

  const trigger = page.getByRole("button", { name: "Insert value…" });
  await expect.element(trigger).toBeVisible();
  (trigger.element() as HTMLButtonElement).focus();
  await userEvent.keyboard("{ArrowDown}");
  const menu = page.getByRole("menu", { name: "Insert value…" });
  await expect
    .element(menu.getByRole("menuitem", { name: "input_answer" }))
    .toHaveFocus();
  await expect
    .element(menu.getByRole("menuitem", { name: "input_answer" }))
    .toBeVisible();
  await expect
    .element(menu.getByText("Text", { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(menu.getByText(/from input “follow_up”/i))
    .not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await expect.element(trigger).toHaveFocus();
});
