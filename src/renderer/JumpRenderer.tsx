import {
  Fragment,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  CanonicalJumpPackage,
  ChoiceSource,
  ImageBlock,
  ImageEffects,
  JumpChoice,
  JumpLayout,
  LayoutNode,
  Renderable,
  RichBlock,
  RichInline,
} from "../markup";
import {
  layoutNodeSupportsTextStyling,
  layoutNodeUsesControlAlignment,
  parseRichText,
  resolveCostAmount,
} from "../markup";
import {
  choiceControlRenderContext,
  tagDefinitionForDisplay,
  type EvaluatedActorJump,
  type EvaluatedGrantRecord,
} from "../domain";
import { platformRandomIndex } from "../domain";
import { CanonicalTagDefinitionBadge } from "../ui/TagBadge";
import { NumberStepper } from "../ui/NumberStepper";
import { renderRenderable, renderRichTextRenderable } from "./presentation";
import { resolveJumpImageSource, type JumpAssetResolver } from "./jumpImages";
import { sourceOptionGroupName } from "./sourceOptionGroup";
import { translate } from "../localization";
import {
  layoutBackgroundImageStyle,
  layoutContainerPresentationStyle,
  layoutImageBoundaryStyle,
  layoutImageStyle,
  layoutInlineChildAreaStyle,
  layoutLeafPresentationStyle,
  layoutRichTextListStyle,
  layoutRuleStyle,
  layoutTiledImageStyle,
} from "./layoutPresentation";
import { jumpAppearanceStyle } from "./jumpAppearance";
import { choiceRollDomain } from "./choiceRoll";
import type { JumpRendererProps } from "./contracts";

const label = (value: Renderable | undefined, fallback = "") =>
  value?.base ?? value?.variants[0]?.value ?? fallback;

const displayHandle = (handle: string) =>
  handle
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
    .join(" ");

function imageEffectStyle(effects: ImageEffects | undefined): CSSProperties {
  if (!effects) return {};
  const fadeIntensity = Math.min(100, Math.max(1, effects.fadeIntensity));
  const fadeInset = 1 + fadeIntensity * 0.29;
  const blurDeviation = fadeInset / 6;
  const rectangleInset = fadeInset / 2;
  const fadeMaskSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><filter id="soft-edge" x="-50" y="-50" width="200" height="200" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${blurDeviation.toFixed(3)}"/></filter></defs><rect x="${rectangleInset.toFixed(3)}" y="${rectangleInset.toFixed(3)}" width="${(100 - rectangleInset * 2).toFixed(3)}" height="${(100 - rectangleInset * 2).toFixed(3)}" fill="white" filter="url(#soft-edge)"/></svg>`;
  const fadeMask = effects.fadeEdges
    ? `url("data:image/svg+xml,${encodeURIComponent(fadeMaskSvg)}")`
    : undefined;
  return {
    maskImage: fadeMask,
    maskMode: effects.fadeEdges ? "alpha" : undefined,
    maskPosition: effects.fadeEdges ? "center" : undefined,
    maskRepeat: effects.fadeEdges ? "no-repeat" : undefined,
    maskSize: effects.fadeEdges ? "100% 100%" : undefined,
    WebkitMaskImage: fadeMask,
    WebkitMaskPosition: effects.fadeEdges ? "center" : undefined,
    WebkitMaskRepeat: effects.fadeEdges ? "no-repeat" : undefined,
    WebkitMaskSize: effects.fadeEdges ? "100% 100%" : undefined,
  };
}

function useImageCornerRadius(
  enabled: boolean,
  intensity: number,
  tiled: boolean,
) {
  const elementRef = useRef<HTMLElement | null>(null);
  const [cornerRadius, setCornerRadius] = useState<string>();
  const setElementRef = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
  }, []);
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!enabled || !element) {
      setCornerRadius(undefined);
      return;
    }
    const boundedIntensity = Math.min(100, Math.max(1, intensity));
    const update = () => {
      const bounds = element.getBoundingClientRect();
      setCornerRadius(
        `${((Math.min(bounds.width, bounds.height) * boundedIntensity) / 200).toFixed(3)}px`,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, intensity, tiled]);
  return { setElementRef, cornerRadius };
}

function imageEffectAttributes(effects: ImageEffects | undefined) {
  return {
    "data-rounded-corners": effects?.roundedCorners ? "true" : undefined,
    "data-rounded-intensity": effects?.roundedCorners
      ? effects.roundedIntensity
      : undefined,
    "data-fade-edges": effects?.fadeEdges ? "true" : undefined,
    "data-fade-intensity": effects?.fadeEdges
      ? effects.fadeIntensity
      : undefined,
  };
}

export function RenderedJumpImage({
  source,
  alternativeText,
  style,
  effects,
  tiled = false,
  showAltTextOnHover = true,
}: {
  source: string;
  alternativeText: string;
  style?: CSSProperties;
  effects?: ImageEffects;
  tiled?: boolean;
  showAltTextOnHover?: boolean;
}) {
  const { setElementRef, cornerRadius } = useImageCornerRadius(
    effects?.roundedCorners ?? false,
    effects?.roundedIntensity ?? 25,
    tiled,
  );
  const effectStyle = {
    ...imageEffectStyle(effects),
    borderRadius: cornerRadius,
  };
  const effectAttributes = imageEffectAttributes(effects);
  return (
    <>
      {tiled ? (
        <span
          ref={setElementRef}
          className="jump-tiled-image"
          style={{ ...layoutTiledImageStyle(source), ...effectStyle }}
          {...effectAttributes}
        >
          <img
            src={source}
            alt={alternativeText}
            style={{ ...style, opacity: 0 }}
          />
        </span>
      ) : (
        <img
          ref={setElementRef}
          src={source}
          alt={alternativeText}
          style={{ ...style, ...effectStyle }}
          {...effectAttributes}
        />
      )}
      {alternativeText && showAltTextOnHover && (
        <span className="jump-image-alt-tooltip" role="tooltip">
          {alternativeText}
        </span>
      )}
    </>
  );
}

function RichInlines({ values }: { values: readonly RichInline[] }) {
  return values.map((value, index) => {
    let content: ReactNode = value.text;
    if (value.bold) content = <strong>{content}</strong>;
    if (value.italic) content = <em>{content}</em>;
    if (value.strike) content = <s>{content}</s>;
    if (value.underline) content = <u>{content}</u>;
    return (
      <Fragment key={index}>
        <span>{content}</span>
        {value.breakAfter && <br />}
      </Fragment>
    );
  });
}

