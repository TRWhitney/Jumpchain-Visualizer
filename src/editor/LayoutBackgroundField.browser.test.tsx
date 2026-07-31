import { useState } from "react";
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Format1LanguageService, type FormatSymbol } from "./languageService";
import { removeDocumentFields, setDocumentField } from "./documentEditor";
import { LayoutBackgroundField } from "./EditorWorkspace";

const initialFiles = {
  "jump.jdef": `jump
  format: 1
  name: "Background control"
  author: "Tester"
  version: "1"
  section-layout: card

section
  handle: content
  name: "Content"
  image
    handle: texture
    src: "texture.png"

section-layout
  handle: card

  stack
    background: white
    slot: name
`,
};

test("layout background switches between exclusive color and image controls", async () => {
  const service = new Format1LanguageService();
  const initialSymbol = service
    .analyze(initialFiles)
    .symbols.find((symbol) => symbol.kind === "stack")!;
  let creations = 0;

  function Harness() {
    const [files, setFiles] = useState(initialFiles);
    const symbol =
      service
        .analyze(files)
        .symbols.find((candidate) => candidate.kind === "stack") ??
      initialSymbol;
    const update = (field: string, value: string) =>
      setFiles(
        (current) =>
          setDocumentField(current, symbol, field, value).files as typeof files,
      );
    const switchMode = (mode: "color" | "image") =>
      setFiles((current) => {
        let next = current;
        for (const field of mode === "color"
          ? ["background-image", "background-fit"]
          : ["background"]) {
          const result = removeDocumentFields(next, symbol, field);
          next = result.files as typeof current;
        }
        return next;
      });
    return (
      <>
        <LayoutBackgroundField
          diagnostics={[]}
          files={files}
          symbol={symbol as FormatSymbol}
          showExplanatoryText
          onEndFieldEdit={() => undefined}
          onCreateImage={() => {
            creations += 1;
          }}
          onCreateTheme={() => undefined}
          onModeChange={switchMode}
          onUpdate={update}
        />
        <output data-testid="authored-source">{files["jump.jdef"]}</output>
      </>
    );
  }

  render(<Harness />);

  await expect
    .element(page.getByLabelText("Background", { exact: true }))
    .toHaveValue("white");
  const imageMode = page.getByRole("button", {
    name: "Image",
    exact: true,
  });
  imageMode.element().focus();
  await userEvent.keyboard("{Enter}");
  const image = page.getByRole("combobox", {
    name: "Background image",
    exact: true,
  });
  const fit = page.getByRole("combobox", {
    name: "Background fit",
    exact: true,
  });
  await expect.element(image).toBeVisible();
  await expect.element(fit).toBeEnabled();
  await expect.element(fit).toHaveValue("cover");
  await fit.selectOptions("tile");
  await expect.element(fit).toHaveValue("tile");
  await expect
    .element(page.getByTestId("authored-source"))
    .toHaveTextContent("background-fit: tile");

  await page
    .getByRole("button", {
      name: "Show handle choices for Background image",
    })
    .click();
  await page.getByRole("option", { name: "texture", exact: true }).click();
  await expect.element(image).toHaveValue("texture");
  await expect.element(fit).toBeEnabled();
  await expect.element(fit).toHaveValue("tile");
  await expect
    .element(page.getByTestId("authored-source"))
    .toHaveTextContent("background-fit: tile");

  await page
    .getByRole("button", {
      name: "Show handle choices for Background image",
    })
    .click();
  await page.getByRole("option", { name: "New Image…" }).click();
  expect(creations).toBe(1);

  await page.getByRole("button", { name: "Color", exact: true }).click();
  await expect
    .element(page.getByLabelText("Background", { exact: true }))
    .toHaveValue("");
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await expect.element(image).toHaveValue("");
  await expect.element(fit).toBeEnabled();
  await expect.element(fit).toHaveValue("cover");
});
