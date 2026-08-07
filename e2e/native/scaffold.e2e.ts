import { mkdir } from "node:fs/promises";
import { browser, expect } from "@wdio/globals";

async function nativeWindowTheme() {
  return browser.executeAsync<"light" | "dark">((done) => {
    const tauri = (
      window as typeof window & {
        __TAURI_INTERNALS__: {
          invoke<T>(command: string, arguments_: object): Promise<T>;
        };
      }
    ).__TAURI_INTERNALS__;
    void tauri
      .invoke<"light" | "dark">("plugin:window|theme", { label: "main" })
      .then(done);
  });
}

async function expectNativeWindowTheme(theme: "light" | "dark") {
  await browser.waitUntil(async () => (await nativeWindowTheme()) === theme, {
    timeoutMsg: `native window theme did not become ${theme}`,
  });
  expect(await nativeWindowTheme()).toBe(theme);
}

describe("native application scaffold", () => {
  it("opens the Tauri window", async () => {
    await expect($("#root")).toExist();
    const welcome = await $("h2=Welcome to Jumpchain Visualizer");
    if (await welcome.isExisting()) {
      await $("button=Exit tour").click();
      const interfaceChoice = await $("h2=Choose your interface");
      await expect(interfaceChoice).toBeDisplayed();
      await $("button*=Advanced").click();
      await expect(interfaceChoice).not.toBeDisplayed();
      await expect(welcome).not.toBeDisplayed();
    }
  });

  it("keeps CodeMirror layout styles under the packaged CSP", async () => {
    await $("button=Open Editor").click();
    await $("button=Create Project").click();
    await expect($(".production-editor")).toBeDisplayed();
    const advancedViews = await $("button=Advanced views");
    if (
      (await advancedViews.isExisting()) &&
      (await advancedViews.getAttribute("aria-expanded")) === "false"
    )
      await advancedViews.click();
    await $("button=Source").click();
    await $("button=Jump appearance").click();
    const source = await $("[aria-label='layout.jdef source']");
    await expect(source).toBeDisplayed();

    const geometry = await browser.execute(() => {
      const anchor = document.getElementById(
        "tauri-csp-style-nonce",
      ) as HTMLStyleElement | null;
      const editor = document.querySelector(".editor-code-editor .cm-editor");
      const firstLine = document.querySelector(".editor-code-editor .cm-line");
      const firstGutterLine = document.querySelector(
        ".editor-code-editor .cm-lineNumbers .cm-gutterElement:not(:empty)",
      );
      const activeLine = document.querySelector(
        ".editor-code-editor .cm-activeLine",
      );
      if (!anchor || !editor || !firstLine || !firstGutterLine || !activeLine)
        return null;
      const anchorNonce = anchor.nonce;
      const editorBox = editor.getBoundingClientRect();
      const lineBox = firstLine.getBoundingClientRect();
      const gutterBox = firstGutterLine.getBoundingClientRect();
      const activeLineBox = activeLine.getBoundingClientRect();
      return {
        anchorNonce,
        matchingDynamicStyles: [
          ...document.head.querySelectorAll("style"),
        ].filter((style) => style !== anchor && style.nonce === anchorNonce)
          .length,
        editorTop: editorBox.top,
        firstLineTop: lineBox.top,
        firstGutterLineTop: gutterBox.top,
        activeLineHeight: activeLineBox.height,
      };
    });

    const broken =
      !geometry ||
      !geometry.anchorNonce ||
      geometry.matchingDynamicStyles < 1 ||
      Math.abs(geometry.firstLineTop - geometry.firstGutterLineTop) > 16 ||
      geometry.firstLineTop - geometry.editorTop > 60 ||
      geometry.activeLineHeight > 40;
    if (broken) {
      await mkdir("test-results/native", { recursive: true });
      await browser.saveScreenshot(
        "test-results/native/codemirror-csp-layout-failure.png",
      );
    }

    expect(geometry).not.toBeNull();
    expect(geometry!.anchorNonce).not.toBe("");
    expect(geometry!.matchingDynamicStyles).toBeGreaterThanOrEqual(1);
    expect(
      Math.abs(geometry!.firstLineTop - geometry!.firstGutterLineTop),
    ).toBeLessThanOrEqual(16);
    expect(geometry!.firstLineTop - geometry!.editorTop).toBeLessThanOrEqual(
      60,
    );
    expect(geometry!.activeLineHeight).toBeLessThanOrEqual(40);
  });

  it("keeps the author-reference pattern tester content-sized", async () => {
    await $("button[aria-label='Open Format 1 author reference']").click();
    const referenceFrame = await $("iframe[title='Format 1 author reference']");
    await expect(referenceFrame).toBeDisplayed();
    await browser.switchFrame(referenceFrame);

    const lexicalRules = await $("#lexical-rules");
    const lexicalSummary = await lexicalRules.$("summary");
    if ((await lexicalRules.getAttribute("open")) === null)
      await lexicalSummary.click();
    await $("button[aria-label='Test handle pattern']").click();
    const tester = await $("#lexical-tester-handlePattern-popover");
    await expect(tester).toBeDisplayed();

    const geometry = await browser.execute(() => {
      const popover = document.querySelector(
        "#lexical-tester-handlePattern-popover",
      );
      const pattern = popover?.querySelector(".lexical-tester-pattern");
      const label = popover?.querySelector("label");
      const control = popover?.querySelector(".lexical-tester-control");
      const status = popover?.querySelector("[data-lexical-status]");
      if (!popover || !pattern || !label || !control || !status) return null;
      const box = (element: Element) => {
        const { top, bottom, height } = element.getBoundingClientRect();
        return { top, bottom, height };
      };
      return {
        tester: box(popover),
        pattern: box(pattern),
        label: box(label),
        control: box(control),
        status: box(status),
      };
    });

    await browser.switchFrame(null);
    await $("button[aria-label='Close Format 1 author reference']").click();

    expect(geometry).not.toBeNull();
    expect(geometry!.tester.height).toBeLessThanOrEqual(280);
    expect(geometry!.pattern.height).toBeLessThanOrEqual(32);
    expect(geometry!.control.height).toBeLessThanOrEqual(56);
    expect(geometry!.label.top - geometry!.pattern.bottom).toBeLessThanOrEqual(
      24,
    );
    expect(geometry!.status.top - geometry!.control.bottom).toBeLessThanOrEqual(
      24,
    );
  });

  it("syncs light and dark preferences with the native window theme", async () => {
    await expect($("html")).toHaveAttribute("lang", "en");
    const dismissNotification = await $(
      "button[aria-label='Dismiss notification']",
    );
    if (await dismissNotification.isExisting())
      await dismissNotification.click();
    const settings = await $("button=Settings");
    await settings.click();
    const generalTab = await $("button=General");
    await expect(generalTab).toExist();
    await generalTab.click();
    const language = await $("#language-selection");
    await expect(language).toHaveValue("en");
    const appearance = await $("#theme");
    await appearance.selectByAttribute("value", "dark");
    await expect($("html")).toHaveAttribute("data-app-theme", "dark");
    await expectNativeWindowTheme("dark");
    await appearance.selectByAttribute("value", "light");
    await expect($("html")).toHaveAttribute("data-app-theme", "light");
    await expectNativeWindowTheme("light");
    await appearance.selectByAttribute("value", "dark");
    await expectNativeWindowTheme("dark");
  });

  it("opens the Editor theme color picker under the native dark theme", async () => {
    await $("button[aria-label='Close Settings']").click();
    await $("button=Structured").click();
    await $("button=Add").click();
    await $("button=Theme").click();
    await expect($("h2=new_theme")).toBeDisplayed();
    const picker = await $(
      "input[aria-label='Choose Color with color picker']",
    );
    await expect(picker).toBeDisplayed();
    await expectNativeWindowTheme("dark");
    await picker.click();
    await browser.keys(["Escape"]);
  });
});
