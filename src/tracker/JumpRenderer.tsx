import {
  Fragment,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
} from "react";
import type {
  CanonicalJumpPackage,
  ChoiceSource,
  JumpChoice,
  JumpLayout,
  LayoutNode,
  Renderable,
  RichInline,
} from "../markup";
import { parseRichText, resolveCostAmount } from "../markup";
import {
  renderRenderable,
  type ActorEntryState,
  type EvaluatedActorJump,
  type EvaluatedGrantRecord,
} from "../domain";
import { platformRandomIndex, type RandomIndexSource } from "../domain";
import { CanonicalTrackerTagBadge } from "../settings/TagBadge";
import type { TagDefinition, TrackerAction, TrackerPreferences } from "./model";
import { NumberStepper } from "./NumberStepper";
import { resolveJumpImageSource, type JumpAssetResolver } from "./jumpImages";

const label = (value: Renderable | undefined, fallback = "") =>
  value?.base ?? value?.variants[0]?.value ?? fallback;

function RichInlines({ values }: { values: readonly RichInline[] }) {
  return values.map((value, index) => {
    let content: ReactNode = value.text;
    if (value.bold) content = <strong>{content}</strong>;
    if (value.italic) content = <em>{content}</em>;
    if (value.strike) content = <s>{content}</s>;
    if (value.underline) content = <u>{content}</u>;
    return <span key={index}>{content}</span>;
  });
}

function RichText({
  source,
  style,
}: {
  source: string;
  style?: CSSProperties;
}) {
  return parseRichText(source).map((block, index) => {
    if (block.kind === "paragraph")
      return (
        <p className="jump-layout-text" key={index} style={style}>
          <RichInlines values={block.content} />
        </p>
      );
    if (block.kind === "list")
      return (
        <ul className="jump-layout-text" key={index} style={style}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <RichInlines values={item} />
            </li>
          ))}
        </ul>
      );
    return (
      <table className="jump-layout-text" key={index} style={style}>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>
                  <RichInlines values={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  });
}

export type JumpRendererProps = {
  packageItem: CanonicalJumpPackage;
  entryId: string;
  actorId: string;
  state: ActorEntryState;
  evaluation: EvaluatedActorJump;
  preferences: TrackerPreferences;
  tags: Readonly<Record<string, TagDefinition>>;
  companions: readonly { id: string; name: string }[];
  gauntletActive: boolean;
  resolveAsset?: JumpAssetResolver;
  randomIndex?: RandomIndexSource;
  dispatch: Dispatch<TrackerAction>;
};

type Props = JumpRendererProps;

function ChoiceTags({ choice, props }: { choice: JumpChoice; props: Props }) {
  if (!choice.tags.length) return null;
  return (
    <div className="default-choice-tags">
      {choice.tags.map((tagId) => {
        const tag = props.tags[tagId];
        const fallback = props.tags.miscellaneous;
        return (
          <CanonicalTrackerTagBadge
            key={tagId}
            tag={
              tag ?? {
                ...(fallback ?? {
                  color: "#68707c",
                  to: "#454b54",
                  style: "soft" as const,
                }),
                id: tagId,
                label: tagId,
                parent: "miscellaneous",
                aliases: [],
              }
            }
            surface="#f5f1e6"
          />
        );
      })}
    </div>
  );
}

