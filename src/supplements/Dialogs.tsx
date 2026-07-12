import { useState } from "react";
import { Modal } from "../ui/SupplementWidgets";
import type { ModuleId, ToolId } from "./model";
import { useBodyMod } from "./useBodyMod";
import {
  bestialPresentation,
  bodyModPerks,
  bodyModRemaining,
  bodyModStats,
  perkDescriptions,
  statDescriptions,
  totalPerk,
  totalStat,
  bodyTypes,
} from "./bodyMod";
import { ParityDialog } from "./ParityDialogs";

export function SupplementDialog({
  tool,
  close,
  openPage,
  embedded = false,
}: {
  tool: ToolId;
  close: () => void;
  openPage: (id: ModuleId) => void;
  embedded?: boolean;
}) {
  const { state } = useBodyMod();
  const [bodyDetail, setBodyDetail] = useState<string | null>(null);
  if (tool === "body") {
    const remaining = bodyModRemaining(state);
    const bodyType = state.type === "None" ? "Current body" : state.type;
    const species =
      state.type === "Bestial" ? bestialPresentation(state) : "Human";
    const selectedPerks = bodyModPerks
      .map(([name]) => ({ name, rank: totalPerk(state, name) }))
      .filter(({ rank }) => rank > 0);
    const selectedDetail = selectedPerks.find(
      ({ name }) => name === bodyDetail,
    );
    return (
      <Modal
        title="Body Mod at a glance"
        kicker="Arcane Realms · Current-Jump projection"
        className="bodymod-dialog-mock"
        onClose={close}
        embedded={embedded}
      >
        <div className="bodymod-dialog-body">
          <aside>
            <div className="bodymod-dialog-avatar">
              {state.type === "Bestial"
                ? `${(state.animal || "A")[0].toUpperCase()}D`
                : bodyTypes[state.type].initials}
            </div>
            <h5>{bodyType}</h5>
            <span>{state.build} build</span>
            <dl>
              <div>
                <dt>Jump species</dt>
                <dd>{species}</dd>
              </div>
              <div>
                <dt>Current age</dt>
                <dd>24</dd>
              </div>
              <div>
                <dt>Body Mod</dt>
                <dd>{bodyType}</dd>
              </div>
            </dl>
            <button type="button" onClick={() => openPage("body-mod")}>
              Open full Body Mod
            </button>
          </aside>
          <section>
            <div className="bodymod-dialog-heading">
              <div>
                <p>Persistent baseline</p>
                <h5>Statistics</h5>
              </div>
              <span
                id="bodymod-dialog-budget"
                className={remaining < 0 ? "is-negative" : ""}
              >
                {remaining < 0
                  ? `${Math.abs(remaining)} CP over`
                  : `${remaining} CP unspent`}
              </span>
            </div>
            <div className="bodymod-dialog-stats">
              {bodyModStats.map((name) => {
                const rank = totalStat(state, name);
                const tooltipId = `bodymod-${name.toLowerCase()}-tooltip`;
                return (
                  <div
                    className="bodymod-dialog-stat"
                    key={name}
                    tabIndex={0}
                    aria-describedby={tooltipId}
                  >
                    <span>{name}</span>
                    <span className="bodymod-dialog-bar">
                      <i style={{ width: `${rank * 25}%` }} />
                    </span>
                    <span className="bodymod-dialog-rank">{rank}</span>
                    <span
                      id={tooltipId}
                      className="bodymod-stat-tooltip"
                      role="tooltip"
                    >
                      Rank {rank}: {statDescriptions[name][rank]}
                    </span>
                  </div>
                );
              })}
            </div>
            <h6>
              Body Mod perks <span>Choose a badge for details</span>
            </h6>
            <div className="bodymod-dialog-perk-badges">
              {selectedPerks.length ? (
                selectedPerks.map(({ name, rank }) => (
                  <button
                    key={name}
                    type="button"
                    aria-expanded={bodyDetail === name}
                    title={
                      perkDescriptions[name][
                        Math.min(rank, perkDescriptions[name].length - 1)
                      ]
                    }
                    onClick={() =>
                      setBodyDetail((current) =>
                        current === name ? null : name,
                      )
                    }
                  >
                    {name} {rank}
                  </button>
                ))
              ) : (
                <span>No Body Mod perks</span>
              )}
            </div>
            {selectedDetail && (
              <div className="bodymod-dialog-perk-detail" role="region">
                <h6>
                  {selectedDetail.name} {selectedDetail.rank}
                </h6>
                <p>
                  {
                    perkDescriptions[selectedDetail.name][
                      Math.min(
                        selectedDetail.rank,
                        perkDescriptions[selectedDetail.name].length - 1,
                      )
                    ]
                  }
                </p>
              </div>
            )}
            <p className="bodymod-dialog-note">
              An authored Origin species is used when present. Otherwise the
              active Bestial type or Human is shown. Body Mod remains visible
              separately.
            </p>
          </section>
        </div>
      </Modal>
    );
  }
  return (
    <ParityDialog
      tool={tool}
      close={close}
      openPage={openPage}
      embedded={embedded}
    />
  );
}
