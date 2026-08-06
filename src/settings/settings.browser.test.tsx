import { useState } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { CrashBoundary } from "./CrashBoundary";
import { useSessionEvents, useSettings } from "./SettingsContext";
import { SettingsProvider } from "./SettingsProvider";
import { SettingsSurface } from "./SettingsSurface";
import { defaultSettings, type SettingsCategory } from "./model";
import { createDefaultTagProfile } from "./tagProfile";
import { MemorySettingsRepository, type ReportExporter } from "./repository";
import { ContextMenuProvider } from "../ui";
import "../../documentation/assets/styles.css";
import "../../documentation/development/settings-design.css";
import "../../documentation/development/logging-design.css";
import "./settings.css";

const exporter: ReportExporter = {
  save: async () => "saved",
};

test("General, Editor, and Chain Tracker settings use session disclosures and search reveals collapsed settings", async () => {
  render(
    <SettingsProvider
      repository={new MemorySettingsRepository()}
      reportExporter={exporter}
    >
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await expect
    .element(page.getByRole("tab", { name: "General" }))
    .toBeVisible();

  const sectionIds = () =>
    [
      ...document.querySelectorAll<HTMLDetailsElement>(
        ".settings-section-list > .settings-section",
      ),
    ].map((section) => section.dataset.settingsSection);
  const section = (id: string) =>
    document.querySelector<HTMLDetailsElement>(
      `[data-settings-section="${id}"]`,
    )!;

  expect(sectionIds()).toEqual([
    "general-essentials",
    "general-interface",
    "general-welcome",
  ]);
  expect(section("general-essentials").open).toBe(true);
  expect(section("general-interface").open).toBe(true);
  expect(section("general-welcome").open).toBe(true);
  expect(
    section("general-essentials").querySelectorAll(
      "#interface-experience, #language-selection, #theme, #accent",
    ),
  ).toHaveLength(4);
  expect(
    section("general-interface").querySelectorAll(
      "#hide-technical-locations, #collapse-optional-sections",
    ),
  ).toHaveLength(2);
  expect(section("general-welcome").querySelector("button")).not.toBeNull();

  section("general-interface").querySelector("summary")!.click();
  await expect.poll(() => section("general-interface").open).toBe(false);
  await expect
    .element(page.getByLabelText("Hide raw technical locations"))
    .not.toBeVisible();

  await page.getByRole("tab", { name: "Editor" }).click();
  expect(sectionIds()).toEqual([
    "editor-workflow",
    "editor-display",
    "editor-warnings",
  ]);
  expect(
    [
      ...document.querySelectorAll<HTMLDetailsElement>(".settings-section"),
    ].every((candidate) => candidate.open),
  ).toBe(true);

  await page.getByRole("tab", { name: "Chain Tracker" }).click();
  expect(sectionIds()).toEqual([
    "chain-controls",
    "chain-inventory",
    "chain-warnings",
  ]);
  expect(
    [
      ...document.querySelectorAll<HTMLDetailsElement>(".settings-section"),
    ].every((candidate) => candidate.open),
  ).toBe(true);
  section("chain-inventory").querySelector("summary")!.click();
  await expect.poll(() => section("chain-inventory").open).toBe(false);

  await page.getByRole("tab", { name: "General" }).click();
  expect(section("general-interface").open).toBe(false);
  await page.getByRole("searchbox").fill("technical locations");
  await page
    .getByRole("button", { name: /general\.hideTechnicalLocations/ })
    .click();
  await expect.poll(() => section("general-interface").open).toBe(true);
  await expect
    .element(page.getByLabelText("Hide raw technical locations"))
    .toHaveFocus();

  await page.getByRole("tab", { name: "Chain Tracker" }).click();
  expect(section("chain-inventory").open).toBe(false);
});

test("Settings chrome, dropdowns, and standalone color pickers suppress the generic browser menu", async () => {
  render(
    <ContextMenuProvider>
      <SettingsProvider
        repository={new MemorySettingsRepository()}
        reportExporter={exporter}
      >
        <SettingsSurfaceHarness />
      </SettingsProvider>
    </ContextMenuProvider>,
  );
  await expect
    .element(page.getByRole("tab", { name: "General" }))
    .toBeVisible();
  const generalTab = page.getByRole("tab", { name: "General" }).element();
  const document = generalTab.ownerDocument;
  const controls = [
    generalTab,
    document.querySelector<HTMLSelectElement>("#theme")!,
    document.querySelector<HTMLInputElement>('#accent[type="color"]')!,
  ];
  for (const control of controls) {
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

  const search = page.getByRole("searchbox").element();
  const searchEvent = new search.ownerDocument.defaultView!.MouseEvent(
    "contextmenu",
    {
      bubbles: true,
      cancelable: true,
    },
  );
  expect(search.dispatchEvent(searchEvent)).toBe(true);
  expect(searchEvent.defaultPrevented).toBe(false);
  await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
});

test("interface experience applies its settings and becomes Custom after an individual override", async () => {
  const repository = new MemorySettingsRepository();
  render(
    <SettingsProvider repository={repository} reportExporter={exporter}>
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  const experience = page.getByRole("combobox", {
    name: "Interface experience",
  });
  await expect.element(experience).toHaveValue("advanced");
  await experience.selectOptions("beginner-friendly");
  await expect.element(experience).toHaveValue("beginner-friendly");
  await expect
    .element(page.getByLabelText("Hide raw technical locations"))
    .toBeChecked();
  await expect
    .element(page.getByLabelText("Collapse optional sections by default"))
    .toBeChecked();

  await page.getByRole("tab", { name: "Tags" }).click();
  const background = document.querySelector<HTMLDetailsElement>(
    '[data-disclosure-section="tag-background"]',
  )!;
  const text = document.querySelector<HTMLDetailsElement>(
    '[data-disclosure-section="tag-text"]',
  )!;
  const animation = document.querySelector<HTMLDetailsElement>(
    '[data-disclosure-section="tag-animation"]',
  )!;
  expect(background.open).toBe(true);
  expect(text.open).toBe(false);
  expect(animation.open).toBe(false);
  text.querySelector("summary")!.click();
  expect(text.open).toBe(true);

  await page.getByRole("tab", { name: "Editor" }).click();
  await expect
    .element(page.getByLabelText("Show explanatory text"))
    .toBeChecked();
  const advanced = page.getByLabelText("Start advanced views collapsed");
  await expect.element(advanced).toBeChecked();
  await advanced.click();
  await page.getByRole("tab", { name: "General" }).click();
  await expect.element(experience).toHaveValue("custom");

  await expect
    .poll(async () => {
      const stored = (await repository.load()) as ReturnType<
        typeof defaultSettings
      > | null;
      return {
        advanced: stored?.editor.collapseAdvancedViews,
        maximum: stored?.notifications.maxVisible,
      };
    })
    .toEqual({ advanced: false, maximum: 1 });
});

function BrokenSurface(): never {
  throw new Error("Deliberate component failure");
}

function PersistenceHarness() {
  const { settings, update } = useSettings();
  const events = useSessionEvents();
  return (
    <div>
      <output aria-label="Current accent">
        {settings.appearance.accentColor}
      </output>
      <output aria-label="Storage failures">
        {
          events.filter((event) => event.eventName === "storage.write_failed")
            .length
        }
      </output>
      <button
        type="button"
        onClick={() => {
          update(
            (current) => ({
              ...current,
              appearance: { ...current.appearance, accentColor: "#112233" },
            }),
            "appearance.accentColor",
            true,
          );
          update(
            (current) => ({
              ...current,
              appearance: { ...current.appearance, accentColor: "#445566" },
            }),
            "appearance.accentColor",
            true,
          );
        }}
      >
        Apply continuous edits
      </button>
    </div>
  );
}

function SettingsSurfaceHarness({
  onResetMockData = async () => true,
}: {
  onResetMockData?: () => Promise<boolean>;
} = {}) {
  const [category, setCategory] = useState<SettingsCategory>("general");
  return (
    <SettingsSurface
      category={category}
      onCategoryChange={setCategory}
      onClose={() => undefined}
      onResetMockData={onResetMockData}
    />
  );
}

test("recoverable React failures render the private diagnostic surface", async () => {
  let savedReport = "";
  render(
    <SettingsProvider
      repository={new MemorySettingsRepository()}
      reportExporter={{
        save: async (_suggestedName, content) => {
          savedReport = content;
          return "saved";
        },
      }}
    >
      <CrashBoundary>
        <BrokenSurface />
      </CrashBoundary>
    </SettingsProvider>,
  );
  await expect
    .element(
      page.getByRole("heading", {
        name: "Jumpchain Visualizer encountered an error",
      }),
    )
    .toBeVisible();
  await expect
    .element(page.getByText(/Deliberate component failure/).first())
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Copy report" }))
    .toBeVisible();
  await page.getByRole("button", { name: "Save report" }).click();
  await expect.poll(() => savedReport).toContain("Event: app.crashed");
  expect(savedReport).toContain("Deliberate component failure");
  expect(savedReport).not.toContain("Event: app.started\nSeverity: info");
});

test("window monitoring signals readiness before failures can be dispatched", async () => {
  render(
    <SettingsProvider
      repository={new MemorySettingsRepository()}
      reportExporter={exporter}
    >
      <CrashBoundary>
        <p>Healthy surface</p>
      </CrashBoundary>
    </SettingsProvider>,
  );
  await expect.element(page.getByText("Healthy surface")).toBeVisible();
  await expect
    .poll(() => document.documentElement.dataset.crashMonitorReady)
    .toBe("true");
});

test("a failed coalesced write rolls back to the last durable aggregate", async () => {
  const repository = {
    load: async () => null,
    save: async () => {
      throw new Error("storage unavailable");
    },
  };
  render(
    <SettingsProvider repository={repository} reportExporter={exporter}>
      <PersistenceHarness />
    </SettingsProvider>,
  );
  await page.getByRole("button", { name: "Apply continuous edits" }).click();
  await expect
    .element(page.getByLabelText("Current accent"))
    .toHaveTextContent("#445566");
  await expect
    .element(page.getByLabelText("Current accent"))
    .toHaveTextContent("#d4af37");
  await expect
    .element(page.getByLabelText("Storage failures"))
    .toHaveTextContent("1");
});

test("custom package limits require risk consent and invalid values never become effective", async () => {
  render(
    <SettingsProvider
      repository={new MemorySettingsRepository()}
      reportExporter={exporter}
    >
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await page.getByRole("tab", { name: "Developer" }).click();
  const toggle = page.getByLabelText("Use custom package limits");
  await toggle.click();
  await expect
    .element(
      page.getByRole("heading", {
        name: "Increase package limits at your own risk",
      }),
    )
    .toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect.element(toggle).not.toBeChecked();
  await expect
    .element(page.getByRole("spinbutton", { name: /Archive/ }))
    .toBeDisabled();

  await toggle.click();
  await page.getByRole("button", { name: "I understand, enable" }).click();
  const expanded = page.getByRole("spinbutton", { name: /Expanded package/ });
  await expect.element(expanded).toBeEnabled();
  await expect
    .element(page.getByTitle("Increase Expanded package limit"))
    .toBeVisible();
  await expect
    .element(page.getByTitle("Decrease Expanded package limit"))
    .toBeVisible();
  await expanded.fill("8");
  await expect
    .element(page.getByText(/cannot exceed the expanded package limit/))
    .toBeVisible();
  await expect.element(page.getByText("Archive").last()).toBeVisible();
  await expect.element(page.getByText("64 MiB").first()).toBeVisible();

  await page.getByRole("button", { name: "Reset package limits" }).click();
  await expect.element(toggle).not.toBeChecked();
  await expect.element(expanded).toHaveValue(96);
});

test("mock data reset follows the persisted visibility setting and reports completion", async () => {
  render(
    <SettingsProvider
      repository={new MemorySettingsRepository()}
      reportExporter={exporter}
    >
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await page.getByRole("tab", { name: "Developer" }).click();
  const visibility = page.getByLabelText("Show mock fixtures");
  const reset = page.getByRole("button", { name: "Reset Mock Data" });
  await expect.element(visibility).not.toBeChecked();
  await expect.element(reset).toBeDisabled();
  await visibility.click();
  await expect.element(reset).toBeEnabled();
  await reset.click();
  await expect.element(page.getByText("Mock data reset.")).toBeVisible();
});

test("mock data reset reports repository failure without claiming success", async () => {
  render(
    <SettingsProvider
      repository={
        new MemorySettingsRepository({
          ...defaultSettings(createDefaultTagProfile()),
          developer: {
            ...defaultSettings(createDefaultTagProfile()).developer,
            showMockData: true,
          },
        })
      }
      reportExporter={exporter}
    >
      <SettingsSurfaceHarness onResetMockData={async () => false} />
    </SettingsProvider>,
  );
  await page.getByRole("tab", { name: "Developer" }).click();
  await page.getByRole("button", { name: "Reset Mock Data" }).click();
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent("Mock data could not be reset. Nothing was changed.");
  await expect
    .element(page.getByText("Mock data reset."))
    .not.toBeInTheDocument();
});

test("permanent sidebar deletion is an off-by-default persisted Editor preference", async () => {
  const repository = new MemorySettingsRepository();
  render(
    <SettingsProvider repository={repository} reportExporter={exporter}>
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await page.getByRole("tab", { name: "Editor" }).click();
  const toggle = page.getByLabelText("Permanently delete sidebar items");
  await expect.element(toggle).not.toBeChecked();
  await toggle.click();
  await expect.element(toggle).toBeChecked();
  await expect
    .poll(async () => {
      const stored = (await repository.load()) as ReturnType<
        typeof defaultSettings
      > | null;
      return stored?.editor.permanentlyDeleteSidebarItems;
    })
    .toBe(true);
});

test("layout preview placeholder length is unlimited by default and persists a bounded value", async () => {
  const repository = new MemorySettingsRepository();
  render(
    <SettingsProvider repository={repository} reportExporter={exporter}>
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await page.getByRole("tab", { name: "Editor" }).click();
  const limit = page.getByLabelText("Layout preview placeholder length");
  await expect.element(limit).toHaveValue(null);
  await expect.element(limit).toHaveAttribute("placeholder", "Unlimited");
  await page.getByTitle("Increase Layout preview placeholder length").click();
  await expect.element(limit).toHaveValue(1);
  await expect
    .element(page.getByTitle("Decrease Layout preview placeholder length"))
    .toBeDisabled();
  await limit.fill("12");
  await expect.element(limit).toHaveValue(12);
  await expect
    .poll(async () => {
      const stored = (await repository.load()) as ReturnType<
        typeof defaultSettings
      > | null;
      return stored?.editor.layoutPreviewPlaceholderCharacterLimit;
    })
    .toBe(12);
  await limit.fill("");
  await expect
    .poll(async () => {
      const stored = (await repository.load()) as ReturnType<
        typeof defaultSettings
      > | null;
      return stored?.editor.layoutPreviewPlaceholderCharacterLimit;
    })
    .toBeNull();
});

test("Editor explanatory text persists independently and changes the experience preset to Custom", async () => {
  const repository = new MemorySettingsRepository();
  render(
    <SettingsProvider repository={repository} reportExporter={exporter}>
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );

  const experience = page.getByRole("combobox", {
    name: "Interface experience",
  });
  await expect.element(experience).toHaveValue("advanced");
  await page.getByRole("tab", { name: "Editor" }).click();
  const explanations = page.getByLabelText("Show explanatory text");
  await expect.element(explanations).not.toBeChecked();
  await explanations.click();
  await expect.element(explanations).toBeChecked();
  await page.getByRole("tab", { name: "General" }).click();
  await expect.element(experience).toHaveValue("custom");
  await expect
    .poll(async () => {
      const stored = (await repository.load()) as ReturnType<
        typeof defaultSettings
      > | null;
      return stored?.editor.showExplanatoryText;
    })
    .toBe(true);

  await page.getByRole("tab", { name: "Editor" }).click();
  const explanationRow = page
    .getByText("Editor explanations", { exact: true })
    .element()
    .closest(".setting-row")!;
  explanationRow.querySelector<HTMLButtonElement>(".setting-reset")!.click();
  await expect.element(explanations).not.toBeChecked();
  await page.getByRole("tab", { name: "General" }).click();
  await expect.element(experience).toHaveValue("advanced");
  await expect
    .poll(async () => {
      const stored = (await repository.load()) as ReturnType<
        typeof defaultSettings
      > | null;
      return stored?.editor.showExplanatoryText;
    })
    .toBe(false);
});

test("image alt text hover is an on-by-default persisted Accessibility preference", async () => {
  const repository = new MemorySettingsRepository();
  render(
    <SettingsProvider repository={repository} reportExporter={exporter}>
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await page.getByRole("tab", { name: "Accessibility" }).click();
  const toggle = page.getByLabelText("Show alt text on hover");
  await expect.element(toggle).toBeChecked();
  await toggle.click();
  await expect.element(toggle).not.toBeChecked();
  await expect
    .poll(async () => {
      const stored = (await repository.load()) as ReturnType<
        typeof defaultSettings
      > | null;
      return stored?.accessibility.imageAltTextHover;
    })
    .toBe(false);
});

test("an unavailable stored language recovers to English before Settings renders", async () => {
  const stored = {
    ...defaultSettings(createDefaultTagProfile()),
    language: { tag: "zz-Invalid" },
  };
  render(
    <SettingsProvider
      repository={new MemorySettingsRepository(stored)}
      reportExporter={exporter}
    >
      <SettingsSurfaceHarness />
    </SettingsProvider>,
  );
  await expect
    .element(page.getByRole("combobox", { name: "Language" }))
    .toHaveValue("en");
  expect(document.documentElement.lang).toBe("en");
  expect(document.documentElement.dir).toBe("ltr");
  expect(
    (page.getByRole("searchbox").element() as HTMLInputElement).spellcheck,
  ).toBe(false);
});
