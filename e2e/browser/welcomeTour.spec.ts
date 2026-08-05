import { expect, test, type Page } from "./support/fixtures";

test.use({ welcomeTourStatus: "pending" });

async function reachBranchChooser(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Welcome to Jumpchain Visualizer",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start tour" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Where would you like to begin?",
    }),
  ).toBeVisible();
}

async function waitForPersistedTourEditorText(page: Page, expected: string[]) {
  await expect
    .poll(() =>
      page.evaluate((fragments) => {
        const staged = localStorage.getItem(
          "jumpchain-visualizer:welcome-tour-pending",
        );
        if (staged) {
          try {
            const source = Object.values(
              JSON.parse(staged)?.editorWorkspace?.files ?? {},
            ).join("\n");
            if (fragments.every((fragment) => source.includes(fragment)))
              return true;
          } catch {
            // The durable IndexedDB record remains authoritative.
          }
        }
        return new Promise<boolean>((resolve, reject) => {
          const open = indexedDB.open("jumpchain-visualizer", 5);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const database = open.result;
            const request = database
              .transaction("welcome-tour", "readonly")
              .objectStore("welcome-tour")
              .get("active");
            request.onerror = () => {
              database.close();
              reject(request.error);
            };
            request.onsuccess = () => {
              database.close();
              const source = Object.values(
                request.result?.editorWorkspace?.files ?? {},
              ).join("\n");
              resolve(fragments.every((fragment) => source.includes(fragment)));
            };
          };
        });
      }, expected),
    )
    .toBe(true);
}

test("first launch completes the Editor lesson, resumes exact input, and tours advanced navigation @cross-browser", async ({
  page,
}) => {
  await reachBranchChooser(page);
  await page.getByRole("button", { name: /Create in the Editor/ }).click();

  await expect(
    page.getByRole("heading", { name: "You’re in the practice Editor" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Jump details", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Choice", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page
    .getByRole("textbox", { name: "Handle", exact: true })
    .fill("road_companion");
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Road Companion");
  await waitForPersistedTourEditorText(page, [
    "handle: road_companion",
    'name: "Road Companion"',
  ]);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Give the Choice a clear identity",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Handle", exact: true }),
  ).toHaveValue("road_companion");
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Road Companion");

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "first_steps", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Direct choice/ }).click();
  const placement = page.getByRole("combobox", {
    name: "Choice to display",
  });
  await placement.fill("road_companion");
  await placement.press("ArrowDown");
  await placement.press("Enter");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page
      .locator('[data-welcome-tour-scope="editor"]')
      .locator('[data-tour-target="editor-preview"]'),
  ).toContainText("Road Companion");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Explore advanced tools" }).click();
  await page.getByRole("button", { name: "Advanced views" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("tab", { name: "Files" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("tab", { name: "Content" }).click();
  await page
    .getByRole("button", { name: "Jump appearance", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Finish tour" }).click();
  await page.getByRole("button", { name: /Beginner friendly/ }).click();

  await expect(
    page.getByRole("heading", { name: "What would you like to do?" }),
  ).toBeVisible();
  const stored = await page.evaluate(
    () =>
      new Promise<{
        status?: string;
        tour: unknown;
        editorIds: string[];
        chainIds: string[];
      }>((resolve, reject) => {
        const open = indexedDB.open("jumpchain-visualizer", 5);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction(
            ["aggregates", "welcome-tour", "editor-workspaces", "chains"],
            "readonly",
          );
          const settings = transaction
            .objectStore("aggregates")
            .get("settings");
          const tour = transaction.objectStore("welcome-tour").get("active");
          const editors = transaction
            .objectStore("editor-workspaces")
            .getAllKeys();
          const chains = transaction.objectStore("chains").getAllKeys();
          transaction.oncomplete = () => {
            database.close();
            resolve({
              status: settings.result?.onboarding?.welcomeTourStatus,
              tour: tour.result,
              editorIds: editors.result.map(String),
              chainIds: chains.result.map(String),
            });
          };
        };
      }),
  );
  expect(stored.status).toBe("completed");
  expect(stored.tour).toBeUndefined();
  expect(stored.editorIds).not.toContain("welcome-tour-editor");
  expect(stored.chainIds).not.toContain("welcome-tour-chain");
});

test("Tracker navigation reveals its generated Inventory records and Body Mod page", async ({
  page,
}) => {
  await reachBranchChooser(page);
  await page.getByRole("button", { name: /Travel in the Tracker/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("tab", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const tracker = page.locator('[data-welcome-tour-scope="tracker"]');
  await expect(
    tracker.locator('[data-tour-target="tracker-add-tutorial"]'),
  ).toBeVisible();
  await tracker
    .getByRole("button", { name: "Add to chain", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "The Crossroads is now in your chain",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "This control is taking a moment",
    }),
  ).toHaveCount(0);
  await expect(
    tracker.locator('[data-tour-target="tracker-selected-entry"]'),
  ).toHaveClass(/is-welcome-tour-target/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    tracker.locator('[data-tour-target="tracker-choice-route"]'),
  ).toHaveClass(/is-welcome-tour-target/);
  await tracker.getByLabel("Choose a route").selectOption("Forest road");
  await page.getByRole("button", { name: "Continue" }).click();
  await tracker
    .locator('[data-tour-target="tracker-choice-perk"] input[type=checkbox]')
    .check();
  await page.getByRole("button", { name: "Continue" }).click();
  await tracker
    .locator('[data-tour-target="tracker-choice-item"] input[type=checkbox]')
    .check();
  await page.getByRole("button", { name: "Continue" }).click();
  await tracker
    .getByRole("button", {
      name: "Move The Crossroads earlier in the chain",
    })
    .click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("tab", { name: /Inventory/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const records = tracker.locator(
    '[data-tour-target="tracker-inventory-tutorial-results"]',
  );
  await expect(records).toBeVisible();
  await expect(records).toContainText("Field Training");
  await expect(records).toContainText("Traveler's Pack");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("tab", { name: "Supplements" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  const bodyModCard = tracker.locator(
    '[data-tour-target="tracker-enable-body-mod"]',
  );
  await bodyModCard.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Continue" }).click();
  await bodyModCard.getByRole("button", { name: "Open page" }).click();
  await expect(
    page.getByRole("heading", { name: "Classic Body Mod is open" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "This control is taking a moment",
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();
  await tracker
    .locator('[data-tour-target="tracker-use-body-mod"]')
    .getByRole("button", { name: /Heavy/ })
    .click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
});

test("opting out still requires an interface choice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Exit tour" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose your interface" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit tour" })).toHaveCount(0);
  await page.getByRole("button", { name: /Advanced/ }).click();
  await expect(
    page.getByRole("heading", { name: "What would you like to do?" }),
  ).toBeVisible();
});
