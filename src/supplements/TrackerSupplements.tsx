import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
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
import type { BodyModState } from "./bodyMod";
import type { SupplementAction, SupplementState } from "./supplementState";
import { translate } from "../localization";
import { handleRovingTabKeyDown } from "../ui/rovingTabs";

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

export function SupplementProviders({
  children,
  bodyMod,
  onBodyModChange,
  supplementState,
  supplementDispatch,
}: {
  children: ReactNode;
  bodyMod?: BodyModState;
  onBodyModChange?: (value: BodyModState) => void;
  supplementState?: SupplementState;
  supplementDispatch?: Dispatch<SupplementAction>;
}) {
  return (
    <BodyModProvider state={bodyMod} onChange={onBodyModChange}>
      <SupplementStateProvider
        state={supplementState}
        dispatch={supplementDispatch}
      >
        {children}
      </SupplementStateProvider>
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
        aria-label={translate(
          "ui.trackerSupplements.ariaLabel.supplementPages",
        )}
        onKeyDown={(event) =>
          handleRovingTabKeyDown(
            event,
            pages.map((item) => item.id),
            page,
            onPageChange,
          )
        }
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
            <p>{translate("ui.trackerSupplements.text.supplementLibrary")}</p>
            <h4>{translate("ui.trackerSupplements.text.manageSupplements")}</h4>
            <span>
              {translate(
                "ui.trackerSupplements.text.supportedModulesRemainListedEnabledModulesReceivePagesAnd",
              )}
            </span>
          </header>
          <div className="supplement-manage-list">
            {modules.map((module) => (
              <article
                key={module.id}
                data-tour-target={
                  module.id === "body-mod"
                    ? "tracker-enable-body-mod"
                    : undefined
                }
              >
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
                  <span>{translate("ui.trackerSupplements.text.enabled")}</span>
                </label>
                <button
                  type="button"
                  disabled={!enabled[module.id]}
                  onClick={() => onPageChange(module.id)}
                >
                  {translate("ui.trackerSupplements.text.openPage")}
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
  jumpEntryId,
  jumpNumber,
  enabled,
  onClose,
  onOpenPage,
  gauntlet = false,
}: {
  jumpName: string;
  jumpEntryId: string;
  jumpNumber: number;
  enabled: EnabledModules;
  onClose: () => void;
  onOpenPage: (id: ModuleId) => void;
  gauntlet?: boolean;
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
      aria-modal="true"
      aria-label={`${jumpName} current-Jump supplements`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = [
          ...(root.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
          ) ?? []),
        ];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <header>
        <div>
          <p>
            {translate("ui.trackerSupplements.text.currentJumpSupplements")}
          </p>
          <h4>{jumpName}</h4>
        </div>
        <button
          type="button"
          aria-label={translate(
            "ui.trackerSupplements.ariaLabel.closeCurrentJumpSupplements",
          )}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="chain-supp-context-layout">
        <nav
          aria-label={translate(
            "ui.trackerSupplements.ariaLabel.enabledSupplementTools",
          )}
        >
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
            {translate("ui.trackerSupplements.text.selectedJump")}
            {jumpName}
          </div>
          <SupplementDialog
            tool={active}
            close={onClose}
            embedded
            jumpName={jumpName}
            jumpEntryId={jumpEntryId}
            jumpNumber={jumpNumber}
            gauntlet={gauntlet}
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
