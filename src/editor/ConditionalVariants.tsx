import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Completion } from "@codemirror/autocomplete";
import {
  Button,
  ComboBox,
  ComboBoxStateContext,
  Group,
  Header,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover,
} from "react-aria-components";
import {
  parseConditionExpression,
  type ConditionPropertyDescriptor,
  type PackageDiagnostic,
} from "../markup";
import { translate, translateDiagnostic } from "../localization";
import { NumberStepperButtons } from "../tracker/NumberStepper";
import { Chevron } from "../ui";
import { ConditionExpressionInput } from "./ConditionExpressionInput";
import {
  addVisualNode,
  expressionToVisual,
  removeVisualNode,
  updateVisualNode,
  visualRuleSource,
  visualSource,
  type VisualNode,
  type VisualRule,
} from "./conditionBuilderModel";

type ConditionalVariant = {
  baseOccurrence: number;
  occurrence: number;
  condition: string;
  value: string;
};

function propertyTypeLabel(property: ConditionPropertyDescriptor) {
  return translate(`ui.editorWorkspace.condition.type.${property.type}`);
}

function propertyLabel(property: ConditionPropertyDescriptor) {
  return ["rank", "count"].includes(property.handle)
    ? translate(
        `ui.editorWorkspace.condition.contextProperty.${property.handle}`,
      )
    : property.handle;
}

function propertySearchText(property: ConditionPropertyDescriptor) {
  const label = propertyLabel(property);
  return label === property.handle
    ? property.handle
    : `${label} ${property.handle}`;
}

function propertyProvenance(property: ConditionPropertyDescriptor) {
  const control = property.origins.find((item) => item.kind === "control");
  if (control)
    return translate(
      control.ownerKind === "choice"
        ? "ui.editorWorkspace.condition.choiceAnswer"
        : "ui.editorWorkspace.condition.inputAnswer",
    );
  const origin = property.origins.find((item) => item.kind === "grant");
  if (origin)
    return translate("ui.editorWorkspace.condition.fromOwner", {
      kind: origin.ownerKind ?? "declaration",
      handle: origin.ownerHandle ?? "",
    });
  return translate(
    property.category === "context"
      ? "ui.editorWorkspace.condition.contextValue"
      : "ui.editorWorkspace.condition.engineValue",
  );
}

function ConditionComboBoxChevron() {
  const state = useContext(ComboBoxStateContext);
  return (
    <Chevron
      className="editor-diagnostics-chevron"
      direction={state?.isOpen ? "up" : "down"}
    />
  );
}

