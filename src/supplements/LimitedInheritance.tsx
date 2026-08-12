import { useMemo, useState } from "react";
import { translate, localeList } from "../localization";
import { Modal } from "../ui/SupplementWidgets";
import { NumberStepper } from "../ui/NumberStepper";
import { Chevron } from "../ui/Chevron";
import { TagBadge } from "../ui/TagBadge";
import type { TagDefinition } from "../domain/tags";
import {
  canAssignCandidate,
  effectiveCandidatePool,
  inheritancePoolAssignmentEntryIds,
  inheritanceKinds,
  poolSelectionCount,
  type InheritanceCandidate,
  type InheritanceKind,
} from "./limitedInheritance";
import { useSupplementState } from "./useSupplementState";

const kindLabel = (kind: InheritanceKind) =>
  translate(`ui.limitedInheritance.kind.${kind}`);
const emptyAssignments: Readonly<Record<string, string>> = {};

const poolLabel = (
  kinds: readonly InheritanceKind[],
  limit: number,
  unlimited: boolean,
) =>
  translate("ui.limitedInheritance.poolSummary", {
    limit: unlimited ? translate("ui.limitedInheritance.unlimited") : limit,
    kinds: kinds.length
      ? localeList(kinds.map(kindLabel))
      : translate("ui.limitedInheritance.noCategories"),
  });

