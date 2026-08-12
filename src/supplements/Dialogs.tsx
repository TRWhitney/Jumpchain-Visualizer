import { useState } from "react";
import { Modal } from "../ui/SupplementWidgets";
import type { ModuleId, ToolId } from "./model";
import { useBodyMod } from "./useBodyMod";
import {
  bestialPresentation,
  bodyModPerkLabel,
  bodyModPerks,
  bodyModRemaining,
  bodyModStatLabel,
  bodyModStats,
  bodyModTypeLabel,
  perkDescriptions,
  statDescriptions,
  totalPerk,
  totalStat,
  bodyTypes,
} from "./bodyMod";
import { ParityDialog } from "./ParityDialogs";
import { translate } from "../localization";
import { LimitedInheritanceDialog } from "./LimitedInheritance";
import type { InheritanceCandidate } from "./limitedInheritance";
import type { TagDefinition } from "../domain/tags";

export function SupplementDialog({
  tool,
  close,
  openPage,
  embedded = false,
  jumpName = "Arcane Realms",
  jumpEntryId = "entry-1",
  jumpNumber = 2,
  gauntlet = false,
  inheritanceCandidates = [],
  tagDefinitions = {},
}: {
  tool: ToolId;
  close: () => void;
  openPage: (id: ModuleId) => void;
  embedded?: boolean;
  jumpName?: string;
  jumpEntryId?: string;
  jumpNumber?: number;
  gauntlet?: boolean;
  inheritanceCandidates?: readonly InheritanceCandidate[];
  tagDefinitions?: Readonly<Record<string, TagDefinition>>;
}) {
  const { state } = useBodyMod();
  const [bodyDetail, setBodyDetail] = useState<string | null>(null);
  if (tool === "limited-inheritance")
    return (
      <LimitedInheritanceDialog
        candidates={inheritanceCandidates}
        tagDefinitions={tagDefinitions}
        entryId={jumpEntryId}
        jumpName={jumpName}
        close={close}
        embedded={embedded}
        openPage={() => openPage("limited-inheritance")}
      />
    );
  if (tool === "body") {
    const remaining = bodyModRemaining(state);
    const bodyType = bodyModTypeLabel(state.type);
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
        title={translate("ui.dialogs.title.bodyModAtAGlance")}
        kicker={`${jumpName} · Current-Jump projection`}
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
            <span>
              {state.build} {translate("ui.dialogs.text.build")}
            </span>
            <dl>
              <div>
                <dt>{translate("ui.dialogs.text.jumpSpecies")}</dt>
                <dd>{species}</dd>
              </div>
              <div>
                <dt>{translate("ui.dialogs.text.currentAge")}</dt>
                <dd>24</dd>
              </div>
              <div>
                <dt>{translate("ui.dialogs.text.bodyMod")}</dt>
                <dd>{bodyType}</dd>
              </div>
            </dl>
            <button type="button" onClick={() => openPage("body-mod")}>
              {translate("ui.dialogs.text.openFullBodyMod")}
            </button>
          </aside>
          <section>
            <div className="bodymod-dialog-heading">
              <div>
                <p>{translate("ui.dialogs.text.persistentBaseline")}</p>
                <h5>{translate("ui.dialogs.text.statistics")}</h5>
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
                    <span>{bodyModStatLabel(name)}</span>
                    <span className="bodymod-dialog-bar">
                      <i style={{ width: `${rank * 25}%` }} />
                    </span>
                    <span className="bodymod-dialog-rank">{rank}</span>
                    <span
                      id={tooltipId}
                      className="bodymod-stat-tooltip"
                      role="tooltip"
                    >
                      {translate("ui.dialogs.text.rank")}
                      {rank}: {statDescriptions[name][rank]}
                    </span>
                  </div>
                );
              })}
            </div>
            <h6>
              {translate("ui.dialogs.text.bodyModPerks")}
              <span>{translate("ui.dialogs.text.chooseABadgeForDetails")}</span>
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
                    {bodyModPerkLabel(name)} {rank}
                  </button>
                ))
              ) : (
                <span>{translate("ui.dialogs.text.noBodyModPerks")}</span>
              )}
            </div>
            {selectedDetail && (
              <div className="bodymod-dialog-perk-detail" role="region">
                <h6>
                  {bodyModPerkLabel(selectedDetail.name)} {selectedDetail.rank}
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
              {translate(
                "ui.dialogs.text.anAuthoredOriginSpeciesIsUsedWhenPresentOtherwise",
              )}
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
      jumpName={jumpName}
      jumpEntryId={jumpEntryId}
      jumpNumber={jumpNumber}
      gauntlet={gauntlet}
    />
  );
}