const rendererContext = (props: Props) => ({
  ...Object.fromEntries(
    Object.entries(props.evaluation.properties).map(([handle, property]) => [
      handle,
      property?.value,
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(props.evaluation.choices).map(([handle, choice]) => [
      handle,
      typeof choice.value === "boolean" ||
      typeof choice.value === "string" ||
      typeof choice.value === "number"
        ? choice.value
        : undefined,
    ]),
  ),
  gauntlet: props.gauntletActive,
});
const resolved = (
  value: Renderable | undefined,
  props: Props,
  fallback = "",
) => (value ? renderRenderable(value, rendererContext(props)) : fallback);

function CostBadges({
  choice,
  evaluation,
  source,
}: {
  choice: JumpChoice;
  evaluation: EvaluatedActorJump;
  source?: ChoiceSource;
}) {
  const view = evaluation.choices[choice.handle];
  const resolution = source?.resolution ?? choice.resolution;
  const randomOnly = resolution === "random";
  const rolled = source
    ? view?.rolledBySource
    : view?.rolledResult !== undefined;
  if (
    choice.continuity &&
    (!view?.active ||
      view.continuityFreeValues.includes(view.value as string | number))
  )
    return (
      <div className="cost-badge-row">
        <b className="cost-badge is-benefit">
          {view?.continuityBaseline === undefined
            ? "Any option is free"
            : `${choice.continuity === "previous" ? "Previous" : "Original"} is free`}
        </b>
      </div>
    );
  if (
    !choice.costs.length ||
    choice.costs.every((cost) => resolveCostAmount(cost.amount) === 0)
  )
    return (
      <div className="cost-badge-row">
        <b className="cost-badge is-benefit">Free</b>
      </div>
    );
  if (randomOnly && !rolled)
    return (
      <div className="cost-badge-row">
        <b className="cost-badge is-roll-pending">
          {choice.costs.some((cost) => cost.mode === "each") ? (
            <>
              <strong>Roll for Free</strong>
              <span>Rank count pending</span>
            </>
          ) : (
            "Roll for Free"
          )}
        </b>
      </div>
    );
  const rankCost = view?.costs.find((cost) => cost.mode === "each");
  if (rolled && !source && view?.active && !view.freeByRoll && !rankCost) {
    return (
      <div className="cost-badge-row">
        {view.costs.map((cost) => {
          const suffix =
            evaluation.resources[cost.resource]?.abbreviation ?? cost.resource;
          return (
            <b key={cost.resource} className="cost-badge is-stacked">
              <strong>
                {Math.abs(cost.originalAmount)} {suffix}
              </strong>
              <span>Rolled {String(view.rolledResult)} is Free</span>
            </b>
          );
        })}
      </div>
    );
  }
  if (
    rolled &&
    (view?.freeByRoll ||
      !view?.active ||
      source ||
      rankCost?.rolledAllowance !== undefined)
  ) {
    const rank = view.costs.find((cost) => cost.mode === "each");
    const claimed = view.active;
    const allowance = rank?.rolledAllowance;
    const ranks = rank?.rankCount;
    const paidRanks = Math.max(0, (ranks ?? 0) - (allowance ?? 0));
    const authoredCost = rank
      ? choice.costs.find((cost) => cost.resource === rank.resource)
      : undefined;
    const unit = authoredCost
      ? Math.abs(resolveCostAmount(authoredCost.amount))
      : 0;
    if (rank && allowance !== undefined && claimed && paidRanks > 0)
      return (
        <div className="cost-badge-row">
          <b className="cost-badge is-ranked is-mixed">
            <span>
              {allowance} rank{allowance === 1 ? "" : "s"} Free · Rolled
            </span>
            <strong>
              {paidRanks} paid × {unit} CP · {paidRanks * unit} CP total
            </strong>
          </b>
        </div>
      );
    return (
      <div className="cost-badge-row">
        <b
          className={`cost-badge is-benefit is-stacked${rank ? " is-ranked" : ""}`}
        >
          <strong>
            {allowance !== undefined && !claimed
              ? `Up to ${allowance} rank${allowance === 1 ? "" : "s"} Free`
              : "Free"}
          </strong>
          <span>
            {rank && claimed && allowance !== undefined
              ? `${ranks} rank${ranks === 1 ? "" : "s"} selected · ${allowance} rolled`
              : `Rolled${
                  (claimed || source) &&
                  resolution === "either" &&
                  choice.costs.length
                    ? choice.costs.some(
                        (cost) => resolveCostAmount(cost.amount) < 0,
                      )
                      ? ` · replaces +${Math.abs(resolveCostAmount(choice.costs[0].amount))} ${evaluation.resources[choice.costs[0].resource]?.abbreviation ?? choice.costs[0].resource} award`
                      : ` · was ${choice.costs
                          .map(
                            (cost) =>
                              `${Math.abs(resolveCostAmount(cost.amount))} ${evaluation.resources[cost.resource]?.abbreviation ?? cost.resource}`,
                          )
                          .join(" + ")}`
                    : claimed || source
                      ? ""
                      : " · Not claimed"
                }`}
          </span>
        </b>
      </div>
    );
  }
  return (
    <div className="cost-badge-row">
      {view?.costs.map((cost) => {
        const resource = evaluation.resources[cost.resource];
        const suffix = resource?.abbreviation ?? cost.resource;
        const award = cost.resolvedAmount < 0;
        if (cost.mode === "each") {
          const authored = choice.costs.find(
            (item) => item.resource === cost.resource,
          );
          const each = authored
            ? Math.abs(resolveCostAmount(authored.amount))
            : Math.abs(cost.originalAmount);
          return (
            <b
              key={cost.resource}
              className={`cost-badge is-ranked${award ? " is-award" : ""}`}
            >
              <span>
                {each} {suffix} each
              </span>
              <strong>
                {cost.rankCount === undefined
                  ? "Awaiting ranks"
                  : `${cost.rankCount} rank${cost.rankCount === 1 ? "" : "s"} · ${Math.abs(cost.resolvedAmount)} ${suffix} total`}
              </strong>
            </b>
          );
        }
        return (
          <b
            key={cost.resource}
            className={`cost-badge${award ? " is-award" : ""}`}
          >
            {award ? "+" : ""}
            {Math.abs(cost.resolvedAmount || cost.originalAmount)} {suffix}
          </b>
        );
      })}
    </div>
  );
}

function ChoiceControl({
  choice,
  props,
  part = "both",
}: {
  choice: JumpChoice;
  props: Props;
  part?: "control" | "roll" | "both";
}) {
  const view = props.evaluation.choices[choice.handle];
  const storedValue = props.state.choices[choice.handle] ?? null;
  const value =
    storedValue === null && choice.continuity && view?.derivedContinuity
      ? view.value
      : storedValue;
  const set = (next: boolean | string | number | null) =>
    props.dispatch({
      type: "set-choice",
      entryId: props.entryId,
      actorId: props.actorId,
      choiceHandle: choice.handle,
      value: next,
    });
  const roll = () => {
    const candidates: (string | number)[] =
      choice.selection === "integer"
        ? Array.from(
            {
              length: Math.max(
                1,
                (choice.max ?? Math.max(choice.min ?? 0, 5)) -
                  (choice.min ?? 0) +
                  1,
              ),
            },
            (_, index) => (choice.min ?? 0) + index,
          )
        : choice.options.map((option) => label(option));
    const prior = props.state.choiceRolls[choice.handle]?.sequence ?? 0;
    const result =
      candidates[
        (props.randomIndex ?? platformRandomIndex)(candidates.length, prior)
      ] ?? 0;
    props.dispatch({
      type: "record-choice-roll",
      entryId: props.entryId,
      actorId: props.actorId,
      choiceHandle: choice.handle,
      result,
    });
  };
  const rolled = props.state.choiceRolls[choice.handle];
  const randomOnly = choice.resolution === "random";
  const showManual = !randomOnly;
  const canRoll = choice.resolution !== "manual";
  const showControl = part !== "roll";
  const showRoll = part !== "control";
  const formTargets = choice.grants.flatMap((grant) =>
    grant.form ? [grant.form] : [],
  );
  const activeForms = new Set(
    props.packageItem.choices.flatMap((candidate) =>
      props.evaluation.choices[candidate.handle]?.active
        ? candidate.grants.flatMap((grant) =>
            grant.kind === "form" && grant.handle ? [grant.handle] : [],
          )
        : [],
    ),
  );
  const missingForm = formTargets.find((target) => !activeForms.has(target));
  const missingFormName = props.packageItem.choices.find((candidate) =>
    candidate.grants.some(
      (grant) => grant.kind === "form" && grant.handle === missingForm,
    ),
  )?.name;
  const formDependencyUnavailable = Boolean(missingForm);
  if (part === "roll" && !canRoll) return null;
  return (
    <div className="default-choice-actions">
      {showControl && choice.selection === "toggle" && (
        <label className="check-control">
          <input
            type="checkbox"
            checked={value === true}
            disabled={formDependencyUnavailable}
            onChange={(event) => set(event.target.checked)}
          />
          <span>Take {label(choice.name, choice.handle)}</span>
        </label>
      )}
      {showControl && showManual && choice.selection === "text" && (
        <label>
          <span className="sr-only">{label(choice.name)}</span>
          <input
            type="text"
            placeholder="Unset"
            disabled={formDependencyUnavailable}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => set(event.target.value || null)}
          />
        </label>
      )}
      {showControl && showManual && choice.selection === "integer" && (
        <>
          <NumberStepper
            label={label(choice.name)}
            min={choice.min}
            max={choice.max}
            value={typeof value === "number" ? value : null}
            disabled={formDependencyUnavailable}
            onChange={set}
          />
          <span className="control-range">
            {choice.min ?? 0}–{choice.max ?? "∞"}
            {choice.costs.some((cost) => cost.mode === "each") ? " ranks" : ""}
          </span>
        </>
      )}
      {showControl && showManual && choice.selection === "select" && (
        <label>
          <span className="sr-only">{label(choice.name)}</span>
          <select
            value={typeof value === "string" ? value : ""}
            disabled={formDependencyUnavailable}
            onChange={(event) => set(event.target.value || null)}
          >
            <option value="">Unset</option>
            {choice.options.map((option) => {
              const text = resolved(option, props);
              const free = view?.continuityFreeValues.includes(text);
              return (
                <option key={text} value={text}>
                  {text}
                  {choice.continuity
                    ? free
                      ? " · Free"
                      : ` · ${choice.costs[0]?.amount ?? 0} CP`
                    : ""}
                </option>
              );
            })}
          </select>
        </label>
      )}
      {showControl && randomOnly && (
        <output data-roll-output>
          {rolled ? String(rolled.result) : "Not rolled"}
        </output>
      )}
      {showRoll && canRoll && (
        <button
          type="button"
          className="roll-control"
          disabled={
            formDependencyUnavailable ||
            (Boolean(rolled) &&
              !props.preferences.allowRerolls &&
              (!randomOnly || value === rolled?.result))
          }
          onClick={
            rolled &&
            randomOnly &&
            value !== rolled.result &&
            !props.preferences.allowRerolls
              ? () => set(rolled.result)
              : roll
          }
        >
          {rolled &&
          randomOnly &&
          value !== rolled.result &&
          !props.preferences.allowRerolls
            ? "Claim"
            : "Roll"}
        </button>
      )}
      {showControl && choice.selection !== "toggle" && (
        <button
          type="button"
          className="secondary-control"
          disabled={storedValue === null}
          onClick={() => set(null)}
        >
          Clear
        </button>
      )}
      {showControl && missingForm && (
        <em className="choice-provenance">
          Requires {label(missingFormName, missingForm)}
        </em>
      )}
      {showRoll && rolled && choice.resolution === "either" && (
        <em className="choice-provenance">Rolled {rolled.result}</em>
      )}
    </div>
  );
}

function InputControls({
  choice,
  props,
  target,
}: {
  choice: JumpChoice;
  props: Props;
  target?: string;
}) {
  if (!props.evaluation.choices[choice.handle]?.active || !choice.inputs.length)
    return null;
  const inputs = choice.inputs.filter(
    (input) => !target || input.handle === target,
  );
  if (!inputs.length) return null;
  return (
    <div className="jump-nested-inputs">
      {inputs.map((input) => {
        const value = props.state.inputs[choice.handle]?.[input.handle] ?? null;
        const importGrant = input.grants.find(
          (grant) => grant.kind === "companion-import" && grant.handle,
        );
        const importFunding = importGrant
          ? input.grants.filter(
              (grant) =>
                grant.kind === "resource" &&
                grant.companion === importGrant.handle &&
                grant.resource &&
                grant.amount !== undefined,
            )
          : [];
        const inputLabel = importGrant
          ? "Import companions"
          : input.handle.replaceAll("_", " ");
        const formTargets = input.grants.flatMap((grant) =>
          grant.form ? [grant.form] : [],
        );
        const activeForms = new Set(
          props.packageItem.choices.flatMap((candidate) =>
            props.evaluation.choices[candidate.handle]?.active
              ? candidate.grants.flatMap((grant) =>
                  grant.kind === "form" && grant.handle ? [grant.handle] : [],
                )
              : [],
          ),
        );
        const missingForm = formTargets.find((form) => !activeForms.has(form));
        const update = (next: string | number | readonly string[] | null) =>
          props.dispatch({
            type: "set-input",
            entryId: props.entryId,
            actorId: props.actorId,
            choiceHandle: choice.handle,
            inputHandle: input.handle,
            value: next,
          });
        if (input.selection === "companions")
          return (
            <fieldset className="companion-selection-input" key={input.handle}>
              <legend>{inputLabel}</legend>
              {importFunding.length > 0 && (
                <em className="choice-provenance companion-import-funding">
                  Each selected companion receives{" "}
                  {importFunding
                    .map(
                      (grant) =>
                        `${resolveCostAmount(grant.amount!)} ${props.evaluation.resources[grant.resource!]?.abbreviation ?? grant.resource}`,
                    )
                    .join(" and ")}
                  .
                </em>
              )}
              <span className="companion-roster">
                {props.companions.map((companion) => {
                  const selected =
                    Array.isArray(value) && value.includes(companion.id);
                  return (
                    <label className="check-control" key={companion.id}>
                      <input
                        type="checkbox"
                        disabled={Boolean(missingForm)}
                        checked={selected}
                        onChange={() =>
                          update(
                            selected
                              ? (value as readonly string[]).filter(
                                  (id) => id !== companion.id,
                                )
                              : [
                                  ...(Array.isArray(value) ? value : []),
                                  companion.id,
                                ],
                          )
                        }
                      />
                      <span>{companion.name}</span>
                    </label>
                  );
                })}
              </span>
            </fieldset>
          );
        return (
          <label key={input.handle}>
            <strong>{inputLabel}</strong>
            {input.selection === "text" && (
              <input
                type="text"
                disabled={Boolean(missingForm)}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => update(event.target.value || null)}
              />
            )}
            {input.selection === "integer" && (
              <NumberStepper
                label={inputLabel}
                min={input.min}
                max={input.max}
                fluid
                disabled={Boolean(missingForm)}
                value={typeof value === "number" ? value : null}
                onChange={update}
              />
            )}
            {input.selection === "select" && (
              <select
                disabled={Boolean(missingForm)}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => update(event.target.value || null)}
              >
                <option value="">Unset</option>
                {input.options.map((option) => (
                  <option key={resolved(option, props)}>
                    {resolved(option, props)}
                  </option>
                ))}
              </select>
            )}
            {missingForm && (
              <em className="choice-provenance">Requires form {missingForm}</em>
            )}
          </label>
        );
      })}
    </div>
  );
}

