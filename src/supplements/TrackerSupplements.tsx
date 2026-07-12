import { useEffect, useRef, useState, type ReactNode } from "react";
import { BodyModProvider } from "./BodyModContext";
import { SupplementDialog } from "./Dialogs";
import { ModulePage } from "./ModulePages";
import { SupplementStateProvider } from "./SupplementStateContext";
import {
  hasEnabledSupplements,
  modules,
  setModuleEnabled,
  type EnabledModules,
  type ModuleId,
  type ToolId,
} from "./model";

export type SupplementPageId = "manage" | ModuleId;

const supplementTools: readonly {
  id: ToolId;
  module: ModuleId;
  name: string;
  job: string;
}[] = [
  {
    id: "body",
    module: "body-mod",
    name: "Classic Body Mod",
    job: "At a glance",
  },
  {
    id: "essential",
    module: "essential-body-mod",
    name: "Essential Body Mod",
    job: "At a glance",
  },
  {
    id: "essential-progress",
    module: "essential-body-mod",
    name: "Essential Body Mod",
    job: "Progression",
  },
  {
    id: "warehouse",
    module: "warehouse",
    name: "Cosmic Warehouse",
    job: "At a glance",
  },
  {
    id: "reality",
    module: "personal-reality",
    name: "Personal Reality",
    job: "At a glance",
  },
  {
    id: "reality-progress",
    module: "personal-reality",
    name: "Personal Reality",
    job: "Spend new points",
  },
  {
    id: "drawbacks",
    module: "universal-drawbacks",
    name: "Universal Drawbacks",
    job: "Current effects",
  },
  {
    id: "quests",
    module: "quest-mode",
    name: "Quest Mode",
    job: "Quest checklist",
  },
  { id: "story", module: "story", name: "Story", job: "Write this Jump" },
];

export function SupplementProviders({ children }: { children: ReactNode }) {
  return (
    <BodyModProvider>
      <SupplementStateProvider>{children}</SupplementStateProvider>
    </BodyModProvider>
  );
}

export function TrackerSupplementWorkspace({
  enabled,
  onEnabledChange,
  page,
  onPageChange,
}: {
  enabled: EnabledModules;
  onEnabledChange: (value: EnabledModules) => void;
  page: SupplementPageId;
  onPageChange: (value: SupplementPageId) => void;
}) {
  const pages = [
    { id: "manage" as const, label: "Manage" },
    ...modules
      .filter((module) => enabled[module.id])
      .map((module) => ({ id: module.id, label: module.shortName })),
  ];
  return (
    <section
      className="chain-workspace-page chain-view-panel chain-supplement-page"
      role="tabpanel"
    >
      <div
        className="supplement-tabs"
        role="tablist"
        aria-label="Supplement pages"
        onKeyDown={(event) => {
          const index = pages.findIndex((item) => item.id === page);
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % pages.length;
          else if (event.key === "ArrowLeft")
            next = (index - 1 + pages.length) % pages.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = pages.length - 1;
          else return;
          event.preventDefault();
          onPageChange(pages[next].id);
          requestAnimationFrame(() =>
            (event.currentTarget.children[next] as HTMLElement)?.focus(),
          );
        }}
      >
        {pages.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={page === item.id}
            tabIndex={page === item.id ? 0 : -1}
            onClick={() => onPageChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div hidden={page !== "manage"}>
        <section className="supplement-subpage" role="tabpanel">
          <header>
            <p>Supplement library</p>
            <h4>Manage supplements</h4>
            <span>
              Supported modules remain listed; enabled modules receive pages and
              current-Jump tools.
            </span>
          </header>
          <div className="supplement-manage-list">
            {modules.map((module) => (
              <article key={module.id}>
                <div>
                  <strong>{module.name}</strong>
                  <p>{module.description}</p>
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={enabled[module.id]}
                    onChange={(event) => {
                      const next = setModuleEnabled(
                        enabled,
                        module.id,
                        event.target.checked,
                      );
                      onEnabledChange(next);
                      if (!next[page as ModuleId]) onPageChange("manage");
                    }}
                  />
                  <span>Enabled</span>
                </label>
                <button
                  type="button"
                  disabled={!enabled[module.id]}
                  onClick={() => onPageChange(module.id)}
                >
                  Open page
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
      {modules.map((module) => (
        <section
          key={module.id}
          className="supplement-subpage review-module-page"
          role="tabpanel"
          hidden={page !== module.id}
        >
          <ModulePage id={module.id} />
        </section>
      ))}
    </section>
  );
}

export function TrackerSupplementContext({
  jumpName,
  enabled,
  onClose,
  onOpenPage,
}: {
  jumpName: string;
  enabled: EnabledModules;
  onClose: () => void;
  onOpenPage: (id: ModuleId) => void;
}) {
  const root = useRef<HTMLElement>(null);
  const available = supplementTools.filter((tool) => enabled[tool.module]);
  const [selected, setSelected] = useState<ToolId>(available[0]?.id ?? "body");
  const active = available.some((tool) => tool.id === selected)
    ? selected
    : available[0]?.id;
  useEffect(() => {
    root.current
      ?.querySelector<HTMLElement>('nav [aria-pressed="true"]')
      ?.focus();
  }, []);
  if (!hasEnabledSupplements(enabled) || !active) return null;
  return (
    <section
      ref={root}
      className="chain-supp-context tracker-supp-context"
      role="dialog"
      aria-modal="false"
      aria-label={`${jumpName} current-Jump supplements`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header>
        <div>
          <p>Current-Jump supplements</p>
          <h4>{jumpName}</h4>
        </div>
        <button
          type="button"
          aria-label="Close current-Jump supplements"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="chain-supp-context-layout">
        <nav aria-label="Enabled supplement tools">
          {available.map((tool, index) => (
            <button
              key={tool.id}
              type="button"
              aria-pressed={active === tool.id}
              onClick={() => setSelected(tool.id)}
              onKeyDown={(event) => {
                let next: number;
                if (event.key === "ArrowDown")
                  next = (index + 1) % available.length;
                else if (event.key === "ArrowUp")
                  next = (index - 1 + available.length) % available.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = available.length - 1;
                else return;
                event.preventDefault();
                setSelected(available[next].id);
                (
                  event.currentTarget.parentElement?.children[
                    next
                  ] as HTMLElement
                )?.focus();
              }}
            >
              <strong>{tool.name}</strong>
              <span>{tool.job}</span>
            </button>
          ))}
        </nav>
        <div className="chain-supp-context-content">
          <div className="tracker-supp-jump-label">
            Selected Jump · {jumpName}
          </div>
          <SupplementDialog
            tool={active}
            close={onClose}
            embedded
            jumpName={jumpName}
            openPage={(id) => {
              onClose();
              onOpenPage(id);
            }}
          />
        </div>
      </div>
    </section>
  );
}