function ConditionPropertyPicker({
  value,
  properties,
  autoFocus,
  showDescriptions = true,
  label = translate("ui.editorWorkspace.condition.property"),
  placeholder = translate("ui.editorWorkspace.condition.chooseProperty"),
  onChange,
}: {
  value: string;
  properties: readonly ConditionPropertyDescriptor[];
  autoFocus?: boolean;
  showDescriptions?: boolean;
  label?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const current = properties.find((property) => property.handle === value);
  const grouped = (["context", "engine", "package"] as const).map(
    (category) => ({
      category,
      properties: properties.filter(
        (property) => property.category === category,
      ),
    }),
  );
  return (
    <ComboBox
      className="editor-condition-combobox"
      selectedKey={value || null}
      onSelectionChange={(key) => key !== null && onChange(String(key))}
      menuTrigger="input"
    >
      <Label className="sr-only">{label}</Label>
      <Group>
        <Input autoFocus={autoFocus} placeholder={placeholder} />
        <Button
          aria-label={translate("ui.editorWorkspace.condition.showProperties")}
        >
          <ConditionComboBoxChevron />
        </Button>
      </Group>
      <Popover className="editor-condition-popover">
        <ListBox>
          {value && !current && (
            <ListBoxItem id={value} textValue={value} className="is-unresolved">
              <strong>{value}</strong>
              <small>
                {translate("ui.editorWorkspace.condition.unresolvedProperty")}
              </small>
            </ListBoxItem>
          )}
          {grouped.map((group) =>
            group.properties.length ? (
              <ListBoxSection key={group.category}>
                <Header>
                  {translate(
                    `ui.editorWorkspace.condition.group.${group.category}`,
                  )}
                </Header>
                {group.properties.map((property) => (
                  <ListBoxItem
                    id={property.handle}
                    key={property.handle}
                    textValue={propertySearchText(property)}
                  >
                    <span>
                      <strong>{propertyLabel(property)}</strong>
                      {showDescriptions && (
                        <small>{propertyTypeLabel(property)}</small>
                      )}
                    </span>
                    {showDescriptions && (
                      <small>
                        {propertyProvenance(property)}
                        {property.mayBeUnset
                          ? ` · ${translate("ui.editorWorkspace.condition.mayBeUnset")}`
                          : ""}
                      </small>
                    )}
                  </ListBoxItem>
                ))}
              </ListBoxSection>
            ) : null,
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}

export function InsertValueControl({
  properties,
  showDescriptions,
  onInsert,
}: {
  properties: readonly ConditionPropertyDescriptor[];
  showDescriptions: boolean;
  onInsert: (handle: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const grouped = (["context", "engine", "package"] as const)
    .map((category) => ({
      category,
      properties: properties.filter(
        (property) => property.category === category,
      ),
    }))
    .filter((group) => group.properties.length);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  if (!properties.length) return null;
  return (
    <div className="editor-insert-value" ref={root}>
      <button
        type="button"
        className="editor-insert-value-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        ref={trigger}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => {
            const items =
              root.current?.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]',
              );
            items?.[event.key === "ArrowDown" ? 0 : items.length - 1]?.focus();
          });
        }}
      >
        {translate("ui.editorWorkspace.namedValues.insert")}
        <Chevron
          className="editor-diagnostics-chevron"
          direction={open ? "up" : "down"}
        />
      </button>
      {open && (
        <div
          className="editor-insert-value-popover"
          role="menu"
          aria-label={translate("ui.editorWorkspace.namedValues.insert")}
          onKeyDown={(event) => {
            const items = [
              ...(root.current?.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]',
              ) ?? []),
            ];
            const index = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              trigger.current?.focus();
            } else if (
              ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : event.key === "ArrowDown"
                      ? (index + 1) % items.length
                      : (index - 1 + items.length) % items.length;
              items[next]?.focus();
            }
          }}
        >
          {grouped.map((group) => (
            <div
              role="group"
              aria-label={translate(
                `ui.editorWorkspace.condition.group.${group.category}`,
              )}
              key={group.category}
            >
              <strong className="editor-insert-value-group-label">
                {translate(
                  `ui.editorWorkspace.condition.group.${group.category}`,
                )}
              </strong>
              {group.properties.map((property) => (
                <button
                  type="button"
                  role="menuitem"
                  key={property.handle}
                  onClick={() => {
                    setOpen(false);
                    onInsert(property.handle);
                  }}
                >
                  <span>
                    <strong>{propertyLabel(property)}</strong>
                    {showDescriptions && (
                      <small>{propertyTypeLabel(property)}</small>
                    )}
                  </span>
                  {showDescriptions && (
                    <small>
                      {propertyProvenance(property)}
                      {property.mayBeUnset
                        ? ` · ${translate("ui.editorWorkspace.condition.mayBeUnset")}`
                        : ""}
                    </small>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function insertAtSelection(
  control: HTMLTextAreaElement | null,
  value: string,
  insertion: string,
  onChange: (value: string) => void,
) {
  const start = control?.selectionStart ?? value.length;
  const end = control?.selectionEnd ?? start;
  onChange(`${value.slice(0, start)}${insertion}${value.slice(end)}`);
  requestAnimationFrame(() => {
    control?.focus();
    const caret = start + insertion.length;
    control?.setSelectionRange(caret, caret);
  });
}

function operatorOptions(type: ConditionPropertyDescriptor["type"]) {
  const base: VisualRule["operator"][] = [
    "active",
    "inactive",
    "equal",
    "not-equal",
  ];
  return type === "integer"
    ? [...base, "less", "less-equal", "greater", "greater-equal"]
    : base;
}

const operatorNeedsValue = (operator: VisualRule["operator"]) =>
  !["active", "inactive", "always", "never"].includes(operator);

function ConditionValueControl({
  property,
  value,
  onChange,
}: {
  property: ConditionPropertyDescriptor;
  value: VisualRule["value"];
  onChange: (value: string | number | boolean) => void;
}) {
  if (property.type === "boolean")
    return (
      <select
        aria-label={translate("ui.editorWorkspace.condition.value")}
        value={String(value ?? true)}
        onChange={(event) => onChange(event.target.value === "true")}
      >
        <option value="true">
          {translate("ui.editorWorkspace.condition.true")}
        </option>
        <option value="false">
          {translate("ui.editorWorkspace.condition.false")}
        </option>
      </select>
    );
  if (property.type === "integer") {
    const numberValue = typeof value === "number" ? value : 0;
    return (
      <span className="number-stepper editor-number-stepper is-fluid">
        <input
          aria-label={translate("ui.editorWorkspace.condition.value")}
          type="number"
          min={property.minimum}
          max={property.maximum}
          value={numberValue}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <NumberStepperButtons
          label={translate("ui.editorWorkspace.condition.value")}
          increaseDisabled={
            property.maximum !== undefined && numberValue >= property.maximum
          }
          decreaseDisabled={
            property.minimum !== undefined && numberValue <= property.minimum
          }
          onIncrease={() => onChange(numberValue + 1)}
          onDecrease={() => onChange(numberValue - 1)}
        />
      </span>
    );
  }
  return (
    <ComboBox
      className="editor-condition-combobox is-value"
      inputValue={typeof value === "string" ? value : ""}
      allowsCustomValue
      onInputChange={onChange}
      onSelectionChange={(key) => key !== null && onChange(String(key))}
    >
      <Label className="sr-only">
        {translate("ui.editorWorkspace.condition.value")}
      </Label>
      <Group>
        <Input />
        {property.values.length > 0 && (
          <Button
            aria-label={translate("ui.editorWorkspace.condition.showValues")}
          >
            <ConditionComboBoxChevron />
          </Button>
        )}
      </Group>
      {property.values.length > 0 && (
        <Popover className="editor-condition-popover is-values">
          <ListBox>
            {property.values.map((item) => (
              <ListBoxItem
                id={String(item)}
                key={`${typeof item}:${String(item)}`}
              >
                {String(item)}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      )}
    </ComboBox>
  );
}

function RuleEditor({
  rule,
  properties,
  autoFocus,
  onChange,
}: {
  rule: VisualRule;
  properties: readonly ConditionPropertyDescriptor[];
  autoFocus?: boolean;
  onChange: (rule: VisualRule) => void;
}) {
  if (rule.operator === "always" || rule.operator === "never")
    return (
      <select
        aria-label={translate("ui.editorWorkspace.condition.constant")}
        value={rule.operator}
        onChange={(event) =>
          onChange({
            ...rule,
            operator: event.target.value as "always" | "never",
          })
        }
      >
        <option value="always">
          {translate("ui.editorWorkspace.condition.always")}
        </option>
        <option value="never">
          {translate("ui.editorWorkspace.condition.never")}
        </option>
      </select>
    );
  const descriptor = properties.find(
    (property) => property.handle === rule.property,
  ) ?? {
    handle: rule.property,
    type: "unknown" as const,
    category: "package" as const,
    origins: [],
    values: [],
    mayBeUnset: true,
  };
  return (
    <div className="editor-condition-rule-row">
      <ConditionPropertyPicker
        value={rule.property}
        properties={properties}
        autoFocus={autoFocus}
        onChange={(property) => {
          const nextDescriptor = properties.find(
            (item) => item.handle === property,
          );
          onChange({
            kind: "rule",
            property,
            operator: "active",
            value:
              nextDescriptor?.type === "boolean"
                ? true
                : nextDescriptor?.type === "integer"
                  ? (nextDescriptor.minimum ?? 0)
                  : "",
          });
        }}
      />
      <select
        aria-label={translate("ui.editorWorkspace.condition.operator")}
        value={rule.operator}
        onChange={(event) => {
          const operator = event.target.value as VisualRule["operator"];
          onChange({
            ...rule,
            operator,
            value:
              descriptor.type === "boolean"
                ? (rule.value ?? true)
                : descriptor.type === "integer"
                  ? (rule.value ?? descriptor.minimum ?? 0)
                  : (rule.value ?? ""),
          });
        }}
      >
        {operatorOptions(descriptor.type).map((operator) => (
          <option value={operator} key={operator}>
            {translate(
              `ui.editorWorkspace.condition.operatorLabel.${operator}`,
            )}
          </option>
        ))}
      </select>
      {operatorNeedsValue(rule.operator) && (
        <ConditionValueControl
          property={descriptor}
          value={rule.value}
          onChange={(value) => onChange({ ...rule, value })}
        />
      )}
    </div>
  );
}

function VisualNodeEditor({
  node,
  path,
  properties,
  onChange,
  onAdd,
  onRemove,
}: {
  node: VisualNode;
  path: readonly number[];
  properties: readonly ConditionPropertyDescriptor[];
  onChange: (path: readonly number[], node: VisualNode) => void;
  onAdd: (path: readonly number[], kind: "rule" | "group") => void;
  onRemove: (path: readonly number[]) => void;
}) {
  if (node.kind === "rule")
    return (
      <div className="editor-condition-rule">
        <RuleEditor
          rule={node}
          properties={properties}
          onChange={(rule) => onChange(path, rule)}
        />
        {path.length > 0 && (
          <button
            type="button"
            aria-label={translate("ui.editorWorkspace.condition.removeRule")}
            onClick={() => onRemove(path)}
          >
            ×
          </button>
        )}
      </div>
    );
  return (
    <fieldset className="editor-condition-group">
      <legend className="sr-only">
        {translate("ui.editorWorkspace.condition.groupLabel")}
      </legend>
      <div className="editor-condition-group-heading">
        <span>{translate("ui.editorWorkspace.condition.match")}</span>
        <select
          aria-label={translate("ui.editorWorkspace.condition.groupOperator")}
          value={node.operator}
          onChange={(event) =>
            onChange(path, {
              ...node,
              operator: event.target.value as "and" | "or",
            })
          }
        >
          <option value="and">
            {translate("ui.editorWorkspace.condition.all")}
          </option>
          <option value="or">
            {translate("ui.editorWorkspace.condition.any")}
          </option>
        </select>
        <span>
          {translate("ui.editorWorkspace.condition.conditionsInGroup")}
        </span>
        <button
          type="button"
          className={node.inverted ? "is-active" : undefined}
          aria-pressed={node.inverted}
          onClick={() => onChange(path, { ...node, inverted: !node.inverted })}
        >
          {translate("ui.editorWorkspace.condition.invert")}
        </button>
        {path.length > 0 && (
          <button
            type="button"
            onClick={() => onRemove(path)}
            aria-label={translate("ui.editorWorkspace.condition.removeGroup")}
          >
            ×
          </button>
        )}
      </div>
      {node.children.map((child, index) => (
        <VisualNodeEditor
          key={index}
          node={child}
          path={[...path, index]}
          properties={properties}
          onChange={onChange}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      ))}
      <div className="editor-condition-add-actions">
        <button
          type="button"
          title={translate("ui.editorWorkspace.condition.addConditionHelp")}
          onClick={() => onAdd(path, "rule")}
        >
          {translate("ui.editorWorkspace.condition.addCondition")}
        </button>
        <button
          type="button"
          title={translate("ui.editorWorkspace.condition.addNestedGroupHelp")}
          onClick={() => onAdd(path, "group")}
        >
          {translate("ui.editorWorkspace.condition.addNestedGroup")}
        </button>
      </div>
    </fieldset>
  );
}

function DraftRule({
  properties,
  variantDraft = false,
  onComplete,
  onCancel,
}: {
  properties: readonly ConditionPropertyDescriptor[];
  variantDraft?: boolean;
  onComplete: (rule: VisualRule) => void;
  onCancel: () => void;
}) {
  const [rule, setRule] = useState<VisualRule>({
    kind: "rule",
    property: "",
    operator: "active",
  });
  return (
    <div className="editor-condition-draft">
      <div>
        <strong>
          {translate(
            variantDraft
              ? "ui.editorWorkspace.condition.variantDraft"
              : "ui.editorWorkspace.condition.conditionDraft",
          )}
        </strong>
        <small>{translate("ui.editorWorkspace.condition.draftNotSaved")}</small>
      </div>
      <RuleEditor
        rule={rule}
        properties={properties}
        autoFocus
        onChange={(next) => {
          setRule(next);
          if (
            next.property &&
            (!operatorNeedsValue(next.operator) || next.value !== undefined)
          )
            onComplete(next);
        }}
      />
      <button type="button" onClick={onCancel}>
        {translate("ui.editorWorkspace.condition.cancelDraft")}
      </button>
    </div>
  );
}

function VariantValueControl({
  fieldLabel,
  richText,
  value,
  onChange,
  onBlur,
  textareaRef,
}: {
  fieldLabel: string;
  richText: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const label = translate("ui.editorWorkspace.condition.variantValue", {
    field: fieldLabel,
  });
  return richText ? (
    <textarea
      ref={textareaRef}
      aria-label={label}
      spellCheck
      rows={5}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
    />
  ) : (
    <input
      aria-label={label}
      type="text"
      spellCheck
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
    />
  );
}

function VariantEditor({
  variant,
  index,
  count,
  fieldName,
  fieldLabel,
  richText,
  showExplanatoryText,
  properties,
  diagnostics,
  onUpdate,
  onMove,
  onRemove,
  onEndFieldEdit,
}: {
  variant: ConditionalVariant;
  index: number;
  count: number;
  fieldName: string;
  fieldLabel: string;
  richText: boolean;
  showExplanatoryText: boolean;
  properties: readonly ConditionPropertyDescriptor[];
  diagnostics: readonly PackageDiagnostic[];
  onUpdate: (condition: string, value: string) => void;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
  onEndFieldEdit: () => void;
}) {
  const parsed = useMemo(
    () => parseConditionExpression(variant.condition),
    [variant.condition],
  );
  const visual = useMemo(
    () => (parsed.expression ? expressionToVisual(parsed.expression) : null),
    [parsed.expression],
  );
  const [mode, setMode] = useState<"builder" | "expression">(
    visual ? "builder" : "expression",
  );
  const [addition, setAddition] = useState<{
    path: readonly number[];
    kind: "rule" | "group";
  } | null>(null);
  const valueRef = useRef<HTMLTextAreaElement>(null);
  const diagnosticId = diagnostics.length
    ? `editor-condition-${fieldName}-${variant.occurrence}-diagnostics`
    : undefined;
  const completions: Completion[] = [
    ...properties.map((property) => ({
      label: property.handle,
      detail: propertyTypeLabel(property),
      type: "variable",
    })),
    ...["and", "or", "true", "false"].map((label) => ({
      label,
      type: "keyword",
    })),
    ...["=", "!=", "<", "<=", ">", ">=", "!", "(", ")"].map((label) => ({
      label,
      type: "operator",
    })),
  ];
  return (
    <article className="editor-condition-variant-card">
      <header>
        <strong>
          {translate("ui.editorWorkspace.condition.variantNumber", {
            number: index + 1,
          })}
        </strong>
        <span
          className="editor-condition-mode"
          role="group"
          aria-label={translate("ui.editorWorkspace.condition.editMode")}
        >
          <button
            type="button"
            className={mode === "builder" ? "is-active" : undefined}
            aria-pressed={mode === "builder"}
            onClick={() => setMode("builder")}
            disabled={!visual}
          >
            {translate("ui.editorWorkspace.condition.builder")}
          </button>
          <button
            type="button"
            className={mode === "expression" ? "is-active" : undefined}
            aria-pressed={mode === "expression"}
            onClick={() => setMode("expression")}
          >
            {translate("ui.editorWorkspace.condition.expression")}
          </button>
        </span>
      </header>
      <div className="editor-condition-when-row">
        <span>{translate("ui.editorWorkspace.text.when")}</span>
        {mode === "builder" && visual ? (
          <div className="editor-condition-builder">
            <VisualNodeEditor
              node={visual}
              path={[]}
              properties={properties}
              onChange={(path, nextNode) =>
                onUpdate(
                  visualSource(updateVisualNode(visual, path, () => nextNode)),
                  variant.value,
                )
              }
              onAdd={(path, kind) => setAddition({ path, kind })}
              onRemove={(path) => {
                const next = removeVisualNode(visual, path);
                if (next) onUpdate(visualSource(next), variant.value);
              }}
            />
            {visual.kind === "rule" && (
              <div className="editor-condition-add-actions">
                <button
                  type="button"
                  title={translate(
                    "ui.editorWorkspace.condition.addConditionHelp",
                  )}
                  onClick={() => setAddition({ path: [], kind: "rule" })}
                >
                  {translate("ui.editorWorkspace.condition.addCondition")}
                </button>
              </div>
            )}
            {addition && (
              <DraftRule
                properties={properties}
                onCancel={() => setAddition(null)}
                onComplete={(rule) => {
                  const child: VisualNode =
                    addition.kind === "group"
                      ? {
                          kind: "group",
                          operator: "and",
                          inverted: false,
                          explicit: true,
                          children: [rule],
                        }
                      : rule;
                  onUpdate(
                    visualSource(addVisualNode(visual, addition.path, child)),
                    variant.value,
                  );
                  setAddition(null);
                }}
              />
            )}
          </div>
        ) : (
          <ConditionExpressionInput
            label={translate("ui.editorWorkspace.condition.expressionLabel", {
              number: index + 1,
            })}
            value={variant.condition}
            completions={completions}
            ariaInvalid={diagnostics.length > 0}
            ariaDescribedBy={diagnosticId}
            onChange={(condition) => onUpdate(condition, variant.value)}
            onBlur={onEndFieldEdit}
          />
        )}
      </div>
      {!visual && mode === "expression" && (
        <small className="editor-condition-repair-hint">
          {translate("ui.editorWorkspace.condition.repairBeforeBuilder")}
        </small>
      )}
      {diagnostics.length > 0 && (
        <div className="editor-field-diagnostics" id={diagnosticId}>
          {diagnostics.map((diagnostic, diagnosticIndex) => (
            <small
              className={`is-${diagnostic.severity}`}
              key={`${diagnostic.code}:${diagnosticIndex}`}
            >
              {translateDiagnostic(diagnostic)}
            </small>
          ))}
        </div>
      )}
      <div className="editor-condition-value">
        <span>{fieldLabel}</span>
        {richText && (
          <span className="editor-rich-text-toolbar">
            <InsertValueControl
              properties={properties}
              showDescriptions={showExplanatoryText}
              onInsert={(handle) =>
                insertAtSelection(
                  valueRef.current,
                  variant.value,
                  `{{${handle}}}`,
                  (value) => onUpdate(variant.condition, value),
                )
              }
            />
          </span>
        )}
        <VariantValueControl
          fieldLabel={fieldLabel}
          richText={richText}
          value={variant.value}
          onChange={(value) => onUpdate(variant.condition, value)}
          onBlur={onEndFieldEdit}
          textareaRef={valueRef}
        />
      </div>
      <footer>
        <button
          type="button"
          aria-label={translate("ui.editorWorkspace.condition.moveVariantUp", {
            number: index + 1,
          })}
          disabled={index === 0}
          onClick={() => onMove("up")}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={translate(
            "ui.editorWorkspace.condition.moveVariantDown",
            { number: index + 1 },
          )}
          disabled={index === count - 1}
          onClick={() => onMove("down")}
        >
          ↓
        </button>
        <button type="button" onClick={onRemove}>
          {translate("ui.editorWorkspace.condition.removeVariant")}
        </button>
      </footer>
    </article>
  );
}

export function ConditionalVariants({
  fieldName,
  fieldLabel,
  showExplanatoryText,
  baseOccurrence,
  variants,
  fieldType,
  properties,
  diagnostics,
  onUpdate,
  onMove,
  onEndFieldEdit,
}: {
  fieldName: string;
  fieldLabel: string;
  showExplanatoryText: boolean;
  baseOccurrence: number;
  variants: readonly ConditionalVariant[];
  fieldType?: string;
  properties: readonly ConditionPropertyDescriptor[];
  diagnostics: readonly PackageDiagnostic[];
  onUpdate: (
    occurrence: number,
    condition: string,
    value: string,
    baseOccurrence?: number,
  ) => void;
  onMove: (occurrence: number, direction: "up" | "down") => void;
  onEndFieldEdit: () => void;
}) {
  const [draft, setDraft] = useState(false);
  const matching = variants.filter(
    (variant) => variant.baseOccurrence === baseOccurrence,
  );
  return (
    <section className="editor-conditional-variants">
      <header>
        <strong>{translate("ui.editorWorkspace.condition.variants")}</strong>
        {showExplanatoryText && (
          <small>
            {translate("ui.editorWorkspace.condition.behaviorSummary", {
              field: fieldLabel,
            })}
          </small>
        )}
      </header>
      {matching.map((variant, index) => (
        <VariantEditor
          key={`${fieldName}:variant:${variant.occurrence}`}
          variant={variant}
          index={index}
          count={matching.length}
          fieldName={fieldName}
          fieldLabel={fieldLabel}
          richText={fieldType === "richText"}
          showExplanatoryText={showExplanatoryText}
          properties={properties}
          diagnostics={diagnostics.filter(
            (diagnostic) =>
              diagnostic.target?.field === fieldName &&
              diagnostic.target.part === "condition" &&
              (diagnostic.target.variantOccurrence ??
                diagnostic.target.occurrence) === variant.occurrence,
          )}
          onUpdate={(condition, value) =>
            onUpdate(variant.occurrence, condition, value)
          }
          onMove={(direction) => onMove(variant.occurrence, direction)}
          onRemove={() => onUpdate(variant.occurrence, "", "")}
          onEndFieldEdit={onEndFieldEdit}
        />
      ))}
      {draft && (
        <DraftRule
          properties={properties}
          variantDraft
          onCancel={() => setDraft(false)}
          onComplete={(rule) => {
            onUpdate(
              variants.length,
              visualRuleSource(rule),
              "",
              baseOccurrence,
            );
            setDraft(false);
          }}
        />
      )}
      <button type="button" disabled={draft} onClick={() => setDraft(true)}>
        {translate("ui.editorWorkspace.text.addConditionalVariant")}
      </button>
    </section>
  );
}