function SourceOptionControl({
  choice,
  source,
  sourceRoll,
  props,
}: {
  choice: JumpChoice;
  source: ChoiceSource;
  sourceRoll?: { result: string | number; sequence: number };
  props: Props;
}) {
  const checked = Boolean(props.evaluation.choices[choice.handle]?.active);
  const setGroup = () => {
    if (source.mode === "single") {
      for (const other of props.packageItem.choices.filter(
        (candidate) => source.group && candidate.groups.includes(source.group),
      ))
        props.dispatch({
          type: "set-choice",
          entryId: props.entryId,
          actorId: props.actorId,
          choiceHandle: other.handle,
          value: other.handle === choice.handle ? !checked : false,
        });
    } else
      props.dispatch({
        type: "set-choice",
        entryId: props.entryId,
        actorId: props.actorId,
        choiceHandle: choice.handle,
        value: !checked,
      });
  };
  return (
    <div className="default-choice-actions">
      <label className="check-control">
        <input
          type={source.mode === "single" ? "radio" : "checkbox"}
          name={`${props.entryId}-${source.handle}`}
          checked={checked}
          disabled={
            source.resolution === "random" &&
            sourceRoll?.result !== choice.handle
          }
          onChange={setGroup}
        />
        <span>
          {source.resolution === "random"
            ? `${label(choice.name)} result`
            : `${source.mode === "single" ? "Choose" : "Take"} ${label(choice.name)}`}
        </span>
      </label>
      {sourceRoll?.result === choice.handle && <em>Rolled</em>}
    </div>
  );
}