function RichText({
  source,
  blocks,
  style,
  layoutNode,
}: {
  source?: string;
  blocks?: readonly RichBlock[];
  style?: CSSProperties;
  layoutNode?: LayoutNode;
}) {
  return (blocks ?? parseRichText(source ?? "")).map((block, index) => {
    if (block.kind === "paragraph")
      return (
        <p className="jump-layout-text" key={index} style={style}>
          <RichInlines values={block.content} />
        </p>
      );
    if (block.kind === "list")
      return (
        <ul
          className="jump-layout-text"
          data-list-marker={layoutNode?.presentation.listMarker}
          key={index}
          style={{
            ...style,
            ...(layoutNode ? layoutRichTextListStyle(layoutNode) : {}),
          }}
        >
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

type Props = JumpRendererProps;

function ChoiceTags({ choice, props }: { choice: JumpChoice; props: Props }) {
  if (!choice.tags.length) return null;
  return (
    <div className="default-choice-tags">
      {choice.tags.map((tagId) => {
        const tag = tagDefinitionForDisplay(props.tags, tagId);
        return <CanonicalTagDefinitionBadge key={tagId} tag={tag!} />;
      })}
    </div>
  );
}

const rendererContext = (
  props: Props,
  contextual: Readonly<Record<string, string | number | boolean>> = {},
) => ({
  ...Object.fromEntries(
    Object.entries(props.evaluation.properties).map(([handle, property]) => [
      handle,
      property?.value,
    ]),
  ),
  gauntlet: props.gauntletActive,
  ...contextual,
});
const resolved = (
  value: Renderable | undefined,
  props: Props,
  fallback = "",
) => (value ? renderRenderable(value, rendererContext(props)) : fallback);
function choiceMeasureContext(choice: JumpChoice, props: Props) {
  const value = props.evaluation.choices[choice.handle]?.value;
  if (typeof value !== "number") return {};
  return Object.fromEntries(
    choice.grants
      .filter((grant) => ["perk", "item", "trait"].includes(grant.kind))
      .map((grant) => [grant.measure === "quantity" ? "count" : "rank", value]),
  );
}

function choiceContentContext(choice: JumpChoice, props: Props) {
  return {
    ...choiceControlRenderContext(
      choice,
      props.state,
      props.evaluation.choices[choice.handle]?.value,
    ),
    ...choiceMeasureContext(choice, props),
  };
}

const resolvedChoice = (
  value: Renderable,
  choice: JumpChoice,
  props: Props,
  fallback = "",
) =>
  renderRenderable(
    value,
    rendererContext(props, choiceContentContext(choice, props)),
  ) || fallback;

const resolvedChoiceRichText = (
  value: Renderable,
  choice: JumpChoice,
  props: Props,
) =>
  renderRichTextRenderable(
    value,
    rendererContext(props, choiceContentContext(choice, props)),
  );

function CostBadges({
  choice,
  evaluation,
  packageItem,
  source,
}: {
  choice: JumpChoice;
  evaluation: EvaluatedActorJump;
  packageItem: CanonicalJumpPackage;
  source?: ChoiceSource;
}) {
  const view = evaluation.choices[choice.handle];
  const resolution = source?.resolution ?? choice.resolution;
  const randomOnly = resolution === "random";
  const rolled = source
    ? view?.rolledBySource
    : view?.rolledResult !== undefined;
  const discountLabel = (cost: NonNullable<typeof view>["costs"][number]) =>
    cost.discounts?.length
      ? translate("ui.jumpRenderer.text.discountedBy", {
          choices: cost.discounts
            .map((discount) => {
              const sourceChoice = packageItem.choices.find(
                (candidate) => candidate.handle === discount.sourceChoiceHandle,
              );
              return label(sourceChoice?.name, discount.sourceChoiceHandle);
            })
            .join(", "),
        })
      : undefined;
  const discountedCostLabel = (
    cost: NonNullable<typeof view>["costs"][number],
    suffix: string,
  ) => {
    const provenance = discountLabel(cost);
    return provenance && cost.discountBaseAmount !== cost.resolvedAmount
      ? translate("ui.jumpRenderer.aria.discountedCost", {
          base: Math.abs(cost.discountBaseAmount ?? cost.originalAmount),
          resolved: Math.abs(cost.resolvedAmount),
          resource: suffix,
          provenance,
        })
      : undefined;
  };
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
        <b className="cost-badge is-benefit">
          {translate("ui.jumpRenderer.text.free")}
        </b>
      </div>
    );
  if (randomOnly && !rolled)
    return (
      <div className="cost-badge-row">
        <b className="cost-badge is-roll-pending">
          {choice.costs.some((cost) => cost.mode === "each") ? (
            <>
              <strong>{translate("ui.jumpRenderer.text.rollForFree")}</strong>
              <span>{translate("ui.jumpRenderer.text.rankCountPending")}</span>
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
          const award = cost.originalAmount < 0;
          return (
            <b
              key={cost.resource}
              className={`cost-badge is-stacked${award ? " is-award" : ""}`}
            >
              <strong>
                {award ? "+" : ""}
                {Math.abs(cost.originalAmount)} {suffix}
              </strong>
              <span>
                {translate("ui.jumpRenderer.text.rolled")}
                {String(view.rolledResult)}{" "}
                {translate("ui.jumpRenderer.text.isFree")}
              </span>
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
              {allowance} {translate("ui.jumpRenderer.text.rank")}
              {allowance === 1 ? "" : "s"}{" "}
              {translate("ui.jumpRenderer.text.freeRolled")}
            </span>
            <strong>
              {paidRanks} {translate("ui.jumpRenderer.text.paid")}
              {unit} {translate("ui.jumpRenderer.text.cp")}
              {paidRanks * unit} {translate("ui.jumpRenderer.text.cpTotal")}
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
        if (cost.mode === "each") {
          const authored = choice.costs.find(
            (item) => item.resource === cost.resource,
          );
          const award = authored
            ? resolveCostAmount(authored.amount) < 0
            : cost.originalAmount < 0 || cost.resolvedAmount < 0;
          const each = authored
            ? Math.abs(resolveCostAmount(authored.amount))
            : Math.abs(cost.originalAmount);
          return (
            <b
              key={cost.resource}
              className={`cost-badge is-ranked${award ? " is-award" : ""}`}
              title={discountLabel(cost)}
              aria-label={discountedCostLabel(cost, suffix)}
            >
              <span>
                {award ? "+" : ""}
                {each} {suffix} {translate("ui.jumpRenderer.text.each")}
              </span>
              <strong>
                {cost.rankCount === undefined
                  ? "Awaiting ranks"
                  : `${cost.rankCount} rank${cost.rankCount === 1 ? "" : "s"} · ${award ? "+" : ""}${Math.abs(cost.resolvedAmount)} ${suffix} total`}
              </strong>
            </b>
          );
        }
        const award = cost.originalAmount < 0 || cost.resolvedAmount < 0;
        return (
          <b
            key={cost.resource}
            className={`cost-badge${award ? " is-award" : ""}`}
            title={discountLabel(cost)}
            aria-label={discountedCostLabel(cost, suffix)}
          >
            {cost.discounts?.length &&
            cost.discountBaseAmount !== cost.resolvedAmount ? (
              <>
                <span className="cost-badge-original">
                  {Math.abs(cost.discountBaseAmount ?? cost.originalAmount)}{" "}
                  {suffix}
                </span>
                <strong>
                  {award ? "+" : ""}
                  {Math.abs(cost.resolvedAmount)} {suffix}
                </strong>
              </>
            ) : (
              <>
                {award ? "+" : ""}
                {Math.abs(cost.resolvedAmount || cost.originalAmount)} {suffix}
              </>
            )}
          </b>
        );
      })}
    </div>
  );
}

function CompanionChoiceControl({
  choice,
  value,
  props,
  disabled,
  onChange,
}: {
  choice: JumpChoice;
  value: readonly string[];
  props: Props;
  disabled: boolean;
  onChange: (value: readonly string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const removeButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const maximum = choice.max ?? 1;
  const minimum = choice.min ?? 1;
  const selected = value.map(
    (id) =>
      props.companions.find((companion) => companion.id === id) ?? {
        id,
        name: id,
      },
  );
  const available = props.companions.filter(
    (companion) =>
      !value.includes(companion.id) &&
      companion.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const placeholder = choice.placeholder
    ? resolved({ base: choice.placeholder, variants: [] }, props)
    : translate("ui.jumpRenderer.placeholder.chooseCompanions");
  return (
    <div
      className="companion-choice-control"
      ref={root}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      {selected.length > 0 && (
        <div
          className="companion-choice-pills"
          aria-label={translate("ui.jumpRenderer.aria.selectedCompanions")}
        >
          {selected.map((companion, index) => (
            <span className="companion-choice-pill" key={companion.id}>
              <span>{companion.name}</span>
              <button
                ref={(control) => {
                  removeButtons.current[index] = control;
                }}
                type="button"
                disabled={disabled}
                aria-label={translate(
                  "ui.jumpRenderer.aria.removeSelectedCompanion",
                  { companion: companion.name },
                )}
                onClick={() => {
                  onChange(value.filter((id) => id !== companion.id));
                  requestAnimationFrame(() => {
                    (
                      removeButtons.current[index] ??
                      removeButtons.current[index - 1] ??
                      input.current
                    )?.focus();
                  });
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label={resolvedChoice(choice.name, choice, props, choice.handle)}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-activedescendant={
          open && available[activeIndex]
            ? `${listboxId}-${activeIndex}`
            : undefined
        }
        disabled={disabled || value.length >= maximum}
        placeholder={placeholder}
        value={query}
        onFocus={() => {
          setActiveIndex(0);
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          } else if (event.key === "ArrowDown" && available.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => (current + 1) % available.length);
          } else if (event.key === "ArrowUp" && available.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(
              (current) => (current - 1 + available.length) % available.length,
            );
          } else if (event.key === "Home" && available.length) {
            event.preventDefault();
            setActiveIndex(0);
          } else if (event.key === "End" && available.length) {
            event.preventDefault();
            setActiveIndex(available.length - 1);
          } else if (event.key === "Enter" && available[activeIndex]) {
            event.preventDefault();
            onChange([...value, available[activeIndex].id]);
            setQuery("");
            setActiveIndex(0);
          }
        }}
      />
      {open && value.length < maximum && (
        <div
          className="companion-choice-options"
          id={listboxId}
          role="listbox"
          aria-label={translate("ui.jumpRenderer.aria.availableCompanions")}
        >
          {available.length ? (
            available.map((companion, index) => (
              <button
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                key={companion.id}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => {
                  onChange([...value, companion.id]);
                  setQuery("");
                  setActiveIndex(0);
                  requestAnimationFrame(() => input.current?.focus());
                }}
              >
                {companion.name}
              </button>
            ))
          ) : (
            <p>
              {translate(
                props.companions.length
                  ? "ui.jumpRenderer.text.noCompanionsMatch"
                  : "ui.jumpRenderer.text.noCompanionsAvailable",
              )}
            </p>
          )}
        </div>
      )}
      <small className="companion-choice-status" role="status">
        {translate("ui.jumpRenderer.text.companionSelectionStatus", {
          selected: value.length,
          minimum,
          maximum,
        })}
      </small>
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
  const set = (next: boolean | string | number | readonly string[] | null) =>
    props.actions.setChoice(choice.handle, next);
  const rollDomain = choiceRollDomain(choice);
  const roll = () => {
    if (!rollDomain) return;
    const prior = props.state.choiceRolls[choice.handle]?.sequence ?? 0;
    const index = (props.randomIndex ?? platformRandomIndex)(
      rollDomain.size,
      prior,
    );
    const result = rollDomain.valueAt(index);
    if (result === undefined) return;
    props.actions.recordChoiceRoll(choice.handle, result);
  };
  const rolled = props.state.choiceRolls[choice.handle];
  const randomOnly = choice.resolution === "random";
  const showManual = !randomOnly;
  const canRoll = choice.resolution !== "manual" && Boolean(rollDomain);
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
          <span>
            {translate("ui.jumpRenderer.text.take")}
            {resolvedChoice(choice.name, choice, props, choice.handle)}
          </span>
        </label>
      )}
      {showControl && showManual && choice.selection === "text" && (
        <label>
          <span className="sr-only">
            {resolvedChoice(choice.name, choice, props)}
          </span>
          <input
            type="text"
            placeholder={
              choice.placeholder
                ? resolved({ base: choice.placeholder, variants: [] }, props)
                : translate("ui.jumpRenderer.placeholder.unset")
            }
            disabled={formDependencyUnavailable}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => set(event.target.value || null)}
          />
        </label>
      )}
      {showControl && showManual && choice.selection === "integer" && (
        <>
          <NumberStepper
            label={resolvedChoice(choice.name, choice, props)}
            min={choice.min}
            max={choice.max}
            value={typeof value === "number" ? value : null}
            disabled={formDependencyUnavailable}
            placeholder={
              choice.placeholder
                ? resolved({ base: choice.placeholder, variants: [] }, props)
                : translate("ui.jumpRenderer.placeholder.unset")
            }
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
          <span className="sr-only">
            {resolvedChoice(choice.name, choice, props)}
          </span>
          <select
            value={typeof value === "string" ? value : ""}
            disabled={formDependencyUnavailable}
            onChange={(event) => set(event.target.value || null)}
          >
            <option value="">
              {choice.placeholder
                ? resolved({ base: choice.placeholder, variants: [] }, props)
                : translate("ui.jumpRenderer.text.unset")}
            </option>
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
      {showControl && choice.selection === "companions" && (
        <CompanionChoiceControl
          choice={choice}
          value={Array.isArray(value) ? value : []}
          props={props}
          disabled={formDependencyUnavailable}
          onChange={set}
        />
      )}
      {showControl && randomOnly && (
        <output data-roll-output>
          {rolled
            ? String(rolled.result)
            : choice.placeholder
              ? resolved({ base: choice.placeholder, variants: [] }, props)
              : translate("ui.jumpRenderer.text.notRolled")}
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
            ? translate("ui.jumpRenderer.text.claim")
            : translate("ui.jumpRenderer.text.roll")}
        </button>
      )}
      {showControl && choice.selection !== "toggle" && (
        <button
          type="button"
          className="secondary-control"
          disabled={storedValue === null}
          onClick={() => set(null)}
        >
          {translate("ui.jumpRenderer.text.clear")}
        </button>
      )}
      {showControl && missingForm && (
        <em className="choice-provenance">
          {translate("ui.jumpRenderer.text.requires")}
          {label(missingFormName, missingForm)}
        </em>
      )}
      {showRoll && rolled && choice.resolution === "either" && (
        <em className="choice-provenance">
          {translate("ui.jumpRenderer.text.rolled")}
          {rolled.result}
        </em>
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
        const inputLabel = displayHandle(input.handle);
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
        const update = (next: string | number | null) =>
          props.actions.setInput(choice.handle, input.handle, next);
        return (
          <label key={input.handle}>
            <strong>{inputLabel}</strong>
            {input.selection === "text" && (
              <input
                type="text"
                aria-label={inputLabel}
                placeholder={
                  input.placeholder
                    ? resolved({ base: input.placeholder, variants: [] }, props)
                    : translate("ui.jumpRenderer.placeholder.unset")
                }
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
                placeholder={
                  input.placeholder
                    ? resolved({ base: input.placeholder, variants: [] }, props)
                    : translate("ui.jumpRenderer.placeholder.unset")
                }
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
                <option value="">
                  {input.placeholder
                    ? resolved({ base: input.placeholder, variants: [] }, props)
                    : translate("ui.jumpRenderer.text.unset")}
                </option>
                {input.options.map((option) => (
                  <option key={resolved(option, props)}>
                    {resolved(option, props)}
                  </option>
                ))}
              </select>
            )}
            {missingForm && (
              <em className="choice-provenance">
                {translate("ui.jumpRenderer.text.requiresForm")}
                {missingForm}
              </em>
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
  sourceKey,
  sourceRoll,
  props,
}: {
  choice: JumpChoice;
  source: ChoiceSource;
  sourceKey: string;
  sourceRoll?: { result: string | number; sequence: number };
  props: Props;
}) {
  const selections = props.state.sourceSelections[sourceKey] ?? [];
  const checked = selections.includes(choice.handle);
  const limitReached =
    source.mode === "multi" &&
    source.max !== undefined &&
    selections.length >= source.max;
  const setGroup = () => {
    props.actions.setSourceSelections(
      sourceKey,
      source.mode,
      source.mode === "single"
        ? checked
          ? []
          : [choice.handle]
        : checked
          ? selections.filter((handle) => handle !== choice.handle)
          : [...selections, choice.handle],
    );
  };
  return (
    <div className="default-choice-actions">
      <label className="check-control">
        <input
          type={source.mode === "single" ? "radio" : "checkbox"}
          name={sourceOptionGroupName(props.entryId, props.actorId, source)}
          checked={checked}
          disabled={
            (source.resolution === "random" &&
              sourceRoll?.result !== choice.handle) ||
            (limitReached && !checked)
          }
          onChange={setGroup}
        />
        <span>
          {source.resolution === "random"
            ? translate("ui.jumpRenderer.text.sourceResult", {
                choice: resolvedChoice(choice.name, choice, props),
              })
            : translate(
                source.mode === "single"
                  ? "ui.jumpRenderer.text.chooseChoice"
                  : "ui.jumpRenderer.text.takeChoice",
                { choice: resolvedChoice(choice.name, choice, props) },
              )}
        </span>
      </label>
      {sourceRoll?.result === choice.handle && (
        <em>{translate("ui.jumpRenderer.text.rolledLabel")}</em>
      )}
      {limitReached && !checked && (
        <em className="source-option-limit-status">
          {translate("ui.jumpRenderer.text.sourceMaximumReached", {
            maximum: source.max,
          })}
        </em>
      )}
    </div>
  );
}

function SourceChoiceControls({
  choice,
  source,
  sourceKey,
  sourceRoll,
  props,
}: {
  choice: JumpChoice;
  source: ChoiceSource;
  sourceKey: string;
  sourceRoll?: { result: string | number; sequence: number };
  props: Props;
}) {
  const selected =
    props.state.sourceSelections[sourceKey]?.includes(choice.handle) ?? false;
  return (
    <div className="source-choice-controls">
      <SourceOptionControl
        choice={choice}
        source={source}
        sourceKey={sourceKey}
        sourceRoll={sourceRoll}
        props={props}
      />
      {selected && choice.selection !== "toggle" && (
        <ChoiceControl choice={choice} props={props} part="control" />
      )}
    </div>
  );
}

function DefaultChoice({
  choice,
  props,
  source,
  sourceKey,
  sourceRoll,
}: {
  choice: JumpChoice;
  props: Props;
  source?: ChoiceSource;
  sourceKey?: string;
  sourceRoll?: { result: string | number; sequence: number };
}) {
  const description = choice.text.find(
    (text) => text.handle === "description",
  )?.content;
  return (
    <article
      className="default-choice-card"
      data-tour-target={
        choice.handle === "route"
          ? "tracker-choice-route"
          : choice.handle === "field_training"
            ? "tracker-choice-perk"
            : choice.handle === "travel_pack"
              ? "tracker-choice-item"
              : undefined
      }
    >
      <div className="default-choice-heading">
        <strong>
          {resolvedChoice(choice.name, choice, props, choice.handle)}
        </strong>
        <CostBadges
          choice={choice}
          evaluation={props.evaluation}
          packageItem={props.packageItem}
          source={source}
        />
      </div>
      <ChoiceTags choice={choice} props={props} />
      {description && (
        <div className="jump-choice-description">
          <RichText
            blocks={resolvedChoiceRichText(description, choice, props)}
          />
        </div>
      )}
      {source && sourceKey ? (
        <SourceChoiceControls
          choice={choice}
          source={source}
          sourceKey={sourceKey}
          sourceRoll={sourceRoll}
          props={props}
        />
      ) : (
        <ChoiceControl choice={choice} props={props} />
      )}
      <InputControls choice={choice} props={props} />
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
  const selections = props.state.sourceSelections[key] ?? [];
  const anySelected = selections.length > 0;
  const maximumReached =
    source.mode === "multi" &&
    source.max !== undefined &&
    selections.length >= source.max;
  const doRoll = () => {
    if (!choices.length) return;
    if (roll && !props.preferences.allowRerolls) return;
    const index = (props.randomIndex ?? platformRandomIndex)(
      choices.length,
      roll?.sequence ?? 0,
    );
    const selected = choices[index];
    if (!selected) return;
    props.actions.recordSourceRoll(key, source.mode, selected.handle);
  };
  return (
    <footer className="source-roll-controls">
      {source.resolution !== "manual" && (
        <button
          type="button"
          className="roll-control"
          disabled={
            (Boolean(roll) && !props.preferences.allowRerolls) ||
            (maximumReached && !roll)
          }
          onClick={doRoll}
        >
          {translate("ui.jumpRenderer.text.roll")}
        </button>
      )}
      <button
        type="button"
        className="secondary-control"
        disabled={!anySelected}
        onClick={() => props.actions.setSourceSelections(key, source.mode, [])}
      >
        {translate("ui.jumpRenderer.text.clear")}
      </button>
      {source.resolution !== "manual" && (
        <output data-group-status>
          {roll
            ? translate("ui.jumpRenderer.text.rolledChoice", {
                choice: label(
                  choices.find((choice) => choice.handle === roll.result)?.name,
                ),
              })
            : translate("ui.jumpRenderer.text.noResult")}
        </output>
      )}
      {source.mode === "multi" && (
        <span className="spent-total">
          {translate("ui.jumpRenderer.text.spent")}{" "}
          <output>
            {choices.reduce((total, choice) => {
              const evaluated = props.evaluation.choices[choice.handle];
              return (
                total +
                (evaluated?.active
                  ? evaluated.costs.reduce(
                      (sum, cost) => sum + Math.max(0, cost.resolvedAmount),
                      0,
                    )
                  : 0)
              );
            }, 0)}{" "}
            {translate("ui.jumpRenderer.text.cpSuffix")}
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
            sourceKey={`${sectionHandle}:${source.handle}`}
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

function layoutColorInspectionData(
  node: LayoutNode,
  layout: JumpLayout,
  path: string,
) {
  return {
    "data-layout-color-owner-kind": layout.kind,
    "data-layout-color-owner-handle": layout.handle,
    "data-layout-color-owner-path": path,
    "data-layout-color-background": node.presentation.background
      ? "background"
      : undefined,
    "data-layout-color-text":
      node.presentation.textColor &&
      layoutNodeSupportsTextStyling(node.kind, node.target)
        ? "text-color"
        : undefined,
    "data-layout-color-border": node.presentation.borderColor
      ? "border-color"
      : undefined,
    "data-layout-color-accent": node.presentation.color ? "color" : undefined,
  };
}

function resolveLayoutBackgroundImage(
  node: LayoutNode,
  images: readonly ImageBlock[],
  resolveAsset?: JumpAssetResolver,
) {
  const handle = node.presentation.backgroundImage;
  if (!handle) return null;
  const image = images.find((candidate) => candidate.handle === handle);
  if (!image) return null;
  const source = resolveJumpImageSource(image.src, resolveAsset);
  return source ? { image, source } : null;
}

function LayoutBackgroundImage({
  node,
  background,
}: {
  node: LayoutNode;
  background: { image: ImageBlock; source: string } | null;
}) {
  const effects = background?.image.effects;
  const { setElementRef, cornerRadius } = useImageCornerRadius(
    effects?.roundedCorners ?? false,
    effects?.roundedIntensity ?? 25,
    node.presentation.backgroundFit === "tile",
  );
  if (!background) return null;
  return (
    <span
      ref={setElementRef}
      aria-hidden="true"
      className="jump-layout-authored-background"
      style={{
        ...layoutBackgroundImageStyle(node, background.source),
        ...imageEffectStyle(effects),
        borderRadius: cornerRadius,
      }}
      {...imageEffectAttributes(effects)}
    />
  );
}

function LayoutLeafBoundary({
  node,
  path,
  parentKind,
  layout,
  packageItem,
  ownerImages,
  resolveAsset,
  children,
}: {
  node: LayoutNode;
  path: string;
  parentKind?: LayoutNode["kind"];
  layout: JumpLayout;
  packageItem: CanonicalJumpPackage;
  ownerImages: readonly ImageBlock[];
  resolveAsset?: JumpAssetResolver;
  children: ReactNode;
}) {
  const controlAlignment = layoutNodeUsesControlAlignment(
    node.kind,
    node.target,
  )
    ? node.presentation.textAlign
    : undefined;
  const controlAdornments = layoutNodeUsesControlAlignment(
    node.kind,
    node.target,
  )
    ? node.presentation.controlAdornments !== false
    : undefined;
  const background = resolveLayoutBackgroundImage(
    node,
    ownerImages,
    resolveAsset,
  );
  return (
    <div
      className="jump-layout-leaf-boundary"
      data-layout-bound={path}
      data-layout-kind={node.kind}
      data-layout-bound-kind={node.kind === "slot" ? "slot" : "reference"}
      data-layout-align={node.presentation.align}
      data-layout-text-align={node.presentation.textAlign}
      data-layout-control-align={controlAlignment}
      data-layout-control-adornments={
        controlAdornments === undefined
          ? undefined
          : controlAdornments
            ? "on"
            : "off"
      }
      data-layout-control-density={node.presentation.controlDensity}
      data-layout-cost-density={node.presentation.costDensity}
      data-jump-background-image={background?.source ?? undefined}
      {...layoutColorInspectionData(node, layout, path)}
      style={{
        ...layoutLeafPresentationStyle(node, packageItem, parentKind),
        ...(node.kind === "image"
          ? layoutImageBoundaryStyle(node, parentKind)
          : {}),
      }}
    >
      <LayoutBackgroundImage node={node} background={background} />
      {children}
    </div>
  );
}

function LayoutInlineChildArea({
  node,
  children,
}: {
  node: LayoutNode;
  children: ReactNode;
}) {
  if (children === null || children === undefined) return null;
  const isContainer = ["stack", "inline", "wrap", "grid"].includes(node.kind);
  const align = isContainer ? "stretch" : node.presentation.align;
  return (
    <div
      className="jump-layout-inline-child-area"
      data-layout-child-align={align ?? "unset"}
      style={layoutInlineChildAreaStyle(node)}
    >
      {children}
    </div>
  );
}

function Layout({
  node,
  path,
  parentKind,
  sectionHandle,
  choice,
  source,
  sourceKey,
  sourceRoll,
  layout,
  props,
}: {
  node: LayoutNode;
  path?: string;
  parentKind?: LayoutNode["kind"];
  sectionHandle: string;
  choice?: JumpChoice;
  source?: ChoiceSource;
  sourceKey?: string;
  sourceRoll?: { result: string | number; sequence: number };
  layout: JumpLayout;
  props: Props;
}): ReactNode {
  const structuralPath = path ?? `${node.kind}[1]`;
  const section = props.packageItem.sections.find(
    (item) => item.handle === sectionHandle,
  );
  const ownerImages = choice?.images ?? section?.images ?? [];
  const bound = (children: ReactNode) => (
    <LayoutLeafBoundary
      node={node}
      path={structuralPath}
      parentKind={parentKind}
      layout={layout}
      packageItem={props.packageItem}
      ownerImages={ownerImages}
      resolveAsset={props.resolveAsset}
    >
      {children}
    </LayoutLeafBoundary>
  );
  if (node.kind === "slot" && choice) {
    if (node.target === "name")
      return bound(
        <strong>{resolvedChoice(choice.name, choice, props)}</strong>,
      );
    if (node.target === "cost")
      return bound(
        <CostBadges
          choice={choice}
          evaluation={props.evaluation}
          packageItem={props.packageItem}
          source={source}
        />,
      );
    if (node.target === "tags")
      return bound(<ChoiceTags choice={choice} props={props} />);
    if (node.target === "control")
      return bound(
        source && sourceKey ? (
          <SourceChoiceControls
            choice={choice}
            source={source}
            sourceKey={sourceKey}
            sourceRoll={sourceRoll}
            props={props}
          />
        ) : (
          <ChoiceControl choice={choice} props={props} part="control" />
        ),
      );
    if (node.target === "roll")
      return source
        ? null
        : bound(
            <div className="authored-choice-roll-slot">
              <ChoiceControl choice={choice} props={props} part="roll" />
            </div>,
          );
  }
  if (node.kind === "slot" && node.target === "name") {
    return section
      ? bound(
          <h5 className="jump-section-layout-name">
            {resolved(section.name, props, section.handle)}
          </h5>,
        )
      : null;
  }
  if (node.kind === "slot" && node.target === "roll") {
    return section?.sources.length === 1
      ? bound(
          <SourceRollControls
            source={section.sources[0]}
            sectionHandle={sectionHandle}
            props={props}
          />,
        )
      : null;
  }
  if (node.kind === "text") {
    const owner = choice?.text ?? section?.text ?? [];
    const content = owner.find((item) => item.handle === node.target)?.content;
    return content
      ? bound(
          <RichText
            blocks={
              choice
                ? resolvedChoiceRichText(content, choice, props)
                : renderRichTextRenderable(content, rendererContext(props))
            }
            layoutNode={node}
          />,
        )
      : null;
  }
  if (node.kind === "rule")
    return bound(
      <hr
        aria-orientation={node.presentation.orientation ?? "horizontal"}
        style={layoutRuleStyle(node, props.packageItem)}
      />,
    );
  if (node.kind === "input" && choice)
    return bound(
      <InputControls choice={choice} props={props} target={node.target} />,
    );
  if (node.kind === "image") {
    const item = ownerImages.find((image) => image.handle === node.target);
    if (!item) return null;
    const source = resolveJumpImageSource(item.src, props.resolveAsset);
    return source
      ? bound(
          <RenderedJumpImage
            source={source}
            alternativeText={resolved(item.alt, props)}
            style={layoutImageStyle(node, parentKind)}
            effects={item.effects}
            tiled={node.presentation.fit === "tile"}
            showAltTextOnHover={props.preferences.imageAltTextHover}
          />,
        )
      : null;
  }
  if (node.kind === "choice") {
    const target = props.packageItem.sections
      .find((section) => section.handle === sectionHandle)
      ?.directChoices.find((item) => item.handle === node.target)?.target;
    const direct = props.packageItem.choices.find(
      (item) => item.handle === target,
    );
    return direct
      ? bound(<ChoiceWithLayout choice={direct} props={props} />)
      : null;
  }
  if (node.kind === "expand") {
    const source = node.source
      ? section?.sources.find((item) => item.handle === node.source)
      : section?.sources.length === 1
        ? section.sources[0]
        : undefined;
    const sectionLayout = props.packageItem.layouts.find(
      (item) =>
        item.kind === "section-layout" &&
        item.handle ===
          (section?.layout ?? props.packageItem.defaultSectionLayout),
    );
    return source
      ? bound(
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
          />,
        )
      : null;
  }
  const Tag =
    node.kind === "inline" || node.kind === "wrap"
      ? "div"
      : node.kind === "grid"
        ? "div"
        : "div";
  const children = node.children.map((child, index) =>
    Layout({
      node: child,
      path: `${structuralPath}/${child.kind}[${index + 1}]`,
      parentKind: node.kind,
      sectionHandle,
      choice,
      source,
      sourceKey,
      sourceRoll,
      layout,
      props,
    }),
  );
  if (!children.some((child) => child !== null && child !== undefined))
    return null;
  const background = resolveLayoutBackgroundImage(
    node,
    ownerImages,
    props.resolveAsset,
  );
  return (
    <Tag
      className={`jump-layout-${node.kind}`}
      style={layoutContainerPresentationStyle(
        node,
        props.packageItem,
        parentKind,
      )}
      data-jump-background-image={background?.source ?? undefined}
      data-layout-bound={structuralPath}
      data-layout-kind={node.kind}
      data-layout-bound-kind="container"
      {...layoutColorInspectionData(node, layout, structuralPath)}
    >
      <LayoutBackgroundImage node={node} background={background} />
      {children.map((child, index) => (
        <Fragment
          key={`${structuralPath}/${node.children[index].kind}[${index + 1}]`}
        >
          {node.kind === "inline" || node.kind === "wrap" ? (
            <LayoutInlineChildArea node={node.children[index]}>
              {child}
            </LayoutInlineChildArea>
          ) : (
            child
          )}
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
  sourceKey,
  sourceRoll,
}: {
  choice: JumpChoice;
  props: Props;
  layoutHandle?: string;
  source?: ChoiceSource;
  sourceKey?: string;
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
        sourceKey={sourceKey}
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
        sourceKey={sourceKey}
        sourceRoll={sourceRoll}
        layout={layout}
        props={props}
      />
    </article>
  );
}

function SectionLockSeal({ index }: { index: number }) {
  const gradientId = `section-lock-${useId().replaceAll(":", "")}`;
  return (
    <svg
      className="jump-section-lock-seal"
      data-section-lock-seal={index + 1}
      viewBox="0 0 112 120"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${gradientId}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1a6" />
          <stop offset="0.35" stopColor="#c88b27" />
          <stop offset="0.7" stopColor="#6f351b" />
          <stop offset="1" stopColor="#e9bd4c" />
        </linearGradient>
        <radialGradient id={`${gradientId}-jewel`} cx="38%" cy="28%" r="74%">
          <stop offset="0" stopColor="#ff6a5f" />
          <stop offset="0.45" stopColor="#b80f26" />
          <stop offset="1" stopColor="#4b0714" />
        </radialGradient>
      </defs>
      <path
        className="jump-section-lock-shackle-shadow"
        d="M32 51V35C32 5 80 5 80 35v16"
      />
      <path
        className="jump-section-lock-shackle"
        d="M32 51V35C32 5 80 5 80 35v16"
        stroke={`url(#${gradientId}-metal)`}
      />
      <path
        d="m12 55 11-13 13 4 20-9 20 9 13-4 11 13-8 13 5 28-17 5-8 13H40l-8-13-17-5 5-28Z"
        fill={`url(#${gradientId}-metal)`}
        stroke="#3b1712"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="m22 59 8-9 10 4 16-8 16 8 10-4 8 9-7 11 4 20-13 4-7 11H45l-7-11-13-4 4-20Z"
        fill={`url(#${gradientId}-jewel)`}
        stroke="#ffd875"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M35 64c9-8 33-8 42 0M32 87c13 7 35 7 48 0"
        fill="none"
        stroke="#ff8270"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle
        cx="56"
        cy="76"
        r="12"
        fill="#5f1018"
        stroke="#f6cb63"
        strokeWidth="2"
      />
      <path
        d="M56 68a5 5 0 0 0-3 9l-3 9h12l-3-9a5 5 0 0 0-3-9Z"
        fill="#19090b"
      />
      <g fill="#fff0a1" stroke="#6b3518" strokeWidth="1.5">
        <circle cx="30" cy="62" r="3" />
        <circle cx="82" cy="62" r="3" />
        <circle cx="35" cy="91" r="3" />
        <circle cx="77" cy="91" r="3" />
      </g>
    </svg>
  );
}

function SectionLockOverlay({ count }: { count: number }) {
  const label = translate("ui.jumpRenderer.text.sectionLocked");
  const visibleCount = Math.min(count, 5);
  return (
    <div
      className="jump-section-locked-status"
      data-section-lock-count={count}
      role="status"
      aria-label={`${label} × ${count}`}
    >
      <svg
        className="jump-section-lock-chains"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <g className="jump-section-chain-shadow">
          <path d="M-8 16 108 84" />
          <path d="M-8 84 108 16" />
        </g>
        <g className="jump-section-chain-links">
          <path d="M-8 16 108 84" />
          <path d="M-8 84 108 16" />
        </g>
        <g className="jump-section-chain-glint">
          <path d="M-8 14.5 108 82.5" />
          <path d="M-8 82.5 108 14.5" />
        </g>
      </svg>
      <div className="jump-section-lock-message">
        <span>{label}</span>
        <span aria-hidden="true">× {count}</span>
      </div>
      <div
        className="jump-section-lock-seals"
        data-section-lock-formation={visibleCount}
      >
        {Array.from({ length: visibleCount }, (_, index) => (
          <SectionLockSeal key={index} index={index} />
        ))}
      </div>
    </div>
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
  const evaluatedSection = props.evaluation.sections?.[section.handle];
  const locked = evaluatedSection?.locked ?? false;
  const lockCount = locked
    ? Math.max(1, Math.trunc(evaluatedSection?.lockScore ?? 1))
    : 0;
  const content = layout ? (
    <Layout
      node={layout.root}
      sectionHandle={section.handle}
      layout={layout}
      props={props}
    />
  ) : (
    <div className="jump-default-section">
      <h5 className="jump-section-layout-name">
        {resolved(section.name, props, section.handle)}
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
  );
  return (
    <section
      className="rendered-jump-section"
      data-section-locked={locked ? "true" : "false"}
      aria-disabled={locked || undefined}
    >
      {locked && <SectionLockOverlay count={lockCount} />}
      <fieldset className="jump-section-content" disabled={locked}>
        {content}
      </fieldset>
    </section>
  );
}

function TraitLayoutNode({
  node,
  path,
  parentKind,
  layout,
  trait,
  props,
}: {
  node: LayoutNode;
  path?: string;
  parentKind?: LayoutNode["kind"];
  layout: JumpLayout;
  trait: EvaluatedGrantRecord;
  props: Props;
}): ReactNode {
  const structuralPath = path ?? `${node.kind}[1]`;
  const ownerImages = trait.images ?? [];
  const bound = (children: ReactNode) => (
    <LayoutLeafBoundary
      node={node}
      path={structuralPath}
      parentKind={parentKind}
      layout={layout}
      packageItem={props.packageItem}
      ownerImages={ownerImages}
      resolveAsset={props.resolveAsset}
    >
      {children}
    </LayoutLeafBoundary>
  );
  if (node.kind === "slot" && node.target === "name")
    return bound(<strong>{trait.name}</strong>);
  if (node.kind === "text") {
    const content = trait.text?.find(
      (item) => item.handle === node.target,
    )?.content;
    return content
      ? bound(
          <RichText
            blocks={renderRichTextRenderable(
              content,
              rendererContext(
                props,
                trait.measure
                  ? {
                      [trait.measure.kind === "quantity" ? "count" : "rank"]:
                        trait.measure.value,
                    }
                  : {},
              ),
            )}
            layoutNode={node}
          />,
        )
      : null;
  }
  if (node.kind === "image") {
    const item = trait.images?.find((image) => image.handle === node.target);
    if (!item) return null;
    const source = resolveJumpImageSource(item.src, props.resolveAsset);
    return source
      ? bound(
          <RenderedJumpImage
            source={source}
            alternativeText={resolved(item.alt, props)}
            style={layoutImageStyle(node, parentKind)}
            effects={item.effects}
            tiled={node.presentation.fit === "tile"}
            showAltTextOnHover={props.preferences.imageAltTextHover}
          />,
        )
      : null;
  }
  if (node.kind === "rule")
    return bound(
      <hr
        aria-orientation={node.presentation.orientation ?? "horizontal"}
        style={layoutRuleStyle(node, props.packageItem)}
      />,
    );
  if (!["stack", "inline", "wrap", "grid"].includes(node.kind)) return null;
  const background = resolveLayoutBackgroundImage(
    node,
    ownerImages,
    props.resolveAsset,
  );
  return (
    <div
      className={`jump-layout-${node.kind}`}
      style={layoutContainerPresentationStyle(
        node,
        props.packageItem,
        parentKind,
      )}
      data-jump-background-image={background?.source ?? undefined}
      data-layout-bound={structuralPath}
      data-layout-kind={node.kind}
      data-layout-bound-kind="container"
      {...layoutColorInspectionData(node, layout, structuralPath)}
    >
      <LayoutBackgroundImage node={node} background={background} />
      {node.children.map((child, index) => {
        const childNode = (
          <TraitLayoutNode
            node={child}
            path={`${structuralPath}/${child.kind}[${index + 1}]`}
            parentKind={node.kind}
            layout={layout}
            trait={trait}
            props={props}
          />
        );
        return (
          <Fragment key={`${structuralPath}/${child.kind}[${index + 1}]`}>
            {node.kind === "inline" || node.kind === "wrap" ? (
              <LayoutInlineChildArea node={child}>
                {childNode}
              </LayoutInlineChildArea>
            ) : (
              childNode
            )}
          </Fragment>
        );
      })}
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
    <article className="authored-trait-layout">
      <TraitLayoutNode
        node={layout.root}
        layout={layout}
        trait={trait}
        props={props}
      />
    </article>
  ) : (
    <article className="default-trait-card">
      <strong>{trait.name}</strong>
      <span>{trait.description}</span>
    </article>
  );
}

function JumpRendererAppearanceBoundary({
  children,
  rendererProps,
  complete = false,
}: {
  children: ReactNode;
  rendererProps: JumpRendererProps;
  complete?: boolean;
}) {
  const className = `jump-renderer-appearance-boundary format-one-jump-renderer${
    complete ? " shared-jump-renderer" : " jump-renderer-isolated-scope"
  }`;
  const style = jumpAppearanceStyle(rendererProps.packageItem);
  return complete ? (
    <article className={className} style={style}>
      {children}
    </article>
  ) : (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

/** Canonical trait-layout rendering scope shared by the Tracker and Editor preview. */
export function JumpTraitRendererScope({
  trait,
  rendererProps,
}: {
  trait: EvaluatedGrantRecord;
  rendererProps: JumpRendererProps;
}) {
  return (
    <JumpRendererAppearanceBoundary rendererProps={rendererProps}>
      <TraitView trait={trait} props={rendererProps} />
    </JumpRendererAppearanceBoundary>
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
  return (
    <JumpRendererAppearanceBoundary rendererProps={rendererProps}>
      <JumpSectionView section={section} props={rendererProps} />
    </JumpRendererAppearanceBoundary>
  );
}

/** Canonical choice rendering scope shared by the Tracker and Editor preview. */
export function JumpChoiceRendererScope({
  choice,
  rendererProps,
}: {
  choice: JumpChoice;
  rendererProps: JumpRendererProps;
}) {
  return (
    <JumpRendererAppearanceBoundary rendererProps={rendererProps}>
      <ChoiceWithLayout choice={choice} props={rendererProps} />
    </JumpRendererAppearanceBoundary>
  );
}

/** Canonical choice-source rendering scope shared by the Tracker and Editor preview. */
export function JumpChoiceSourceRendererScope({
  source,
  sectionHandle,
  rendererProps,
}: {
  source: ChoiceSource;
  sectionHandle: string;
  rendererProps: JumpRendererProps;
}) {
  return (
    <JumpRendererAppearanceBoundary rendererProps={rendererProps}>
      <SourceChoices
        source={source}
        sectionHandle={sectionHandle}
        props={rendererProps}
      />
    </JumpRendererAppearanceBoundary>
  );
}

/** Canonical image rendering scope shared by the Tracker and Editor preview. */
export function JumpImageRendererScope({
  image,
  rendererProps,
}: {
  image: ImageBlock;
  rendererProps: JumpRendererProps;
}) {
  const source = resolveJumpImageSource(image.src, rendererProps.resolveAsset);
  return source ? (
    <JumpRendererAppearanceBoundary rendererProps={rendererProps}>
      <article className="jump-image-preview">
        <span className="jump-image-preview-content">
          <RenderedJumpImage
            source={source}
            alternativeText={resolved(image.alt, rendererProps)}
            effects={image.effects}
            showAltTextOnHover={rendererProps.preferences.imageAltTextHover}
          />
        </span>
      </article>
    </JumpRendererAppearanceBoundary>
  ) : null;
}

export function JumpRenderer(props: Props) {
  return (
    <div className="chain-view-panel tracker-renderer-placeholder">
      {props.preferences.showAdditionalJumpInformation && (
        <div className="shared-renderer-label">
          <small>
            {translate("ui.jumpRenderer.text.format1EvaluatedPackage")}
          </small>
        </div>
      )}
      <JumpRendererAppearanceBoundary rendererProps={props} complete>
        <header>
          <div>
            <p>{props.gauntletActive ? "Gauntlet" : "Current Jump"}</p>
            <h4>{resolved(props.packageItem.name, props)}</h4>
            <span>
              {renderRenderable(
                {
                  base: props.packageItem.description,
                  variants: [],
                },
                rendererContext(props),
              )}
            </span>
          </div>
          <div className="tracker-budget">
            <span>{translate("ui.jumpRenderer.text.available")}</span>
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
              <p>{translate("ui.jumpRenderer.text.traits")}</p>
              <h5>{translate("ui.jumpRenderer.text.currentJumpTraits")}</h5>
            </header>
            <div className="jump-trait-list">
              {props.evaluation.traits.map((trait) => (
                <TraitView key={trait.id} trait={trait} props={props} />
              ))}
            </div>
          </section>
        )}
      </JumpRendererAppearanceBoundary>
    </div>
  );
}
