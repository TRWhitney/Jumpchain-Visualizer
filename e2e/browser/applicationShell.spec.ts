import { expect, test, type Locator, type Page } from "./support/fixtures";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { shouldCaptureReviewArtifacts } from "./support/reviewArtifacts";

async function expectModalBelowRouter(page: Page, layer: Locator) {
  const [routerBox, layerBox] = await Promise.all([
    page.getByLabel("Application location").boundingBox(),
    layer.boundingBox(),
  ]);
  expect(routerBox).not.toBeNull();
  expect(layerBox).not.toBeNull();
  expect(
    Math.abs(layerBox!.y - (routerBox!.y + routerBox!.height)),
  ).toBeLessThan(2);
  expect(layerBox!.height).toBeGreaterThan(300);
}

async function resolveColorToken(page: Page, token: string) {
  return page.locator("html").evaluate((element, customProperty) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${customProperty})`;
    element.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

async function resumeMorgan(page: Page) {
  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await page
    .getByRole("region", { name: "Chains" })
    .getByRole("button", { name: "Resume" })
    .first()
    .click();
  return page.getByLabel("Interactive Chain Tracker workspace");
}

async function expectStoredChain(page: Page, id: string) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ databaseName, databaseVersion, chainId }) =>
          new Promise<boolean>((resolve, reject) => {
            const open = indexedDB.open(databaseName, databaseVersion);
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const database = open.result;
              const request = database
                .transaction("chains", "readonly")
                .objectStore("chains")
                .get(chainId);
              request.onerror = () => {
                database.close();
                reject(request.error);
              };
              request.onsuccess = () => {
                database.close();
                resolve(Boolean(request.result));
              };
            };
          }),
        {
          databaseName: "jumpchain-visualizer",
          databaseVersion: 4,
          chainId: id,
        },
      ),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Developer" }).click();
  await page.getByLabel("Show mock fixtures").check();
  await page.getByRole("tab", { name: "General" }).click();
  await page.getByRole("button", { name: "Close Settings" }).click();
});

test("Home matches the shell proposal and exposes explicit workspace choices and recents", async ({
  page,
}) => {
  const shell = page.getByLabel("Jumpchain Visualizer application");
  await expect(shell).toBeVisible();
  await expect(
    shell.getByRole("button", { name: "Jumpchain Visualizer" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(shell.getByRole("button", { name: "Settings" })).toBeEnabled();
  await expect(shell.locator(".app-entry-grid > article")).toHaveCount(2);
  await expect(
    shell.getByRole("heading", { name: "Start a Chain" }),
  ).toBeVisible();
  await expect(
    shell.getByRole("region", { name: "Editor workspaces" }),
  ).toContainText("No Editor workspaces here.");
  await expect(shell.getByRole("region", { name: "Chains" })).toContainText(
    "Morgan",
  );
  await expect(
    shell.getByRole("region", { name: "Chains" }).locator(".app-recent-work"),
  ).toHaveCount(1);
  await expect(
    shell.getByLabel("Application location").locator("code"),
  ).toHaveText("/");
});

test(
  "workspace navigation uses real paths, history, titles, and predictable focus",
  { tag: ["@smoke", "@cross-browser"] },
  async ({ page }) => {
    await page.getByRole("button", { name: "Open Editor" }).click();
    await expect(page).toHaveURL(/\/editor$/);
    await expect(page).toHaveTitle("Editor · Jumpchain Visualizer");
    await expect(
      page.getByRole("heading", { name: "Your Jump projects" }),
    ).toBeFocused();

    await page.getByRole("button", { name: "Create Project" }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/);
    await expect(page).toHaveTitle("Untitled Jump · Editor");
    await expect(
      page.getByRole("heading", { name: "Untitled Jump", level: 1 }),
    ).toBeFocused();
    const editorPath = new URL(page.url()).pathname;

    await page
      .getByRole("button", { name: "Chain Tracker", exact: true })
      .click();
    await expect(page).toHaveURL(/\/chain$/);
    await expect(
      page.getByRole("heading", { name: "Your chains" }),
    ).toBeFocused();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(editorPath);
    await expect(
      page.getByRole("heading", { name: "Untitled Jump", level: 1 }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Forward" }).click();
    await expect(page).toHaveURL(/\/chain$/);
  },
);

test(
  "recent work opens addressable Editor and real Chain Tracker workspaces",
  { tag: "@smoke" },
  async ({ page }) => {
    await page.getByRole("button", { name: "Open Editor" }).click();
    await page.getByRole("button", { name: "Create Project" }).click();
    await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
    await page
      .getByRole("region", { name: "Editor workspaces" })
      .getByRole("button", { name: "Resume" })
      .click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/);
    await expect(page.getByLabel("Untitled Jump Editor")).toBeVisible();

    await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
    await page
      .getByRole("region", { name: "Chains" })
      .getByRole("button", { name: "Resume" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/chain\/ch-92b1$/);
    const tracker = page.getByLabel("Interactive Chain Tracker workspace");
    await expect(tracker).toBeVisible();
    await expect(tracker.locator(".chain-mock-header")).toHaveCount(0);
    await expect(tracker.locator(".chain-jump-entry")).toHaveCount(4);
    await expect(
      page.getByRole("button", { name: "Chain Tracker", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  },
);

test("project and chain recents and hub cards expose exact-target context actions", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open Editor" }).click();
  await page.getByRole("button", { name: "Create Project" }).click();
  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();

  const projectRecent = page
    .getByRole("region", { name: "Editor workspaces" })
    .locator(".app-recent-work")
    .filter({ hasText: "Untitled Jump" });
  await projectRecent.click({ button: "right" });
  const projectMenu = page.getByRole("menu", {
    name: "Untitled Jump project actions",
  });
  await expect(projectMenu.getByRole("menuitem")).toHaveText([
    "Open",
    "Star",
    "Export .jmp…",
    "Delete project…",
  ]);
  await projectMenu.getByRole("menuitem", { name: "Star" }).click();
  await expect(
    projectRecent.getByRole("img", { name: "Untitled Jump is starred" }),
  ).toBeVisible();

  await projectRecent.click({ button: "right" });
  await page
    .getByRole("menu", { name: "Untitled Jump project actions" })
    .getByRole("menuitem", { name: "Export .jmp…" })
    .click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Export Untitled Jump as .jmp",
  );
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel" })
    .click();

  await projectRecent.click({ button: "right" });
  await page
    .getByRole("menu", { name: "Untitled Jump project actions" })
    .getByRole("menuitem", { name: "Delete project…" })
    .click();
  const projectDelete = page.getByRole("alertdialog", {
    name: "Delete Untitled Jump?",
  });
  await expect(projectDelete).toBeVisible();
  await projectDelete.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Editor", exact: true }).click();
  const projectCard = page
    .locator(".editor-project-card")
    .filter({ hasText: "Untitled Jump" });
  await projectCard.click({ button: "right" });
  await expect(
    page
      .getByRole("menu", { name: "Untitled Jump project actions" })
      .getByRole("menuitem"),
  ).toHaveText(["Open", "Unstar", "Export .jmp…", "Delete project…"]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();

  const chainRecent = page
    .getByRole("region", { name: "Chains" })
    .locator(".app-recent-work")
    .filter({ hasText: "Morgan" });
  await chainRecent.click({ button: "right" });
  const chainMenu = page.getByRole("menu", {
    name: "Morgan chain actions",
  });
  await expect(chainMenu.getByRole("menuitem")).toHaveText([
    "Open",
    "Star",
    "Delete chain…",
  ]);
  await chainMenu.getByRole("menuitem", { name: "Star" }).click();
  await expect(
    chainRecent.getByRole("img", { name: "Morgan is starred" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Chain Tracker", exact: true })
    .click();
  const chainCard = page
    .locator(".app-chain-card")
    .filter({ hasText: "Morgan" });
  await chainCard.click({ button: "right" });
  const hubMenu = page.getByRole("menu", { name: "Morgan chain actions" });
  await expect(hubMenu.getByRole("menuitem")).toHaveText([
    "Open",
    "Edit details…",
    "Unstar",
    "Delete chain…",
  ]);
  await hubMenu.getByRole("menuitem", { name: "Edit details…" }).click();
  await expect(chainCard.getByLabel("Chain name")).toHaveValue("Morgan");
});

test("returning to the mounted chain restores its internal workspace state", async ({
  page,
}) => {
  await page
    .getByRole("region", { name: "Chains" })
    .getByRole("button", { name: "Resume" })
    .first()
    .click();
  const tracker = page.getByLabel("Interactive Chain Tracker workspace");
  await tracker.getByRole("tab", { name: /^Inventory/ }).click();
  await tracker.getByRole("button", { name: "Items", exact: true }).click();

  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await page
    .getByRole("region", { name: "Chains" })
    .getByRole("button", { name: "Resume" })
    .first()
    .click();
  await expect(
    tracker.getByRole("tab", { name: /^Inventory/ }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    tracker.getByRole("button", { name: "Items", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("leaving the Chain hub cancels open Edit details drafts", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Chain Tracker", exact: true })
    .click();
  const card = page.locator(".app-chain-card").filter({ hasText: "Morgan" });
  await card.getByRole("button", { name: "Edit Morgan" }).click();
  const name = card.getByLabel("Chain name");
  const description = card.getByLabel("Description");
  const savedDescription = await description.inputValue();
  await name.fill("Unsaved route draft");
  await description.fill("This draft must be discarded on route departure.");

  await page.getByRole("button", { name: "Editor", exact: true }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await page
    .getByRole("button", { name: "Chain Tracker", exact: true })
    .click();
  await expect(page).toHaveURL(/\/chain$/);

  await expect(card.locator(".app-edit-chain")).toHaveCount(0);
  await expect(card.getByRole("heading", { name: "Morgan" })).toBeVisible();
  await card.getByRole("button", { name: "Edit Morgan" }).click();
  await expect(card.getByLabel("Chain name")).toHaveValue("Morgan");
  await expect(card.getByLabel("Description")).toHaveValue(savedDescription);
});

test("Chain cards delete only after the shared confirmation", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "dark");
  await page
    .getByRole("button", { name: "Chain Tracker", exact: true })
    .click();
  const card = page.locator(".app-chain-card").filter({ hasText: "Morgan" });
  const remove = card.getByRole("button", { name: "Delete Morgan" });
  const edit = card.getByRole("button", { name: "Edit Morgan" });
  const star = card.getByRole("button", { name: "Star Morgan" });
  const [removeBox, editBox, starBox] = await Promise.all([
    remove.boundingBox(),
    edit.boundingBox(),
    star.boundingBox(),
  ]);
  expect(removeBox).not.toBeNull();
  expect(editBox).not.toBeNull();
  expect(starBox).not.toBeNull();
  expect(removeBox!.x).toBeLessThan(editBox!.x);
  expect(starBox!.x).toBeGreaterThan(editBox!.x + editBox!.width - 1);

  await remove.click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Delete Morgan?",
  });
  await expect(confirmation).toContainText(
    "Are you sure you want to delete “Morgan”?",
  );
  await expect(confirmation).toHaveCSS(
    "border-color",
    await resolveColorToken(page, "--app-accent-border"),
  );
  await expect(confirmation).toHaveCSS("background-color", "rgb(41, 41, 39)");
  const confirmDelete = confirmation.getByRole("button", {
    name: "Delete chain",
  });
  await expect(confirmDelete).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(confirmDelete).toHaveCSS(
    "color",
    await resolveColorToken(page, "--app-danger-text"),
  );
  await expect(confirmDelete).toHaveCSS(
    "border-color",
    await resolveColorToken(page, "--app-danger-border"),
  );
  const cancelDelete = confirmation.getByRole("button", { name: "Cancel" });
  await expect(cancelDelete).toHaveCSS("background-color", "rgb(32, 32, 30)");
  await expect(cancelDelete).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirmDelete).toBeFocused();
  await expect(confirmDelete).toHaveCSS(
    "background-color",
    await resolveColorToken(page, "--app-danger-surface"),
  );
  await expect(confirmDelete).toHaveCSS(
    "outline-color",
    await resolveColorToken(page, "--app-danger-focus"),
  );
  if (shouldCaptureReviewArtifacts(testInfo)) {
    const screenshot = await page.screenshot({ animations: "disabled" });
    await testInfo.attach("chain-delete-confirmation", {
      body: screenshot,
      contentType: "image/png",
    });
    const artifactDirectory = join(
      process.cwd(),
      "artifacts",
      "application-visual",
    );
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(
      join(artifactDirectory, "chain-delete-confirmation-production.png"),
      screenshot,
    );
  }
  await cancelDelete.click();
  await expect(card).toBeVisible();
  await page.reload();
  await expect(card).toBeVisible();

  await remove.click();
  await confirmation.getByRole("button", { name: "Delete chain" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Chain Tracker", exact: true })
    .click();
  await expect(page.locator(".app-chain-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await expect(
    page.getByRole("region", { name: "Chains" }).getByText("Morgan"),
  ).toHaveCount(0);
});

test("tracker dialogs share the application modal boundary and close on route departure", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Settings" }).click();
  const settingsLayer = page.locator(".app-settings-layer.is-overlay");
  await expectModalBelowRouter(page, settingsLayer);
  if (shouldCaptureReviewArtifacts(testInfo))
    await testInfo.attach("settings-application-modal-boundary", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  const accent = page.locator("#accent");
  await accent.evaluate((element) => {
    const input = element as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setValue.call(input, "#7655e8");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(accent).toHaveValue("#7655e8");
  await page.getByRole("button", { name: "Close Settings" }).click();

  const tracker = await resumeMorgan(page);
  await tracker.getByRole("tab", { name: /^Forms/ }).click();
  await tracker
    .locator(".chain-form-grid article")
    .filter({ hasText: "Prism Form" })
    .getByRole("button", { name: "View" })
    .click();
  await tracker.getByRole("button", { name: "Full details" }).click();
  const formDialog = page.getByRole("dialog", {
    name: "Form details: Prism Form",
  });
  const profileLayer = page.locator(".companion-profile-layer");
  if (shouldCaptureReviewArtifacts(testInfo))
    await testInfo.attach("form-profile-modal-before", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  await expectModalBelowRouter(page, profileLayer);
  await expect(tracker).toHaveAttribute("inert", "");
  const formPerk = formDialog.getByRole("button", {
    name: "Refractive Hide",
  });
  await formPerk.hover();
  const hoveredColors = await formPerk.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      border: style.borderColor,
    };
  });
  if (shouldCaptureReviewArtifacts(testInfo))
    await testInfo.attach("form-profile-accent-modal", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  expect(hoveredColors.background).not.toBe("rgb(60, 60, 56)");
  expect(hoveredColors.border).not.toBe("rgb(141, 120, 49)");

  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await expect(formDialog).toHaveCount(0);
  const returnedTracker = await resumeMorgan(page);
  await expect(formDialog).toHaveCount(0);

  await returnedTracker.getByRole("tab", { name: /^Companions/ }).click();
  await returnedTracker
    .locator(".chain-companion-grid article")
    .filter({ hasText: "Lyra" })
    .getByRole("button", { name: "View" })
    .click();
  await returnedTracker.getByRole("button", { name: "Full profile" }).click();
  const companionDialog = page.getByRole("dialog", {
    name: "Companion profile: Lyra",
  });
  await expectModalBelowRouter(page, page.locator(".companion-profile-layer"));
  const companionRecord = companionDialog
    .locator(".companion-profile-columns button")
    .first();
  await companionRecord.hover();
  await expect(companionRecord).not.toHaveCSS(
    "border-color",
    "rgb(141, 120, 49)",
  );
  if (shouldCaptureReviewArtifacts(testInfo))
    await testInfo.attach("companion-profile-accent-modal", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  await expect(companionDialog).toHaveCount(0);

  const inventoryTracker = await resumeMorgan(page);
  await expect(companionDialog).toHaveCount(0);
  await inventoryTracker.getByRole("tab", { name: /^Inventory/ }).click();
  await inventoryTracker.locator(".chain-record-list article").first().click();
  const recordDialog = page.getByRole("dialog", {
    name: /(?:perk|item) details:/i,
  });
  await expect(recordDialog).toBeVisible();
  await expectModalBelowRouter(page, page.locator(".record-detail-layer"));
  await expect(inventoryTracker).toHaveAttribute("inert", "");
  if (shouldCaptureReviewArtifacts(testInfo))
    await testInfo.attach("record-detail-application-modal", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await expect(recordDialog).toHaveCount(0);
  await resumeMorgan(page);
  await expect(recordDialog).toHaveCount(0);

  await page.getByRole("tab", { name: "Chain & Jump" }).click();
  await page.getByRole("button", { name: "Supp", exact: true }).click();
  const supplementDialog = page.getByRole("dialog", {
    name: /current-Jump supplements/,
  });
  await expectModalBelowRouter(
    page,
    page.locator(".tracker-supp-application-layer"),
  );
  await expect(
    page.getByLabel("Interactive Chain Tracker workspace"),
  ).toHaveAttribute("inert", "");
  if (shouldCaptureReviewArtifacts(testInfo))
    await testInfo.attach("supp-application-modal", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await expect(supplementDialog).toHaveCount(0);
  await resumeMorgan(page);
  await expect(supplementDialog).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  if (shouldCaptureReviewArtifacts(testInfo))
    await testInfo.attach("tracker-dialogs-closed-after-route-return", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
});

test("the Chain Tracker hub lists all chains and supports create and rename flows", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open Chain Tracker" }).click();
  await expect(page).toHaveURL(/\/chain$/);
  await expect(
    page.getByRole("heading", { name: "Your chains" }),
  ).toBeFocused();
  await expect(page.locator(".app-chain-card")).toHaveCount(1);
  await expect(page.locator(".app-chain-card").first()).toContainText("Morgan");

  await page.getByLabel("Start a new chain").fill("  Lantern   Road  ");
  await page.getByRole("button", { name: "Start Chain" }).click();
  await expect(page).toHaveURL(/\/chain\/ch-new-1$/);
  await expect(page).toHaveTitle("Lantern Road · Chain Tracker");
  await expect(
    page.getByLabel("Interactive Chain Tracker workspace"),
  ).toContainText("Lantern Road");

  await page
    .getByRole("button", { name: "Chain Tracker", exact: true })
    .click();
  await expect(page.locator(".app-chain-card").first()).toContainText(
    "Lantern Road",
  );
  await page.getByRole("button", { name: "Edit Lantern Road" }).click();
  const editingCard = page.locator(".app-chain-card.is-editing");
  const neighboringCard = page
    .locator(".app-chain-card")
    .filter({ hasText: "Morgan" });
  const [editingBox, neighboringBox, listBox] = await Promise.all([
    editingCard.boundingBox(),
    neighboringCard.boundingBox(),
    page.locator(".app-chain-hub-route .app-chain-card-list").boundingBox(),
  ]);
  expect(editingBox).not.toBeNull();
  expect(neighboringBox).not.toBeNull();
  expect(listBox).not.toBeNull();
  expect(editingBox!.width).toBeLessThan(listBox!.width * 0.6);
  expect(neighboringBox!.x).toBeGreaterThan(editingBox!.x + editingBox!.width);
  const rename = page.getByLabel("Chain name");
  await expect(rename).toBeFocused();
  await rename.fill("Lantern Sea");
  await page
    .getByLabel("Description")
    .fill("A luminous route through unfamiliar seas.");
  const saveBox = await page
    .getByRole("button", { name: "Save" })
    .boundingBox();
  expect(saveBox).not.toBeNull();
  expect(saveBox!.x + saveBox!.width).toBeLessThanOrEqual(
    editingBox!.x + editingBox!.width,
  );
  expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(
    editingBox!.y + editingBox!.height,
  );
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: "Lantern Sea" }),
  ).toBeVisible();
  await expect(
    page.getByText("A luminous route through unfamiliar seas."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  const homeChains = page.getByRole("region", { name: "Chains" });
  await expect(homeChains.locator(".app-recent-work")).toHaveCount(2);
  await expect(homeChains.locator(".app-recent-work").first()).toContainText(
    "Lantern Sea",
  );
});

test("starred chains lead both lists while each group retains recency order", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Open Chain Tracker" }).click();

  const createChain = async (name: string, id: string) => {
    await page.getByLabel("Start a new chain").fill(name);
    await page.getByRole("button", { name: "Start Chain" }).click();
    await expect(page).toHaveTitle(`${name} · Chain Tracker`);
    await expectStoredChain(page, id);
    await page
      .getByRole("button", { name: "Chain Tracker", exact: true })
      .click();
  };
  const cardNames = page.locator(".app-chain-card h3");

  await createChain("Alpha", "ch-new-1");
  await createChain("Beta", "ch-new-2");
  await expect(cardNames).toHaveText(["Beta", "Alpha", "Morgan"]);

  await page.getByRole("button", { name: "Star Morgan" }).click();
  await expect(cardNames).toHaveText(["Morgan", "Beta", "Alpha"]);
  await page.getByRole("button", { name: "Star Alpha" }).click();
  await expect(cardNames).toHaveText(["Alpha", "Morgan", "Beta"]);

  const alphaToggle = page.getByRole("button", { name: "Unstar Alpha" });
  const betaToggle = page.getByRole("button", { name: "Star Beta" });
  await expect(alphaToggle).toHaveAttribute("aria-pressed", "true");
  await expect(betaToggle).toHaveAttribute("aria-pressed", "false");
  await expect(alphaToggle).toHaveCSS("border-top-width", "0px");
  const [accentColor, expectedAccentColor, inactiveColor, toggleSize] =
    await Promise.all([
      alphaToggle.evaluate((element) => getComputedStyle(element).color),
      page.locator(".app-primary-shell").evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--app-accent-text)";
        element.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }),
      betaToggle.evaluate((element) => getComputedStyle(element).color),
      alphaToggle.evaluate((element) => getComputedStyle(element).fontSize),
    ]);
  expect(accentColor).toBe(expectedAccentColor);
  expect(accentColor).not.toBe(inactiveColor);

  if (shouldCaptureReviewArtifacts(testInfo))
    await testInfo.attach("starred-chain-hub-order", {
      body: await page.screenshot(),
      contentType: "image/png",
    });

  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  const homeChains = page.getByRole("region", { name: "Chains" });
  await expect(
    homeChains.locator(".app-recent-work > span > strong"),
  ).toHaveText(["Alpha", "Morgan", "Beta"]);
  await expect(
    homeChains.getByRole("img", { name: "Alpha is starred" }),
  ).toBeVisible();
  await expect(
    homeChains.getByRole("img", { name: "Morgan is starred" }),
  ).toBeVisible();
  await expect(
    homeChains.getByRole("button", { name: /^(?:un)?star /i }),
  ).toHaveCount(0);
  expect(
    await homeChains
      .getByRole("img", { name: "Alpha is starred" })
      .evaluate((element) => getComputedStyle(element).fontSize),
  ).toBe(toggleSize);

  if (shouldCaptureReviewArtifacts(testInfo))
    await testInfo.attach("starred-chain-home-order", {
      body: await page.screenshot(),
      contentType: "image/png",
    });

  await page.reload();
  await expect(homeChains.locator(".app-recent-work")).toHaveCount(3);
  await expect(
    homeChains.locator(".app-recent-work > span > strong"),
  ).toHaveText(["Alpha", "Morgan", "Beta"]);
  await expect(
    homeChains.getByRole("img", { name: "Alpha is starred" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Chain Tracker", exact: true })
    .click();
  await page.getByRole("button", { name: "Unstar Alpha" }).click();
  await expect(cardNames).toHaveText(["Morgan", "Beta", "Alpha"]);
  if (shouldCaptureReviewArtifacts(testInfo))
    await testInfo.attach("unstarred-chain-hub-order", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  await page.getByRole("button", { name: "Jumpchain Visualizer" }).click();
  await expect(
    homeChains.locator(".app-recent-work > span > strong"),
  ).toHaveText(["Morgan", "Beta", "Alpha"]);
  await expect(
    homeChains.getByRole("img", { name: "Alpha is starred" }),
  ).toHaveCount(0);
});

test("saved-chain search and radar summaries preserve the fixed hub", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open Chain Tracker" }).click();
  const hubHeading = page.getByRole("heading", { name: "Your chains" });
  const createBlock = page.locator(".app-new-chain");
  const list = page.locator(".app-chain-hub-route .app-chain-card-list");
  const headingTop = await hubHeading.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  const createTop = await createBlock.evaluate(
    (element) => element.getBoundingClientRect().top,
  );

  await expect(page.locator(".app-chain-card")).toHaveCount(1);
  expect(
    await hubHeading.evaluate((element) => element.getBoundingClientRect().top),
  ).toBe(headingTop);
  expect(
    await createBlock.evaluate(
      (element) => element.getBoundingClientRect().top,
    ),
  ).toBe(createTop);
  expect(await list.evaluate((element) => element.scrollTop)).toBe(0);
  expect(
    await page
      .locator(".app-primary-views")
      .evaluate((element) => element.scrollTop),
  ).toBe(0);

  const search = page.getByLabel("Search saved chains");
  await search.fill("three-jump demonstration");
  await expect(page.locator(".app-chain-card")).toHaveCount(1);
  await expect(page.locator(".app-chain-card")).toContainText("Morgan");
  await search.fill("no such expedition");
  await expect(page.getByRole("status")).toContainText("No saved chains match");
  await search.fill("");

  const summaryTrigger = page.getByRole("button", {
    name: "Show Morgan tag summary",
  });
  await summaryTrigger.hover();
  const summary = page.getByRole("tooltip");
  await expect(summary).toBeVisible();
  await expect(
    summary.getByRole("img", { name: "Morgan perk category radar" }),
  ).toBeVisible();
  const previewLabels = summary.locator(".radar-label");
  await expect(previewLabels).toHaveCount(12);
  expect(
    await previewLabels
      .first()
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
  ).toBeGreaterThanOrEqual(22);
  expect(
    new Set(
      await previewLabels.evaluateAll((labels) =>
        labels.map((label) => getComputedStyle(label).fill),
      ),
    ).size,
  ).toBeGreaterThan(6);
  await expect(summary).toContainText("Strongest category:");
  expect(
    await summary.evaluate(
      (element) => getComputedStyle(element).pointerEvents,
    ),
  ).toBe("none");
  await page.mouse.move(900, 300);
  await expect(summary).toBeHidden();
  await summaryTrigger.focus();
  await expect(summary).toBeVisible();
  await expect(
    page.locator(".app-chain-card-copy h3.is-primary-tag-colored"),
  ).toHaveCount(0);
});

test("unknown workspace IDs recover inside their owning hub and unknown routes do not fall home", async ({
  page,
}) => {
  await page.goto("/chain/not-a-local-record");
  await expect(page).toHaveTitle("Chain unavailable · Jumpchain Visualizer");
  await expect(
    page.getByRole("heading", { name: "Chain unavailable" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-active-route="true"]').getByText("not-a-local-record"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Chain Tracker", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Return to Chain Tracker" }).click();
  await expect(page).toHaveURL(/\/chain$/);

  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Preferences" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Application Settings" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/settings$/);
});

test(
  "the narrow shell follows the proposal without clipping navigation or recent actions",
  { tag: "@cross-browser" },
  async ({ page }) => {
    await page.setViewportSize({ width: 620, height: 900 });
    const shell = page.getByLabel("Jumpchain Visualizer application");
    await expect(
      shell.getByRole("button", { name: "Editor", exact: true }),
    ).toBeVisible();
    await expect(
      shell.getByRole("button", { name: "Chain Tracker", exact: true }),
    ).toBeVisible();
    await expect(
      shell
        .getByRole("region", { name: "Chains" })
        .getByRole("button", {
          name: "Resume",
        })
        .first(),
    ).toBeVisible();

    await shell.getByRole("button", { name: "Open Chain Tracker" }).click();
    const finalChain = page.locator(".app-chain-card").last();
    await finalChain.scrollIntoViewIfNeeded();
    await expect(finalChain).toContainText("Morgan");
    await expect(
      finalChain.getByRole("button", { name: "Edit Morgan" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  },
);

test("review fixtures remain direct-only development routes", async ({
  page,
}) => {
  await page.goto("/review/chain-tracker");
  await expect(
    page.getByText("Dense deterministic review fixture"),
  ).toBeVisible();
  await expect(page.getByLabel("Jumpchain Visualizer application")).toHaveCount(
    0,
  );
});