function sourceUsesChoiceControl(choice: JumpChoice, source: ChoiceSource) {
  return (
    source.mode === "multi" &&
    source.resolution === "manual" &&
    choice.selection !== "toggle"
  );
}

function DefaultChoice({
  choice,
  props,
  source,
  sourceRoll,
}: {
  choice: JumpChoice;
  props: Props;
  source?: ChoiceSource;
  sourceRoll?: { result: string | number; sequence: number };
}) {
  return (
    <article className="default-choice-card">
      <div className="default-choice-heading">
        <strong>{label(choice.name, choice.handle)}</strong>
        <CostBadges
          choice={choice}
          evaluation={props.evaluation}
          source={source}
        />
      </div>
      <ChoiceTags choice={choice} props={props} />
      {source && !sourceUsesChoiceControl(choice, source) ? (
        <SourceOptionControl
          choice={choice}
          source={source}
          sourceRoll={sourceRoll}
          props={props}
        />
      ) : (
        <ChoiceControl choice={choice} props={props} />
      )}
    </article>
  );
}

function sourceContext(
  source: ChoiceSource,
  sectionHandle: string,
  props: Props,
) {
  const choices = props.packageItem.choices.filter(
    (choice) => source.group && choice.groups.includes(source.group),
  );
  const key = `${sectionHandle}:${source.handle}`;
  const roll = props.state.sourceRolls[key];
  return { choices, key, roll };
}

