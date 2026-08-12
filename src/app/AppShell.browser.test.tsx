import { beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { AppShell } from "./AppShell";
import { IndexedDbChainRepository } from "../tracker/repository";
import { APPLICATION_DATABASE_NAME } from "../platform/indexedDb";
import { SettingsProvider } from "../settings/SettingsProvider";
import { MemorySettingsRepository } from "../settings/repository";
import { defaultSettings } from "../settings/model";
import { createDefaultTagProfile } from "../settings/tagProfile";

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(APPLICATION_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Test database deletion blocked."));
  });
  window.history.replaceState({}, "", "/");
  document.title = "Jumpchain Visualizer";
});

test("primary navigation updates paths, titles, selection, and route focus", async () => {
  const settings = defaultSettings(createDefaultTagProfile());
  settings.onboarding.welcomeTourStatus = "dismissed";
  render(
    <SettingsProvider repository={new MemorySettingsRepository(settings)}>
      <AppShell />
    </SettingsProvider>,
  );
  await page.getByRole("button", { name: "Open Editor" }).click();
  await nextRouteFocus();
  expect(document.activeElement).toBe(
    page.getByRole("heading", { name: "Your Jump projects" }).element(),
  );
  expect(window.location.pathname).toBe("/editor");
  expect(document.title).toBe("Editor · Jumpchain Visualizer");
  await expect
    .element(page.getByRole("button", { name: "Editor", exact: true }))
    .toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Create Project" }).click();
  await nextRouteFocus();
  expect(window.location.pathname).toMatch(/^\/editor\/[0-9a-f-]+$/);
  expect(document.activeElement).toBe(
    page.getByRole("heading", { name: "Untitled Jump", level: 1 }).element(),
  );
  await expect
    .element(page.getByLabelText("Untitled Jump Editor"))
    .toBeVisible();
});

test("the header theme shortcut reflects the effective theme and updates Settings", async () => {
  const settings = defaultSettings(createDefaultTagProfile());
  settings.onboarding.welcomeTourStatus = "dismissed";
  render(
    <SettingsProvider repository={new MemorySettingsRepository(settings)}>
      <AppShell />
    </SettingsProvider>,
  );

  const initialTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  const nextTheme = initialTheme === "light" ? "dark" : "light";
  const shortcut = page.getByRole("button", {
    name:
      initialTheme === "light"
        ? "Switch to dark theme"
        : "Switch to light theme",
  });
  await expect.element(shortcut).toHaveAttribute("data-theme", initialTheme);
  await shortcut.click();
  await expect
    .element(document.documentElement)
    .toHaveAttribute("data-app-theme", nextTheme);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect
    .element(page.getByLabelText("Appearance"))
    .toHaveValue(nextTheme);
});

const nextRouteFocus = () =>
  new Promise<void>((resolve) =>
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => resolve()),
    ),
  );

function renderShellWithMockData() {
  const settings = defaultSettings(createDefaultTagProfile());
  settings.developer.showMockData = true;
  settings.onboarding.welcomeTourStatus = "dismissed";
  render(
    <SettingsProvider repository={new MemorySettingsRepository(settings)}>
      <AppShell />
    </SettingsProvider>,
  );
}

test("the real Chain Tracker mounts without duplicate application chrome and retains state", async () => {
  renderShellWithMockData();
  const chainRecent = page.getByRole("region", { name: "Chains" });
  await chainRecent.getByRole("button", { name: "Resume" }).first().click();
  await expect
    .element(page.getByLabelText("Interactive Chain Tracker workspace"))
    .toBeVisible();
  expect(
    document.querySelector(".app-chain-workspace .chain-mock-header"),
  ).toBeNull();
  expect(
    document.querySelectorAll(".app-chain-workspace .chain-jump-entry"),
  ).toHaveLength(4);
  await page.getByRole("tab", { name: /^Inventory/ }).click();

  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await chainRecent.getByRole("button", { name: "Resume" }).first().click();
  await expect
    .element(page.getByRole("tab", { name: /^Inventory/ }))
    .toHaveAttribute("aria-selected", "true");
  await expect
    .element(page.getByRole("button", { name: "Settings" }))
    .toBeEnabled();
});

