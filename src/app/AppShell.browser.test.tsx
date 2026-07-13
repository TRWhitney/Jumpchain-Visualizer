import { beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { AppShell } from "./AppShell";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  document.title = "Jumpchain Visualizer";
});

test("primary navigation updates paths, titles, selection, and route focus", async () => {
  render(<AppShell />);
  await page.getByRole("button", { name: "Open Editor" }).click();
  await nextRouteFocus();
  expect(document.activeElement).toBe(
    page
      .getByRole("heading", { name: "Create or open a Jump package" })
      .element(),
  );
  expect(window.location.pathname).toBe("/editor");
  expect(document.title).toBe("Editor · Jumpchain Visualizer");
  await expect
    .element(page.getByRole("button", { name: "Editor", exact: true }))
    .toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Open Example Jump" }).click();
  await nextRouteFocus();
  expect(window.location.pathname).toBe("/editor/ws-7f3a");
  expect(document.activeElement).toBe(
    page.getByRole("heading", { name: "Example Jump" }).element(),
  );
});

const nextRouteFocus = () =>
  new Promise<void>((resolve) =>
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => resolve()),
    ),
  );

test("the real Chain Tracker mounts without duplicate application chrome and retains state", async () => {
  render(<AppShell />);
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
  ).toHaveLength(8);
  await page.getByRole("tab", { name: /^Inventory/ }).click();

  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await chainRecent.getByRole("button", { name: "Resume" }).first().click();
  await expect
    .element(page.getByRole("tab", { name: /^Inventory/ }))
    .toHaveAttribute("aria-selected", "true");
  await expect
    .element(page.getByRole("button", { name: "Settings" }))
    .toBeDisabled();
});

test("the chain hub creates and renames records and Home limits recents", async () => {
  render(<AppShell />);
  const homeChains = page.getByRole("region", { name: "Chains" });
  await expect.element(homeChains).toBeVisible();
  expect(
    homeChains.element().querySelectorAll(".app-recent-work"),
  ).toHaveLength(5);
  await homeChains.getByRole("button", { name: "View all 8 chains" }).click();
  expect(document.querySelectorAll(".app-chain-card")).toHaveLength(8);

  await page.getByLabelText("Start a new chain").fill("Lantern Road");
  await page.getByRole("button", { name: "Start Chain" }).click();
  expect(window.location.pathname).toBe("/chain/ch-new-1");
  const tracker = page.getByLabelText("Interactive Chain Tracker workspace");
  await expect.element(tracker).toBeVisible();
  expect(tracker.element().textContent).toContain("Lantern Road");

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
});

test("primary-tag name colors are opt-in while summaries remain available", async () => {
  render(<AppShell preferences={{ colorChainNamesByPrimaryTag: true }} />);
  await expect
    .element(page.getByRole("region", { name: "Chains" }))
    .toBeVisible();
  expect(
    document.querySelectorAll(".app-recent-work strong.is-primary-tag-colored"),
  ).toHaveLength(5);
  await page.getByRole("button", { name: "Open Chain Tracker" }).click();
  await expect
    .element(page.getByRole("button", { name: "Show Morgan tag summary" }))
    .toBeVisible();
  const coloredNames = document.querySelectorAll(
    ".app-chain-card-copy h3.is-primary-tag-colored",
  );
  expect(coloredNames).toHaveLength(8);
  expect(coloredNames[0].getAttribute("data-primary-tag")).toBe("magic");
});