function SourceRollControls({
  source,
  sectionHandle,
  props,
}: {
  source: ChoiceSource;
  sectionHandle: string;
  props: Props;
}) {
  const { choices, key, roll } = sourceContext(source, sectionHandle, props);
  const anySelected = choices.some(
    (choice) => props.evaluation.choices[choice.handle]?.active,
  );
  const doRoll = () => {
    if (!choices.length) return;
    if (roll && !props.preferences.allowRerolls) return;
    const result =
      choices[
        (props.randomIndex ?? platformRandomIndex)(
          choices.length,
          roll?.sequence ?? 0,
        )
      ].handle;
    props.dispatch({
      type: "record-source-roll",
      entryId: props.entryId,
      actorId: props.actorId,
      sourceKey: key,
      result,
    });
  };
  return (
    <footer className="source-roll-controls">
      {source.resolution !== "manual" && (
        <button
          type="button"
          className="roll-control"
          disabled={Boolean(roll) && !props.preferences.allowRerolls}
          onClick={doRoll}
        >
          Roll
        </button>
      )}
      <button
        type="button"
        className="secondary-control"
        disabled={!anySelected}
        onClick={() =>
          choices.forEach((choice) =>
            props.dispatch({
              type: "set-choice",
              entryId: props.entryId,
              actorId: props.actorId,
              choiceHandle: choice.handle,
              value: false,
            }),
          )
        }
      >
        Clear
      </button>
      {source.resolution !== "manual" && (
        <output data-group-status>
          {roll
            ? `${label(choices.find((choice) => choice.handle === roll.result)?.name)} · Rolled`
            : "No result"}
        </output>
      )}
      {source.mode === "multi" && (
        <span className="spent-total">
          Spent{" "}
          <output>
            {choices.reduce(
              (total, choice) =>
                total +
                (props.evaluation.choices[choice.handle]?.costs.reduce(
                  (sum, cost) => sum + Math.max(0, cost.resolvedAmount),
                  0,
                ) ?? 0),
              0,
            )}{" "}
            CP
          </output>
        </span>
      )}
    </footer>
  );
}