test("the chain hub creates and renames records from the single demo chain", async () => {
  renderShellWithMockData();
  const homeChains = page.getByRole("region", { name: "Chains" });
  await expect.element(homeChains).toBeVisible();
  expect(
    homeChains.element().querySelectorAll(".app-recent-work"),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Open Chain Tracker" }).click();
  expect(document.querySelectorAll(".app-chain-card")).toHaveLength(1);

  await page.getByLabelText("Start a new chain").fill("Lantern Road");
  await page.getByRole("button", { name: "Start Chain" }).click();
  expect(window.location.pathname).toBe("/chain/ch-new-1");
  const tracker = page.getByLabelText("Interactive Chain Tracker workspace");
  await expect.element(tracker).toBeVisible();
  expect(tracker.element().textContent).toContain("Lantern Road");
  await page.getByRole("tab", { name: "Supplements" }).click();
  const supplementToggles = tracker
    .element()
    .querySelectorAll<HTMLInputElement>(
      ".supplement-manage-list input[type='checkbox']",
    );
  expect(supplementToggles).toHaveLength(8);
  expect([...supplementToggles].every((toggle) => !toggle.checked)).toBe(true);
  expect(
    [
      ...tracker
        .element()
        .querySelectorAll<HTMLButtonElement>(".supplement-manage-list button"),
    ].every((button) => button.disabled),
  ).toBe(true);

  await page
    .getByRole("button", { name: "Chain Tracker", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit Lantern Road" }).click();
  await page.getByLabelText("Chain name").fill("Lantern Sea");
  await page
    .getByLabelText("Description")
    .fill("A chain across bright waters.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect
    .element(page.getByRole("heading", { name: "Lantern Sea" }))
    .toBeVisible();
  await page.getByLabelText("Search saved chains").fill("bright waters");
  expect(document.querySelectorAll(".app-chain-card")).toHaveLength(1);
  await expect
    .element(page.getByText("A chain across bright waters."))
    .toBeVisible();
  const repository = new IndexedDbChainRepository();
  await expect
    .poll(async () => (await repository.load("ch-new-1"))?.name)
    .toBe("Lantern Sea");
  expect((await repository.load("ch-new-1"))?.description).toBe(
    "A chain across bright waters.",
  );
});

test("primary-tag name colors are opt-in while summaries remain available", async () => {
  renderShellWithMockData();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Chain Tracker" }).click();
  await page.getByLabelText("Color chain names").click();
  await page.getByRole("button", { name: "Close Settings" }).click();
  await nextRouteFocus();
  await expect
    .element(page.getByRole("region", { name: "Chains" }))
    .toBeVisible();
  expect(
    document.querySelectorAll(".app-recent-work strong.is-primary-tag-colored"),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Open Chain Tracker" }).click();
  await expect
    .element(page.getByRole("button", { name: "Show Morgan tag summary" }))
    .toBeVisible();
  const coloredNames = document.querySelectorAll(
    ".app-chain-card-copy h3.is-primary-tag-colored",
  );
  expect(coloredNames).toHaveLength(1);
  expect(coloredNames[0].getAttribute("data-primary-tag")).toBe("magic");
});

test("tag presentation changes project into canonical Inventory badges", async () => {
  renderShellWithMockData();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Tags" }).click();
  await page.getByRole("button", { name: /^Primary Tags/ }).click();
  await page
    .getByRole("button")
    .filter({ hasText: /^Physical/ })
    .click();
  await page.getByLabelText("Solid color").fill("#00aa55");
  await page.getByRole("button", { name: "Close Settings" }).click();
  await page
    .getByRole("region", { name: "Chains" })
    .getByRole("button", { name: "Resume" })
    .first()
    .click();
  await page.getByRole("tab", { name: /^Inventory/ }).click();
  const physical = [
    ...document.querySelectorAll<HTMLElement>(
      ".chain-record-list .tag-profile-badge",
    ),
  ].find((badge) => badge.textContent === "Physical");
  expect(physical).toBeDefined();
  expect(getComputedStyle(physical!).backgroundColor).toBe("rgb(0, 170, 85)");
});
