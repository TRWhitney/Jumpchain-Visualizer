import { useLayoutEffect, useRef, useState, type Dispatch } from "react";
import { translate } from "../localization";
import { handleRovingTabKeyDown } from "../ui";
import {
  filteredInventory,
  jumpNumber,
  packageForEntry,
  trackerPages,
  visibleCompanions,
  visibleForms,
  type TrackerAction,
  type TrackerPage,
  type TrackerState,
} from "./model";

const pageLabels: Record<TrackerPage, string> = {
  jump: "Chain & Jump",
  inventory: "Inventory",
  forms: "Forms",
  companions: "Companions",
  supplements: "Supplements",
};

type NavigationProps = {
  state: TrackerState;
  dispatch: Dispatch<TrackerAction>;
};

export function TruncatedText({ children }: { children: string }) {
  const ref = useRef<HTMLElement>(null);
  const [truncated, setTruncated] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () =>
      setTruncated(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);
  return (
    <small ref={ref} title={truncated ? children : undefined}>
      {children}
    </small>
  );
}

export function ChainHeader() {
  return (
    <header className="chain-mock-header">
      <div>
        <span className="chain-mock-mark" aria-hidden="true">
          {translate("ui.chainTracker.text.jv")}
        </span>
        <div>
          <p>{translate("ui.chainTracker.text.chainTracker")}</p>
          <strong>{translate("ui.chainTracker.text.morgan")}</strong>
        </div>
      </div>
      <nav
        aria-label={translate(
          "ui.chainTracker.ariaLabel.applicationWorkspaceSwitch",
        )}
      >
        <button type="button">
          {translate("ui.chainTracker.text.editor")}
        </button>
        <button type="button" aria-current="page">
          {translate("ui.chainTracker.text.chainTracker")}
        </button>
      </nav>
      <button type="button">
        {translate("ui.chainTracker.text.settings")}
      </button>
    </header>
  );
}

export function MainTabs({ state, dispatch }: NavigationProps) {
  const counts = {
    inventory: filteredInventory({
      ...state,
      inventoryKind: "all",
      inventoryTag: "all",
      inventorySearch: "",
    }).length,
    forms: visibleForms(state).length,
    companions: visibleCompanions(state).length,
  };
  return (
    <div
      className="chain-main-tabs"
      role="tablist"
      aria-label={translate("ui.chainTracker.ariaLabel.chainWorkspacePage")}
      onKeyDown={(event) =>
        handleRovingTabKeyDown(event, trackerPages, state.page, (page) =>
          dispatch({ type: "set-page", page }),
        )
      }
    >
      {trackerPages.map((page) => (
        <button
          key={page}
          type="button"
          role="tab"
          data-tour-target={
            page === "inventory"
              ? "tracker-inventory-tab"
              : page === "supplements"
                ? "tracker-supplements-tab"
                : undefined
          }
          aria-selected={state.page === page}
          tabIndex={state.page === page ? 0 : -1}
          onClick={() => dispatch({ type: "set-page", page })}
        >
          {pageLabels[page]}
          {page === "inventory" && <span>{counts.inventory}</span>}
          {page === "forms" && <span>{counts.forms}</span>}
          {page === "companions" && <span>{counts.companions}</span>}
        </button>
      ))}
    </div>
  );
}

export function HistoricalSelect({
  state,
  dispatch,
  label,
}: NavigationProps & { label: string }) {
  return (
    <label className="chain-point-control">
      <span>{label}</span>
      <select
        aria-label={`${label} historical cutoff`}
        value={state.inspectionPointId}
        onChange={(event) =>
          dispatch({ type: "set-inspection", entryId: event.target.value })
        }
      >
        {[...state.order].reverse().map((id) => {
          const item = packageForEntry(state, id);
          const number = jumpNumber(state, id);
          return (
            <option key={id} value={id}>
              {number ? `${number}. ` : ""}
              {item.name} · {number ? `v${item.version}` : "Chain beginning"}
            </option>
          );
        })}
      </select>
    </label>
  );
}