function SourceChoices({
  source,
  sectionHandle,
  using,
  showControls = true,
  props,
}: {
  source: ChoiceSource;
  sectionHandle: string;
  using?: string;
  showControls?: boolean;
  props: Props;
}) {
  const { choices, roll } = sourceContext(source, sectionHandle, props);
  const hasAuthoredChoiceLayout = Boolean(
    using ??
    props.packageItem.defaultChoiceLayout ??
    choices.find((choice) => choice.layout)?.layout,
  );
  return (
    <article
      className={`selection-specimen${hasAuthoredChoiceLayout ? " has-authored-choice-layout" : ""}`}
      data-group-mode={source.mode}
    >
      <div className="group-options">
        {choices.map((choice) => (
          <ChoiceWithLayout
            key={choice.handle}
            choice={choice}
            props={props}
            layoutHandle={using}
            source={source}
            sourceRoll={roll}
          />
        ))}
      </div>
      {showControls && (
        <SourceRollControls
          source={source}
          sectionHandle={sectionHandle}
          props={props}
        />
      )}
    </article>
  );
}

function containsSlot(node: LayoutNode, target: string): boolean {
  return (
    (node.kind === "slot" && node.target === target) ||
    node.children.some((child) => containsSlot(child, target))
  );
}

function Layout({
  node,
  sectionHandle,
  choice,
  source,
  sourceRoll,
  props,
}: {
  node: LayoutNode;
  sectionHandle: string;
  choice?: JumpChoice;
  source?: ChoiceSource;
  sourceRoll?: { result: string | number; sequence: number };
  props: Props;
}): ReactNode {
  const spacing: Record<string, string> = {
    none: "0",
    xs: ".25rem",
    sm: ".5rem",
    md: ".75rem",
    lg: "1rem",
    xl: "1.5rem",
    "2xl": "2rem",
  };
  const sizes: Record<string, string> = {
    xs: "2rem",
    sm: "3rem",
    md: "5rem",
    lg: "8rem",
    xl: "12rem",
    "2xl": "16rem",
  };
  const textSizes: Record<string, string> = {
    xs: ".58rem",
    sm: ".66rem",
    md: ".75rem",
    lg: ".9rem",
    xl: "1.1rem",
    "2xl": "1.35rem",
  };
  const builtInColors: Record<string, string> = {
    black: "#111111",
    white: "#ffffff",
    gray: "#7d7b75",
    red: "#b84a4f",
    orange: "#bd7333",
    yellow: "#c8aa4b",
    green: "#568e63",
    blue: "#587ea8",
    purple: "#8065a8",
    brown: "#85694e",
    pink: "#aa6687",
  };
  const color = (token: string | undefined) => {
    if (!token) return undefined;
    const candidate = props.packageItem.themes[token] ?? token;
    return /^#[0-9a-f]{6}$/i.test(candidate)
      ? candidate
      : builtInColors[candidate];
  };
  const style: CSSProperties = {
    gap: node.presentation.gap
      ? (spacing[node.presentation.gap] ?? node.presentation.gap)
      : undefined,
    padding: node.presentation.padding
      ? (spacing[node.presentation.padding] ?? node.presentation.padding)
      : undefined,
    alignItems: node.presentation.align as CSSProperties["alignItems"],
    justifyContent:
      node.presentation.justify === "between"
        ? "space-between"
        : (node.presentation.justify as CSSProperties["justifyContent"]),
    textAlign: node.presentation.textAlign as CSSProperties["textAlign"],
    backgroundColor: color(node.presentation.background),
    color: color(node.presentation.textColor),
    fontSize: node.presentation.textSize
      ? textSizes[node.presentation.textSize]
      : undefined,
    gridTemplateColumns: node.presentation.columns
      ? `repeat(${node.presentation.columns}, minmax(0, 1fr))`
      : undefined,
  };
  if (node.kind === "slot" && choice) {
    if (node.target === "name") return <strong>{label(choice.name)}</strong>;
    if (node.target === "cost")
      return (
        <CostBadges
          choice={choice}
          evaluation={props.evaluation}
          source={source}
        />
      );
    if (node.target === "tags")
      return <ChoiceTags choice={choice} props={props} />;
    if (node.target === "control")
      return source && !sourceUsesChoiceControl(choice, source) ? (
        <SourceOptionControl
          choice={choice}
          source={source}
          sourceRoll={sourceRoll}
          props={props}
        />
      ) : (
        <ChoiceControl choice={choice} props={props} part="control" />
      );
    if (node.target === "roll")
      return source ? null : (
        <div className="authored-choice-roll-slot">
          <ChoiceControl choice={choice} props={props} part="roll" />
        </div>
      );
  }
  if (node.kind === "slot" && node.target === "name") {
    const section = props.packageItem.sections.find(
      (item) => item.handle === sectionHandle,
    );
    return section ? (
      <h5 className="jump-section-layout-name">
        {label(section.name, section.handle)}
      </h5>
    ) : null;
  }
  if (node.kind === "slot" && node.target === "roll") {
    const section = props.packageItem.sections.find(
      (item) => item.handle === sectionHandle,
    );
    return section?.sources.length === 1 ? (
      <SourceRollControls
        source={section.sources[0]}
        sectionHandle={sectionHandle}
        props={props}
      />
    ) : null;
  }
  if (node.kind === "text") {
    const owner =
      choice?.text ??
      props.packageItem.sections.find(
        (section) => section.handle === sectionHandle,
      )?.text ??
      [];
    const content = owner.find((item) => item.handle === node.target)?.content;
    return content ? (
      <RichText source={resolved(content, props)} style={style} />
    ) : null;
  }
  if (node.kind === "rule") return <hr />;
  if (node.kind === "input" && choice)
    return <InputControls choice={choice} props={props} target={node.target} />;
  if (node.kind === "image") {
    const owner =
      choice?.images ??
      props.packageItem.sections.find(
        (section) => section.handle === sectionHandle,
      )?.images ??
      [];
    const item = owner.find((image) => image.handle === node.target);
    const shorthand = node.presentation.size
      ? sizes[node.presentation.size]
      : undefined;
    if (!item) return null;
    const source = resolveJumpImageSource(item.src, props.resolveAsset);
    return source ? (
      <img
        src={source}
        alt={label(item.alt)}
        style={{
          width: shorthand ?? sizes[node.presentation.width ?? ""],
          height: shorthand ?? sizes[node.presentation.height ?? ""],
          objectFit: node.presentation.fit as CSSProperties["objectFit"],
        }}
      />
    ) : null;
  }
  if (node.kind === "choice") {
    const target = props.packageItem.sections
      .find((section) => section.handle === sectionHandle)
      ?.directChoices.find((item) => item.handle === node.target)?.target;
    const direct = props.packageItem.choices.find(
      (item) => item.handle === target,
    );
    return direct ? <ChoiceWithLayout choice={direct} props={props} /> : null;
  }
  if (node.kind === "expand") {
    const section = props.packageItem.sections.find(
      (item) => item.handle === sectionHandle,
    );
    const source = section?.sources.find((item) => item.handle === node.source);
    const sectionLayout = props.packageItem.layouts.find(
      (item) =>
        item.kind === "section-layout" &&
        item.handle ===
          (section?.layout ?? props.packageItem.defaultSectionLayout),
    );
    return source ? (
      <SourceChoices
        source={source}
        sectionHandle={sectionHandle}
        using={node.using}
        showControls={
          !(
            section?.sources.length === 1 &&
            sectionLayout &&
            containsSlot(sectionLayout.root, "roll")
          )
        }
        props={props}
      />
    ) : null;
  }
  const Tag =
    node.kind === "inline" || node.kind === "wrap"
      ? "div"
      : node.kind === "grid"
        ? "div"
        : "div";
  const children = node.children.map((child) =>
    Layout({ node: child, sectionHandle, choice, source, sourceRoll, props }),
  );
  if (!children.some((child) => child !== null && child !== undefined))
    return null;
  return (
    <Tag
      className={`jump-layout-${node.kind}`}
      style={style}
      data-layout-bound={`${node.kind}:${node.handle ?? node.target ?? "anonymous"}`}
      data-layout-kind={node.kind}
    >
      {children.map((child, index) => (
        <Fragment
          key={`${node.children[index].kind}-${node.children[index].handle ?? node.children[index].target ?? index}`}
        >
          {child}
        </Fragment>
      ))}
    </Tag>
  );
}