export function LimitedInheritancePage() {
  const { state, dispatch, entryLabels } = useSupplementState();
  const limited = state.limitedInheritance;
  const [removing, setRemoving] = useState<string | null>(null);
  const pool = limited.pools.find((item) => item.id === removing);
  const affectedEntries = pool
    ? inheritancePoolAssignmentEntryIds(limited, pool.id)
    : [];
  return (
    <div className="limited-full-mock">
      <header>
        <div>
          <p>{translate("ui.limitedInheritance.rulesSupplement")}</p>
          <h4>{translate("ui.limitedInheritance.name")}</h4>
          <span>{translate("ui.limitedInheritance.mainSubtitle")}</span>
        </div>
        <strong>
          {translate("ui.limitedInheritance.poolCount", {
            count: limited.pools.length,
          })}
        </strong>
      </header>
      <div className="limited-full-body">
        <section className="limited-explanation">
          <p>{translate("ui.limitedInheritance.whatChanges")}</p>
          <h5>{translate("ui.limitedInheritance.explanationTitle")}</h5>
          <p>{translate("ui.limitedInheritance.explanation")}</p>
          <div>
            <article>
              <strong>{translate("ui.limitedInheritance.currentJump")}</strong>
              <span>
                {translate("ui.limitedInheritance.currentJumpExplanation")}
              </span>
            </article>
            <article>
              <strong>{translate("ui.limitedInheritance.futureJumps")}</strong>
              <span>
                {translate("ui.limitedInheritance.futureJumpExplanation")}
              </span>
            </article>
            <article>
              <strong>
                {translate("ui.limitedInheritance.companionHistory")}
              </strong>
              <span>
                {translate("ui.limitedInheritance.companionHistoryExplanation")}
              </span>
            </article>
          </div>
        </section>
        <section className="limited-pool-workspace">
          <div className="limited-pool-heading">
            <div>
              <p>{translate("ui.limitedInheritance.allowances")}</p>
              <h5>{translate("ui.limitedInheritance.inheritancePools")}</h5>
            </div>
            <button
              type="button"
              disabled={limited.pools.length >= 32}
              onClick={() => dispatch({ type: "limited-add-pool" })}
            >
              {translate("ui.limitedInheritance.addPool")}
            </button>
          </div>
          <div className="limited-pool-list">
            {limited.pools.map((item, index) => {
              const usage = Object.values(limited.assignments).reduce(
                (total, assignments) =>
                  total +
                  Object.values(assignments).filter((id) => id === item.id)
                    .length,
                0,
              );
              const overLimitJumps = item.unlimited
                ? 0
                : Object.values(limited.assignments).filter(
                    (assignments) =>
                      Object.values(assignments).filter((id) => id === item.id)
                        .length > item.limit,
                  ).length;
              return (
                <article key={item.id} className="limited-pool-card">
                  <header>
                    <div>
                      <span>
                        {translate("ui.limitedInheritance.poolNumber", {
                          number: index + 1,
                        })}
                      </span>
                      <strong>
                        {poolLabel(item.kinds, item.limit, item.unlimited)}
                      </strong>
                    </div>
                    <button
                      type="button"
                      aria-label={translate(
                        "ui.limitedInheritance.removePoolLabel",
                        { number: index + 1 },
                      )}
                      onClick={() => {
                        if (usage === 0) {
                          dispatch({
                            type: "limited-remove-pool",
                            poolId: item.id,
                          });
                          return;
                        }
                        setRemoving(item.id);
                      }}
                    >
                      {translate("ui.limitedInheritance.remove")}
                    </button>
                  </header>
                  <fieldset>
                    <legend>
                      {translate("ui.limitedInheritance.eligibleCategories")}
                    </legend>
                    {inheritanceKinds.map((kind) => {
                      const active = item.kinds.includes(kind);
                      return (
                        <button
                          key={kind}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            dispatch({
                              type: "limited-update-pool",
                              poolId: item.id,
                              update: {
                                kinds: active
                                  ? item.kinds.filter((value) => value !== kind)
                                  : [...item.kinds, kind],
                              },
                            })
                          }
                        >
                          {kindLabel(kind)}
                        </button>
                      );
                    })}
                  </fieldset>
                  <div className="limited-limit-controls">
                    <label className="limited-unlimited-control">
                      <span>
                        {translate("ui.limitedInheritance.allowanceType")}
                      </span>
                      <span className="limited-unlimited-toggle">
                        <input
                          type="checkbox"
                          checked={item.unlimited}
                          onChange={(event) =>
                            dispatch({
                              type: "limited-update-pool",
                              poolId: item.id,
                              update: { unlimited: event.target.checked },
                            })
                          }
                        />
                        <b>{translate("ui.limitedInheritance.unlimited")}</b>
                      </span>
                    </label>
                    <div
                      className={`limited-limit-field${item.unlimited ? " is-disabled" : ""}`}
                    >
                      <span>
                        {translate("ui.limitedInheritance.perJumpLimit")}
                      </span>
                      <NumberStepper
                        label={translate("ui.limitedInheritance.perJumpLimit")}
                        value={item.limit}
                        min={0}
                        max={99}
                        disabled={item.unlimited}
                        onChange={(value) =>
                          dispatch({
                            type: "limited-update-pool",
                            poolId: item.id,
                            update: { limit: value ?? 0 },
                          })
                        }
                      />
                    </div>
                  </div>
                  <p className="limited-pool-usage">
                    {translate("ui.limitedInheritance.historicalAssignments", {
                      count: usage,
                    })}
                    {overLimitJumps > 0 && (
                      <strong>
                        {translate("ui.limitedInheritance.grandfatheredUsage", {
                          count: overLimitJumps,
                        })}
                      </strong>
                    )}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
      {pool && (
        <Modal
          title={translate("ui.limitedInheritance.removePoolTitle")}
          kicker={translate("ui.limitedInheritance.confirmation")}
          className="limited-confirm-dialog"
          onClose={() => setRemoving(null)}
          showCloseButton={false}
        >
          <div className="limited-confirm-body">
            <p>
              {translate("ui.limitedInheritance.removePoolExplanation", {
                pool: poolLabel(pool.kinds, pool.limit, pool.unlimited),
                count: affectedEntries.length,
              })}
            </p>
            {affectedEntries.length > 0 && (
              <ul>
                {affectedEntries.map((entryId) => (
                  <li key={entryId}>{entryLabels[entryId] ?? entryId}</li>
                ))}
              </ul>
            )}
            <div>
              <button type="button" onClick={() => setRemoving(null)}>
                {translate("ui.limitedInheritance.cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "limited-remove-pool", poolId: pool.id });
                  setRemoving(null);
                }}
              >
                {translate("ui.limitedInheritance.removePool")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function LimitedInheritanceDialog({
  candidates,
  entryId,
  jumpName,
  close,
  openPage,
  embedded,
  tagDefinitions,
}: {
  candidates: readonly InheritanceCandidate[];
  entryId: string;
  jumpName: string;
  close: () => void;
  openPage: () => void;
  embedded?: boolean;
  tagDefinitions: Readonly<Record<string, TagDefinition>>;
}) {
  const { state, dispatch } = useSupplementState();
  const limited = state.limitedInheritance;
  const [collapsedPools, setCollapsedPools] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const assignments = limited.assignments[entryId] ?? emptyAssignments;
  const visiblePools = useMemo(
    () =>
      limited.pools.flatMap((pool) => {
        const poolCandidates = candidates.filter((candidate) => {
          const effective = effectiveCandidatePool(limited, entryId, candidate);
          return (
            assignments[candidate.id] === pool.id ||
            effective === pool.id ||
            (!effective && pool.kinds.includes(candidate.kind))
          );
        });
        return poolCandidates.length
          ? [{ pool, candidates: poolCandidates }]
          : [];
      }),
    [assignments, candidates, entryId, limited],
  );
  return (
    <Modal
      title={translate("ui.limitedInheritance.chooseInheritance")}
      kicker={`${jumpName} · ${translate("ui.limitedInheritance.currentJump")}`}
      className="limited-dialog-mock"
      onClose={close}
      embedded={embedded}
    >
      <div className="limited-dialog-body">
        <aside>
          <p>{translate("ui.limitedInheritance.futureLoadout")}</p>
          <strong>{Object.keys(assignments).length}</strong>
          <span>{translate("ui.limitedInheritance.explicitSelections")}</span>
          <p>{translate("ui.limitedInheritance.dialogExplanation")}</p>
          <button type="button" onClick={openPage}>
            {translate("ui.limitedInheritance.configurePools")}
          </button>
        </aside>
        <section>
          {visiblePools.map(({ pool, candidates: poolCandidates }) => {
            const selected = poolSelectionCount(limited, entryId, pool.id);
            const collapsed = collapsedPools.has(pool.id);
            const candidateListId = `limited-candidates-${pool.id}`;
            return (
              <section className="limited-dialog-pool" key={pool.id}>
                <header>
                  <button
                    type="button"
                    className="limited-pool-disclosure"
                    aria-expanded={!collapsed}
                    aria-controls={candidateListId}
                    title={translate(
                      collapsed
                        ? "ui.limitedInheritance.expandPool"
                        : "ui.limitedInheritance.collapsePool",
                    )}
                    onClick={() =>
                      setCollapsedPools((current) => {
                        const next = new Set(current);
                        if (collapsed) next.delete(pool.id);
                        else next.add(pool.id);
                        return next;
                      })
                    }
                  >
                    <Chevron direction={collapsed ? "right" : "down"} />
                    <div>
                      <h5>
                        {poolLabel(pool.kinds, pool.limit, pool.unlimited)}
                      </h5>
                      <span>
                        {pool.unlimited
                          ? translate("ui.limitedInheritance.automatic")
                          : translate("ui.limitedInheritance.poolCapacity", {
                              selected,
                              limit: pool.limit,
                            })}
                      </span>
                    </div>
                  </button>
                </header>
                <div
                  className="limited-candidate-list"
                  id={candidateListId}
                  hidden={collapsed}
                >
                  {poolCandidates.map((candidate) => {
                    const explicit = assignments[candidate.id] === pool.id;
                    const automatic =
                      !assignments[candidate.id] &&
                      effectiveCandidatePool(limited, entryId, candidate) ===
                        pool.id;
                    const blocked =
                      !explicit &&
                      !automatic &&
                      !canAssignCandidate(limited, entryId, pool.id, candidate);
                    return (
                      <article
                        key={candidate.id}
                        className={explicit || automatic ? "is-selected" : ""}
                      >
                        <div>
                          <span>{kindLabel(candidate.kind)}</span>
                          <strong>{candidate.name}</strong>
                          <small className="limited-candidate-source">
                            {translate("ui.limitedInheritance.source", {
                              jump: jumpName,
                            })}
                          </small>
                          <p>{candidate.description}</p>
                          {candidate.tags.some(
                            (tag) => tagDefinitions[tag],
                          ) && (
                            <div className="limited-candidate-tags">
                              {candidate.tags.map((tag) =>
                                tagDefinitions[tag] ? (
                                  <TagBadge
                                    key={tag}
                                    tag={tagDefinitions[tag]}
                                  />
                                ) : null,
                              )}
                            </div>
                          )}
                          {candidate.bundledRecordIds.length > 0 &&
                            (candidate.kind === "form" ||
                              candidate.kind === "companion") && (
                              <small>
                                {translate(
                                  "ui.limitedInheritance.bundledRecords",
                                  {
                                    count: candidate.bundledRecordIds.length,
                                  },
                                )}
                              </small>
                            )}
                          {blocked && (
                            <small className="limited-candidate-warning">
                              {translate("ui.limitedInheritance.poolFull")}
                            </small>
                          )}
                        </div>
                        {automatic ? (
                          <em>
                            {translate("ui.limitedInheritance.automatic")}
                          </em>
                        ) : (
                          <button
                            type="button"
                            aria-pressed={explicit}
                            disabled={blocked}
                            title={
                              blocked
                                ? translate("ui.limitedInheritance.poolFull")
                                : undefined
                            }
                            onClick={() =>
                              dispatch(
                                explicit
                                  ? {
                                      type: "limited-unassign",
                                      entryId,
                                      candidateId: candidate.id,
                                    }
                                  : {
                                      type: "limited-assign",
                                      entryId,
                                      poolId: pool.id,
                                      candidate,
                                    },
                              )
                            }
                          >
                            {translate(
                              explicit
                                ? "ui.limitedInheritance.removeSelection"
                                : "ui.limitedInheritance.keep",
                            )}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!visiblePools.length && (
            <p className="limited-empty">
              {translate("ui.limitedInheritance.noEligibleChoices")}
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}