function ChoiceWithLayout({
  choice,
  props,
  layoutHandle,
  source,
  sourceRoll,
}: {
  choice: JumpChoice;
  props: Props;
  layoutHandle?: string;
  source?: ChoiceSource;
  sourceRoll?: { result: string | number; sequence: number };
}) {
  const layout = props.packageItem.layouts.find(
    (item) =>
      item.kind === "choice-layout" &&
      item.handle ===
        (layoutHandle ??
          choice.layout ??
          props.packageItem.defaultChoiceLayout),
  );
  if (!layout)
    return (
      <DefaultChoice
        choice={choice}
        props={props}
        source={source}
        sourceRoll={sourceRoll}
      />
    );
  return (
    <article className="default-choice-card authored-choice-layout">
      <Layout
        node={layout.root}
        sectionHandle=""
        choice={choice}
        source={source}
        sourceRoll={sourceRoll}
        props={props}
      />
    </article>
  );
}

function JumpSectionView({
  section,
  props,
}: {
  section: CanonicalJumpPackage["sections"][number];
  props: Props;
}) {
  const layout: JumpLayout | undefined = props.packageItem.layouts.find(
    (item) =>
      item.kind === "section-layout" &&
      item.handle ===
        (section.layout ?? props.packageItem.defaultSectionLayout),
  );
  return (
    <section className="rendered-jump-section">
      {layout ? (
        <Layout
          node={layout.root}
          sectionHandle={section.handle}
          props={props}
        />
      ) : (
        <div className="jump-default-section">
          <h5 className="jump-section-layout-name">
            {label(section.name, section.handle)}
          </h5>
          {section.members.map((member) => {
            if (member.kind === "source") {
              const source = section.sources.find(
                (item) => item.handle === member.handle,
              );
              return source ? (
                <SourceChoices
                  key={`source:${member.handle}`}
                  source={source}
                  sectionHandle={section.handle}
                  props={props}
                />
              ) : null;
            }
            const direct = section.directChoices.find(
              (item) => item.handle === member.handle,
            );
            const choice = props.packageItem.choices.find(
              (item) => item.handle === direct?.target,
            );
            return choice ? (
              <ChoiceWithLayout
                key={`choice:${member.handle}`}
                choice={choice}
                props={props}
              />
            ) : null;
          })}
        </div>
      )}
    </section>
  );
}

function TraitLayoutNode({
  node,
  trait,
  props,
}: {
  node: LayoutNode;
  trait: EvaluatedGrantRecord;
  props: Props;
}): ReactNode {
  if (node.kind === "slot" && node.target === "name")
    return <strong>{trait.name}</strong>;
  if (node.kind === "text") {
    const content = trait.text?.find(
      (item) => item.handle === node.target,
    )?.content;
    return content ? <RichText source={resolved(content, props)} /> : null;
  }
  if (node.kind === "image") {
    const item = trait.images?.find((image) => image.handle === node.target);
    if (!item) return null;
    const source = resolveJumpImageSource(item.src, props.resolveAsset);
    return source ? <img src={source} alt={resolved(item.alt, props)} /> : null;
  }
  if (node.kind === "rule") return <hr />;
  if (!["stack", "inline", "wrap", "grid"].includes(node.kind)) return null;
  return (
    <div className={`jump-layout-${node.kind}`}>
      {node.children.map((child, index) => (
        <TraitLayoutNode
          key={`${child.kind}-${child.target ?? index}`}
          node={child}
          trait={trait}
          props={props}
        />
      ))}
    </div>
  );
}

function TraitView({
  trait,
  props,
}: {
  trait: EvaluatedGrantRecord;
  props: Props;
}) {
  const layout = props.packageItem.layouts.find(
    (item) =>
      item.kind === "trait-layout" &&
      item.handle === (trait.layout ?? props.packageItem.defaultTraitLayout),
  );
  return layout ? (
    <article>
      <TraitLayoutNode node={layout.root} trait={trait} props={props} />
    </article>
  ) : (
    <article>
      <strong>{trait.name}</strong>
      <span>{trait.description}</span>
    </article>
  );
}

/** Canonical section rendering scope shared by the Tracker and Editor preview. */
export function JumpSectionRendererScope({
  section,
  rendererProps,
}: {
  section: CanonicalJumpPackage["sections"][number];
  rendererProps: JumpRendererProps;
}) {
  return <JumpSectionView section={section} props={rendererProps} />;
}

/** Canonical choice rendering scope shared by the Tracker and Editor preview. */
export function JumpChoiceRendererScope({
  choice,
  rendererProps,
}: {
  choice: JumpChoice;
  rendererProps: JumpRendererProps;
}) {
  return <ChoiceWithLayout choice={choice} props={rendererProps} />;
}

export function JumpRenderer(props: Props) {
  return (
    <div className="chain-view-panel tracker-renderer-placeholder">
      {props.preferences.showAdditionalJumpInformation && (
        <div className="shared-renderer-label">
          <small>Format 1 evaluated package</small>
        </div>
      )}
      <article className="shared-jump-renderer format-one-jump-renderer">
        <header>
          <div>
            <p>{props.gauntletActive ? "Gauntlet" : "Current Jump"}</p>
            <h4>{label(props.packageItem.name)}</h4>
            <span>{props.packageItem.description}</span>
          </div>
          <div className="tracker-budget">
            <span>Available</span>
            <output
              className={
                props.evaluation.balance < 0 ? "is-negative" : undefined
              }
            >
              {props.evaluation.balance}{" "}
              {props.evaluation.resources.jump_points?.abbreviation ?? "CP"}
            </output>
          </div>
        </header>
        {props.packageItem.sections.map((section) => (
          <JumpSectionView
            key={section.handle}
            section={section}
            props={props}
          />
        ))}
        {props.evaluation.traits.length > 0 && (
          <section className="rendered-jump-section">
            <header>
              <p>Traits</p>
              <h5>Current Jump traits</h5>
            </header>
            <div className="jump-trait-list">
              {props.evaluation.traits.map((trait) => (
                <TraitView key={trait.id} trait={trait} props={props} />
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
