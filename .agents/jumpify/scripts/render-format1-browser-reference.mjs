const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const titleCase = (value) =>
  value
    .replaceAll("-", " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const declarationDescriptions = {
  jump: "Defines package identity, authorship, the primary point budget, purchase policy, default layouts, and unconditional entry grants.",
  resource:
    "Defines an additional named budget that costs, discounts, and grants can reference throughout the package.",
  section:
    "Creates an ordered visible section and owns local text, images, choice placements, and choice sources.",
  "choice-source":
    "Names a source of section choices and controls how expanded members can be selected or rolled.",
  choice:
    "Defines an interactive purchasable choice at top level, or places an existing top-level choice inside a section.",
  text: "Defines rich authored copy in an owner-local namespace. Visible grants reserve the handle description for their ordinary description.",
  image:
    "Defines an authored image asset, accessible alternative text, and optional edge treatment in an owner-local namespace.",
  input:
    "Adds a secondary text, integer, or select control inside a choice and may own grants driven by its answer.",
  cost: "Charges one resource when a choice is active. The scalar form charges Jump points; the block form selects a resource and mode.",
  discount:
    "Makes an active choice discount a named choice group, optionally for selected resources only.",
  grant:
    "Projects a purchase or answer into the Chain Tracker as visible content, resources, identity properties, forms, or companion-owned content.",
  theme:
    "Defines one reusable package color token for authored appearance and layout fields.",
  "jump-appearance":
    "Sets the package-wide authored palette, spacing, corners, and component presentation without changing semantic controls.",
  "section-layout":
    "Names a reusable layout tree for a section and its choice placements.",
  "choice-layout":
    "Names a reusable layout tree for a choice, its content, and its semantic control slots.",
  "trait-layout":
    "Names a reusable layout tree for a trait grant and its owner-local text and images.",
};

const contextualDescriptions = {
  "jump.format":
    "Selects the package language version. Format 1 requires the integer 1.",
  "jump.name":
    "Sets the Jump title shown in package metadata and application surfaces.",
  "jump.description":
    "Sets the plain package summary used as metadata. This is not the visible-grant description text handle.",
  "jump.author":
    "Credits one author. Repeat the field once per distinct author; ordering is not semantic.",
  "jump.version":
    "Identifies the authored package version shown to users and used when comparing package revisions.",
  "jump.gauntlet": "Marks the Jump as a native Gauntlet.",
  "jump.starting-points":
    "Sets the starting amount of the implicit jump_points resource.",
  "jump.points-name": "Renames the implicit Jump point resource for display.",
  "jump.points-abbreviation":
    "Sets the short display label for the implicit Jump point resource.",
  "jump.discount-stacking":
    "Chooses whether simultaneous matching discounts use only the highest discount or stack together.",
  "jump.discount-floor":
    "Chooses whether discounts stop at zero or may turn a cost into an award.",
  "jump.section-layout": "Selects the default layout for Sections.",
  "jump.choice-layout": "Selects the default layout for Choices.",
  "jump.trait-layout": "Selects the default layout for trait grants.",
  "resource.handle":
    "Provides the stable package-local identifier used by costs, discounts, and grants. jump_points is reserved.",
  "resource.name": "Sets the resource's full display name.",
  "resource.abbreviation": "Sets the resource's compact display label.",
  "resource.initial": "Sets the balance available when the Jump begins.",
  "section.handle":
    "Provides the stable package-local identifier used by layouts and lock or unlock effects.",
  "section.name": "Sets the Section heading shown to the user.",
  "section.layout": "Overrides the Jump's default Section layout.",
  "section.locked":
    "Starts the Section locked. Lock and unlock effects can change the effective state while choices are active.",
  "choice-source.handle":
    "Provides the Section-local identifier used by an expand layout node.",
  "choice-source.group":
    "Includes top-level Choices carrying this authored group string in the source.",
  "choice-source.mode":
    "Chooses whether the expanded source allows one simultaneous member or multiple members.",
  "choice-source.max":
    "Caps simultaneous selections for a multi source. Omission means unlimited and does not imply a minimum.",
  "choice-source.resolution":
    "Adds random resolution, or lets the user choose between manual and random resolution.",
  "choice:top-level.handle":
    "Provides the stable package-wide identifier used by Section placements, layouts, and evaluated properties.",
  "choice:top-level.name": "Sets the Choice heading shown to the user.",
  "choice:top-level.layout": "Overrides the Jump's default Choice layout.",
  "choice:top-level.tag":
    "Adds authored semantic Tags to acquired content. The active User Tag profile owns badge appearance.",
  "choice:top-level.group":
    "Adds authored matching labels used by Choice Sources and discounts; it does not style the Choice.",
  "choice:top-level.selection":
    "Chooses the primary control: toggle, text, integer, select, or companion collection.",
  "choice:top-level.placeholder":
    "Provides empty-state guidance for controls that accept or select a value. Toggle Choices cannot use it.",
  "choice:top-level.continuity":
    "Seeds a gender select from the previous or original identity. It is valid only with one copied gender property grant.",
  "choice:top-level.min":
    "Sets the minimum integer answer or companion count. Companion selection defaults to one.",
  "choice:top-level.max":
    "Sets the maximum integer answer or companion count. Random integer resolution requires a finite minimum and maximum.",
  "choice:top-level.resolution":
    "Adds random resolution, or lets the user choose between manual and random resolution, for integer and select controls.",
  "choice:top-level.option":
    "Adds one ordered select option. Conditional option variants attach to the immediately preceding base option.",
  "choice:top-level.form":
    "Shorthand that assigns the Choice's single scalar perk grant to an existing form.",
  "choice:top-level.companion":
    "Shorthand that assigns the Choice's single scalar perk grant to an existing companion target.",
  "choice:top-level.measure":
    "Shorthand that makes the Choice's single scalar perk or item grant use rank or quantity for an integer answer.",
  "choice:top-level.lock":
    "Adds one positive lock contribution to each referenced Section while this Choice is active.",
  "choice:top-level.unlock":
    "Adds one negative lock contribution to each referenced Section while this Choice is active.",
  "choice:section.handle":
    "Names this owner-local placement so a Section layout can target it independently.",
  "choice:section.target":
    "References the top-level Choice definition rendered at this position.",
  "text.handle":
    "Names this owner-local text block. Under an ordinary visible grant it must be description.",
  "text.content":
    "Contains fenced rich text and may provide ordered conditional variants.",
  "image.handle": "Names this owner-local image for layout targeting.",
  "image.src":
    "References a graphical file below assets/ using a portable package-relative path.",
  "image.alt":
    "Provides accessible alternative text and supports conditional variants. Omission produces a warning.",
  "image.rounded-corners": "Enables authored rounded image clipping.",
  "image.fade-edges": "Enables an authored image-edge fade.",
  "image.rounded-intensity":
    "Sets rounded-corner strength from 1 through 100 when rounding is enabled.",
  "image.fade-intensity":
    "Sets edge-fade strength from 1 through 100 when fading is enabled.",
  "input.handle":
    "Names the owner-local answer so Choice text conditions and child grants can reference it.",
  "input.selection": "Chooses a text, integer, or select secondary control.",
  "input.placeholder": "Provides empty-state guidance for the input.",
  "input.min": "Sets the lower bound of an integer input.",
  "input.max": "Sets the upper bound of an integer input.",
  "input.option": "Adds one ordered option to a select input.",
  "cost.resource": "Selects the resource charged by the block cost form.",
  "cost.amount":
    "Sets the amount or named cost/award token applied by the cost.",
  "cost.mode":
    "Charges once with flat, or once per integer unit with each. each requires an explicit non-negative minimum.",
  "discount.group":
    "Selects the authored Choice group affected by this discount.",
  "discount.mode":
    "Chooses a flat numeric reduction or a percentage reduction.",
  "discount.amount": "Sets the non-negative discount amount.",
  "discount.resource":
    "Limits the discount to one or more resources. Omit it to affect every matching cost.",
  "grant.kind":
    "Selects the effect shape: visible content, form, companion, resource, trait, or property.",
  "grant.name":
    "Sets the displayed name of a visible grant and supports conditional variants.",
  "grant.layout": "Selects a trait layout; other grant kinds cannot use it.",
  "grant.tag":
    "Adds authored semantic Tags to visible acquired content. It never controls badge presentation.",
  "grant.resource": "Selects the resource changed by a resource grant.",
  "grant.amount":
    "Sets the signed amount or named magnitude added by a resource grant.",
  "grant.handle":
    "Provides the stable identity for form and companion grants, or names the property written by a property grant.",
  "grant.form": "Assigns a perk grant to a referenced form owner.",
  "grant.companion":
    "Assigns a perk or resource grant to a referenced companion owner.",
  "grant.measure":
    "Interprets an integer answer as rank or quantity for a perk, item, or trait grant.",
  "grant.value":
    "Writes an explicit string, integer, or boolean property value. Omit it to copy the owning control when that property's type permits it.",
  "theme.handle": "Names the reusable color token.",
  "theme.color": "Sets the token to an exact six-digit hexadecimal color.",
  "layout.target":
    "Selects the semantic slot or owner-local content that this leaf renders.",
  "layout.source": "Selects the Section-local Choice Source expanded here.",
  "layout.using": "Selects the Choice layout used for expanded source members.",
};

const layoutDescriptions = {
  gap: "Sets the space between children of a layout container.",
  padding:
    "Sets padding on every edge unless a directional field overrides it.",
  "padding-block": "Overrides padding on the block/start and block/end edges.",
  "padding-inline":
    "Overrides padding on the inline/start and inline/end edges.",
  grow: "Assigns a relative share of remaining space in the parent layout.",
  "column-span": "Spans this node across grid columns.",
  "row-span": "Spans this node across grid rows.",
  "min-width": "Sets a minimum authored width.",
  "min-height": "Sets a minimum authored height.",
  "aspect-ratio": "Preserves a width-to-height ratio for this node.",
  background: "Sets a solid authored background color.",
  "background-image": "Uses an owner-local image as the background layer.",
  "background-fit": "Controls how the background image fills or tiles its box.",
  align: "Aligns this node or its children on the cross axis.",
  justify: "Distributes children on the main axis.",
  "text-align": "Aligns text inside this layout node.",
  "text-size": "Sets the authored text size.",
  "font-family": "Selects a bounded application-provided font family.",
  "font-weight": "Sets the authored text weight.",
  "line-height": "Sets the authored line-height token.",
  "letter-spacing": "Sets the authored tracking token.",
  "text-color": "Sets the authored foreground text color.",
  "border-color": "Sets the authored border color.",
  "border-width": "Sets the border thickness.",
  "border-style": "Sets the border line style.",
  corners: "Sets the node corner-radius token.",
  clip: "Clips overflowing content to the node's bounds when true.",
  columns: "Sets the required number of grid columns.",
  "column-weight":
    "Sets one ordered relative column width; repeat for successive columns.",
  "control-adornments":
    "Shows or suppresses the application's semantic control adornments for this slot.",
  "control-density": "Selects standard or compact control presentation.",
  "cost-density": "Selects standard or compact Cost-slot presentation.",
  "list-marker": "Selects the marker used by rich-text unordered lists.",
  "list-indent": "Sets indentation for rich-text list items.",
  "list-gap": "Sets vertical space between rich-text list items.",
  size: "Sets both image dimensions unless width or height is used.",
  width: "Sets the authored image width.",
  height: "Sets the authored image height.",
  fit: "Controls how the image content fits its box.",
  color: "Sets the rule color.",
  thickness: "Sets rule thickness from 1 through 16.",
  style: "Selects a solid, dashed, or rounded rule.",
  orientation:
    "Draws a horizontal rule or a vertical rule stretched through an inline row.",
};

const appearanceRole = (name) =>
  `Sets the authored ${name.replaceAll("-", " ")} presentation token for the rendered Jump.`;

const lexicalTesters = {
  handlePattern: {
    label: "Try a handle",
    placeholder: "starter_choice",
    valid: "Matches the handle pattern.",
    invalid:
      "Use lowercase letters and digits, with single underscores between groups.",
  },
  integerPattern: {
    label: "Try an integer",
    placeholder: "-42",
    inputMode: "text",
    valid: "Matches the integer pattern.",
    invalid:
      "Use an optional minus sign and whole digits, without leading zeroes.",
  },
  hexColorPattern: {
    label: "Try a hex color",
    placeholder: "#D4AF37",
    valid: "Matches the six-digit hex color pattern.",
    invalid: "Use # followed by exactly six hexadecimal digits.",
    preview: true,
  },
};

const valueTesters = {
  tag: {
    label: "Try Tag syntax",
    placeholder: '"Physical_Powers"',
    intro:
      "Check bare or quoted Tag syntax and see the canonical identity used for matching.",
  },
  textSize: {
    label: "Try a text size",
    placeholder: "16px",
    intro: "Accepts named tokens, 8–512px, or .5–32rem.",
  },
  layoutDimension: {
    label: "Try a layout dimension",
    placeholder: "24rem",
    intro: "Accepts named tokens, 0–4096px, or 0–256rem.",
  },
  aspectRatio: {
    label: "Try an aspect ratio",
    placeholder: "16/9",
    intro: "Accepts two positive integers from 1 through 99 separated by /.",
  },
  imageDimension: {
    label: "Try an image dimension",
    placeholder: "320px",
    intro: "Accepts named tokens or a non-negative px/rem length.",
  },
  costAmount: {
    label: "Try a cost amount",
    placeholder: "add_small",
    intro: "Accepts an integer, cost token, or award token.",
  },
  grantAmount: {
    label: "Try a grant amount",
    placeholder: "large",
    intro: "Accepts an integer or grant token.",
  },
  propertyValue: {
    label: "Try a property value",
    placeholder: '"Kanto"',
    intro: "Accepts a quoted string, canonical integer, true, or false.",
  },
};

function renderValueTester(schema, name) {
  const tester = valueTesters[name];
  if (!tester) return "";
  const popoverId = `value-tester-${name}`;
  const inputId = `${popoverId}-input`;
  const statusId = `${popoverId}-status`;
  const tokens = [
    ...(schema.types[name]?.enum ?? []),
    ...(schema.types[name]?.costTokens ?? []),
    ...(schema.types[name]?.awardTokens ?? []),
    ...(schema.types[name]?.grantTokens ?? []),
  ];
  return `<div class="reference-tool-launch">
    <span>Check a value without leaving the reference.</span>
    <button class="value-tester-trigger" type="button" popovertarget="${popoverId}">Try a value</button>
  </div>
  <div class="reference-tool-popover value-tester" id="${popoverId}" popover="auto" data-value-tester data-value-type="${escapeHtml(name)}" data-value-tokens="${escapeHtml(JSON.stringify(tokens))}">
    <div class="reference-tool-heading">
      <div><span>Value checker</span><strong>${escapeHtml(titleCase(name))}</strong></div>
      <button type="button" popovertarget="${popoverId}" popovertargetaction="hide" aria-label="Close ${escapeHtml(titleCase(name).toLowerCase())} checker">×</button>
    </div>
    <p class="reference-tool-intro">${escapeHtml(tester.intro)}</p>
    <label for="${inputId}">${escapeHtml(tester.label)}</label>
    <div class="reference-tool-control">
      <input id="${inputId}" type="text" maxlength="160" placeholder="${escapeHtml(tester.placeholder)}" aria-describedby="${statusId}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <span class="reference-tool-mark" data-value-mark aria-hidden="true"></span>
    </div>
    <output id="${statusId}" class="reference-tool-status" data-value-status for="${inputId}" aria-live="polite">Enter a value to check.</output>
    ${name === "tag" ? '<div class="value-tester-canonical" data-value-canonical hidden><span>Canonical identity</span><code></code></div><p class="reference-tool-note">Canonicalization affects Tag identity only. The active User Tag profile owns all badge presentation.</p>' : ""}
  </div>`;
}

const lexicalLiteralRules = new Set([
  "encoding",
  "lineEnding",
  "handlePattern",
  "integerPattern",
  "hexColorPattern",
  "assetPathSeparator",
]);

function renderLexicalValue(name, value) {
  const displayed = displayValue(value);
  if (lexicalLiteralRules.has(name))
    return `<code>${escapeHtml(displayed)}</code>`;
  return `<span>${escapeHtml(displayed.charAt(0).toUpperCase() + displayed.slice(1))}</span>`;
}

function renderLexicalRule(name, value) {
  const tester = lexicalTesters[name];
  if (!tester)
    return `<div><dt>${escapeHtml(titleCase(name))}</dt><dd>${renderLexicalValue(name, value)}</dd></div>`;
  const inputId = `lexical-tester-${name}`;
  const statusId = `${inputId}-status`;
  const popoverId = `${inputId}-popover`;
  return `<div class="lexical-pattern-rule"><dt>${escapeHtml(titleCase(name))}</dt><dd class="lexical-pattern-value">
    <code>${escapeHtml(displayValue(value))}</code>
    <button class="lexical-tester-trigger" type="button" popovertarget="${popoverId}" aria-label="Test ${escapeHtml(titleCase(name).toLowerCase())}">Try</button>
    <div class="reference-tool-popover lexical-tester" id="${popoverId}" popover="auto" data-lexical-tester data-lexical-key="${escapeHtml(name)}" data-lexical-pattern="${escapeHtml(value)}" data-valid-message="${escapeHtml(tester.valid)}" data-invalid-message="${escapeHtml(tester.invalid)}">
      <div class="reference-tool-heading lexical-tester-heading">
        <div><span>Pattern tester</span><strong>${escapeHtml(titleCase(name))}</strong></div>
        <button type="button" popovertarget="${popoverId}" popovertargetaction="hide" aria-label="Close ${escapeHtml(titleCase(name).toLowerCase())} tester">×</button>
      </div>
      <code class="lexical-tester-pattern">${escapeHtml(displayValue(value))}</code>
      <label for="${inputId}">${escapeHtml(tester.label)}</label>
      <div class="reference-tool-control lexical-tester-control">
        <input id="${inputId}" type="text" inputmode="${escapeHtml(tester.inputMode ?? "text")}" maxlength="160" placeholder="${escapeHtml(tester.placeholder)}" aria-describedby="${statusId}" autocomplete="off" autocapitalize="off" spellcheck="false">
        ${tester.preview ? '<span class="lexical-color-preview" data-lexical-preview aria-hidden="true"></span>' : ""}
        <span class="reference-tool-mark lexical-tester-mark" data-lexical-mark aria-hidden="true"></span>
      </div>
      <output id="${statusId}" class="reference-tool-status lexical-tester-status" data-lexical-status for="${inputId}" aria-live="polite">Enter a value to test.</output>
    </div>
  </dd></div>`;
}

function describeField(owner, context, name) {
  const exact = contextualDescriptions[`${owner}:${context}.${name}`];
  if (exact) return exact;
  const ownerDescription = contextualDescriptions[`${owner}.${name}`];
  if (ownerDescription) return ownerDescription;
  if (owner === "jump-appearance") return appearanceRole(name);
  if (owner.startsWith("layout:"))
    return contextualDescriptions[`layout.${name}`] ?? layoutDescriptions[name];
  if (name === "handle")
    return "Provides the stable identifier used by references in this declaration's namespace.";
  if (name === "name")
    return "Sets the authored display name for this declaration.";
  if (name === "layout")
    return "Selects the reusable layout used by this declaration.";
  return `Configures ${name.replaceAll("-", " ")} for this context.`;
}

function resolveFields(schema, value) {
  if (typeof value === "string") return schema.fieldSets[value] ?? {};
  return value ?? {};
}

function mergedFields(schema, ...values) {
  return Object.assign(
    {},
    ...values.map((value) => resolveFields(schema, value)),
  );
}

function cardinality(rule) {
  if (rule.required) return "required";
  if (rule.repeatable) return "repeatable";
  return "optional";
}

function displayValue(value) {
  if (value === undefined) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function valueForm(schema, rule) {
  if (rule.const !== undefined) return displayValue(rule.const);
  if (rule.values) return rule.values.join(" | ");
  const typeName = String(rule.type ?? "block").split(":")[0];
  const type = schema.types[typeName] ?? {};
  if (type.enum) return type.enum.join(" | ");
  if (typeName === "quotedString" || typeName === "renderableScalar")
    return '"…"';
  if (typeName === "richText") return '""" … """';
  if (typeName === "boolean") return "true | false";
  if (typeName === "integer") return "integer";
  if (typeName === "tag") return 'tag or "tag"';
  if (typeName === "propertyValue") return '"…" | integer | true | false';
  if (type.oneOf) return type.oneOf.join(" | ");
  return rule.type ?? "nested block";
}

function ruleNotes(rule) {
  const notes = [];
  const defaultValue =
    rule.default ??
    rule.defaultForCompanionSelection ??
    rule.defaultForIntegerVisibleGrant;
  if (defaultValue !== undefined)
    notes.push(`default ${displayValue(defaultValue)}`);
  if (rule.minimum !== undefined) notes.push(`minimum ${rule.minimum}`);
  if (rule.maximum !== undefined) notes.push(`maximum ${rule.maximum}`);
  if (rule.appliesWhen)
    notes.push(
      `when ${Object.entries(rule.appliesWhen)
        .map(([field, values]) => `${field} is ${values.join(" or ")}`)
        .join(" and ")}`,
    );
  if (rule.requiredUnless) notes.push(`required unless ${rule.requiredUnless}`);
  if (rule.exclusiveWith)
    notes.push(`not with ${rule.exclusiveWith.join(" or ")}`);
  if (rule.conditionalVariants) notes.push("conditional variants allowed");
  if (rule.exportRequired) notes.push("required for export");
  if (rule.setLike) notes.push("duplicates collapse");
  if (rule.ordered) notes.push("source order matters");
  if (rule.reserved) notes.push(`reserves ${rule.reserved.join(", ")}`);
  if (rule.shorthandTarget) notes.push(`shorthand for ${rule.shorthandTarget}`);
  return notes;
}

function fieldRow(schema, owner, context, name, rule) {
  const notes = ruleNotes(rule);
  return `<div class="syntax-field" data-field-name="${escapeHtml(name)}">
    <div class="syntax-field-name"><code>${escapeHtml(name)}</code><span class="reference-badge">${cardinality(rule)}</span></div>
    <p>${escapeHtml(describeField(owner, context, name))}</p>
    <dl class="syntax-facts">
      <div><dt>Value</dt><dd><code>${escapeHtml(valueForm(schema, rule))}</code></dd></div>
      <div><dt>Type</dt><dd><code>${escapeHtml(rule.type ?? "block")}</code></dd></div>
      ${notes.length ? `<div><dt>Rules</dt><dd>${escapeHtml(notes.join(" · "))}</dd></div>` : ""}
    </dl>
  </div>`;
}

function searchText(...values) {
  return values
    .flat(Infinity)
    .filter(Boolean)
    .join(" ")
    .replaceAll('"', "&quot;");
}

function declarationForms(schema, name, definition) {
  const baseFields = resolveFields(
    schema,
    definition.fields ?? definition.fieldSet,
  );
  const baseChildren = definition.children ?? {};
  if (definition.formsByContext) {
    const contexts = new Set([
      ...(definition.contexts ?? []),
      ...Object.keys(definition.formsByContext),
    ]);
    return [...contexts].map((context) => {
      const form = definition.formsByContext[context] ?? {};
      return {
        label: context,
        context,
        fields: {
          ...baseFields,
          ...resolveFields(schema, form.fields ?? form.fieldSet),
        },
        children: { ...baseChildren, ...(form.children ?? {}) },
      };
    });
  }
  if (definition.forms)
    return Object.entries(definition.forms).map(([label, form]) => ({
      label: `${label} form`,
      context: definition.contexts?.join(", ") ?? "context-specific",
      scalar: label === "scalar" ? form : null,
      fields: resolveFields(schema, form.fields ?? form.fieldSet),
      children: form.children ?? {},
    }));
  return [
    {
      label: definition.contexts?.join(", ") ?? "all contexts",
      context: definition.contexts?.join(", ") ?? "context-specific",
      fields: baseFields,
      children: baseChildren,
    },
  ];
}

function compactExample(schema, name, form) {
  if (form.scalar) return `${name}: ${valueForm(schema, form.scalar)}`;
  const required = Object.entries(form.fields).filter(
    ([, rule]) => rule.required,
  );
  const representative =
    required.length > 0 ? required : Object.entries(form.fields).slice(0, 2);
  if (representative.length === 0) return name;
  return `${name}\n${representative
    .map(([field, rule]) => `  ${field}: ${valueForm(schema, rule)}`)
    .join("\n")}`;
}

function exampleValue(schema, owner, fieldName, rule) {
  const declaredDefault =
    rule.const ??
    rule.default ??
    rule.defaultForCompanionSelection ??
    rule.defaultForIntegerVisibleGrant;
  if (declaredDefault !== undefined) return displayValue(declaredDefault);
  if (rule.values?.length) return displayValue(rule.values[0]);

  const typeName = String(rule.type ?? "").split(":")[0];
  const type = schema.types[typeName] ?? {};
  if (type.enum?.length) return displayValue(type.enum[0]);
  if (typeName === "integer") return String(Math.max(0, rule.minimum ?? 0));
  if (typeName === "boolean") return "false";
  if (typeName === "handle" || typeName === "handleReference")
    return `${owner.replaceAll(/[^a-z0-9]+/g, "_")}_example`;
  if (typeName === "tag") return '"example tag"';
  if (typeName === "hexColor" || typeName === "color") return "#D4AF37";
  if (typeName === "costAmount" || typeName === "grantAmount") return "0";
  if (typeName === "propertyValue") return '"Example"';
  if (typeName === "richText") return '"Example text."';
  if (fieldName === "version") return '"1.0.0"';
  if (fieldName === "author") return '"Example Author"';
  if (fieldName === "src") return '"assets/example.png"';
  if (fieldName === "alt") return '"Example image"';
  if (fieldName === "abbreviation") return '"EX"';
  if (fieldName === "name") return `"Example ${titleCase(owner)}"`;
  if (
    typeName === "textSize" ||
    typeName === "layoutDimension" ||
    typeName === "imageDimension"
  )
    return "md";
  if (typeName === "aspectRatio") return "16/9";
  if (typeName === "quotedString" || typeName === "renderableScalar")
    return '"Example"';
  return "example";
}

function skeletonFieldIsSelectable(rule) {
  return !(
    rule.required ||
    rule.appliesWhen ||
    rule.requiredUnless ||
    rule.exclusiveWith
  );
}

function renderSkeletonForm(schema, declaration, definition, form, index) {
  const fields = Object.entries(form.fields).filter(
    ([, rule]) => rule.required || skeletonFieldIsSelectable(rule),
  );
  const omittedCount = Object.keys(form.fields).length - fields.length;
  const fieldMarkup = fields
    .map(([name, rule]) => {
      const required = Boolean(rule.required);
      return `<label class="declaration-builder-field" data-skeleton-field-option>
        <input type="checkbox" data-skeleton-field data-skeleton-field-name="${escapeHtml(name)}" data-skeleton-field-value="${escapeHtml(exampleValue(schema, declaration, name, rule))}"${required ? " checked disabled" : ""}>
        <span><code>${escapeHtml(name)}</code><small>${required ? "required" : cardinality(rule)}</small></span>
      </label>`;
    })
    .join("");
  const rootNode = definition.root
    ? schema.roots[definition.root]?.allowed?.[0]
    : null;
  return `<section class="declaration-builder-form" data-skeleton-form="${index}" data-skeleton-declaration="${escapeHtml(declaration)}"${form.scalar ? ` data-skeleton-scalar="${escapeHtml(exampleValue(schema, declaration, declaration, form.scalar))}"` : ""}${rootNode ? ` data-skeleton-root="${escapeHtml(rootNode)}"` : ""}${index === 0 ? "" : " hidden"}>
    ${fieldMarkup ? `<div class="declaration-builder-field-list">${fieldMarkup}</div>` : '<p class="reference-tool-empty">This form has no selectable fields.</p>'}
    ${omittedCount ? `<p class="declaration-builder-note">${omittedCount} context-dependent field${omittedCount === 1 ? " is" : "s are"} kept out of the builder so the starting point stays unambiguous. See the field list below for those forms.</p>` : ""}
  </section>`;
}

function renderDeclarationBuilder(schema, name, definition, forms) {
  const popoverId = `declaration-builder-${name}`;
  const contextId = `${popoverId}-context`;
  const searchId = `${popoverId}-search`;
  return `<button class="declaration-builder-trigger" type="button" popovertarget="${popoverId}">Build example</button>
    <div class="reference-tool-popover declaration-builder" id="${popoverId}" popover="auto" data-declaration-builder>
      <div class="reference-tool-heading">
        <div><span>Declaration builder</span><strong><code>${escapeHtml(name)}</code></strong></div>
        <button type="button" popovertarget="${popoverId}" popovertargetaction="hide" aria-label="Close ${escapeHtml(name)} declaration builder">×</button>
      </div>
      <p class="reference-tool-intro">Start with required fields, then add unconditional optional fields. Context-dependent combinations stay in the full field reference below.</p>
      <div class="declaration-builder-controls">
        <label for="${contextId}">Form or context</label>
        <select id="${contextId}" data-skeleton-context>${forms.map((form, index) => `<option value="${index}">${escapeHtml(form.label)}</option>`).join("")}</select>
        <label for="${searchId}">Find an optional field</label>
        <input id="${searchId}" type="search" data-skeleton-search placeholder="Filter fields" autocomplete="off" spellcheck="false">
      </div>
      <div class="declaration-builder-forms">${forms.map((form, index) => renderSkeletonForm(schema, name, definition, form, index)).join("")}</div>
      <p class="declaration-builder-empty" data-skeleton-empty hidden>No fields match that filter.</p>
      <div class="syntax-example declaration-builder-output"><pre><code data-skeleton-output></code></pre><button type="button" data-copy-code>Copy</button></div>
    </div>`;
}

function childrenList(children) {
  const rows = Object.entries(children);
  if (rows.length === 0) return "";
  return `<div class="reference-children"><h4>Allowed children</h4><ul>${rows
    .map(([name, rule]) => {
      const notes = [
        rule.repeatable ? "repeatable" : null,
        rule.ordered ? "ordered" : null,
        rule.appliesWhen
          ? `when ${Object.entries(rule.appliesWhen)
              .map(([field, values]) => `${field} is ${values.join(" or ")}`)
              .join(" and ")}`
          : null,
      ].filter(Boolean);
      return `<li><code>${escapeHtml(name)}</code>${notes.length ? ` <span>— ${escapeHtml(notes.join(", "))}</span>` : ""}</li>`;
    })
    .join("")}</ul></div>`;
}

function renderDeclarations(schema) {
  return Object.entries(schema.declarations)
    .map(([name, definition]) => {
      const forms = declarationForms(schema, name, definition);
      const formMarkup = forms
        .map(
          (
            form,
          ) => `<section class="reference-form" aria-labelledby="reference-${name}-${form.label.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}">
            <div class="reference-form-heading">
              <h4 id="reference-${name}-${form.label.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}">${escapeHtml(form.label)}</h4>
              <span>${escapeHtml(form.context)}</span>
            </div>
            <div class="syntax-example"><pre><code>${escapeHtml(compactExample(schema, name, form))}</code></pre><button type="button" data-copy-code>Copy</button></div>
            ${Object.entries(form.fields)
              .map(([field, rule]) =>
                fieldRow(schema, name, form.label, field, rule),
              )
              .join("")}
            ${childrenList(form.children)}
          </section>`,
        )
        .join("");
      return `<details class="reference-entry" id="declaration-${name}" data-reference-entry data-reference-kind="declaration" data-reference-label="${escapeHtml(name)}" data-reference-search="${searchText(
        name,
        declarationDescriptions[name],
        forms.map((form) => Object.keys(form.fields)),
      )}">
        <summary><span><span class="reference-kind">Declaration</span><code>${escapeHtml(name)}</code></span><span>${escapeHtml(declarationDescriptions[name])}</span></summary>
        <div class="reference-entry-body">
          <div class="reference-purpose-tools"><p class="reference-purpose">${escapeHtml(declarationDescriptions[name])}</p>${renderDeclarationBuilder(schema, name, definition, forms)}</div>
          ${formMarkup}
        </div>
      </details>`;
    })
    .join("");
}

function collectFieldUses(schema) {
  const fields = new Map();
  const add = (name, use) => {
    const existing = fields.get(name) ?? [];
    existing.push(use);
    fields.set(name, existing);
  };
  for (const [owner, definition] of Object.entries(schema.declarations))
    for (const form of declarationForms(schema, owner, definition))
      for (const [name, rule] of Object.entries(form.fields))
        add(name, {
          owner,
          context: form.label,
          rule,
          description: describeField(owner, form.label, name),
        });
  for (const [nodeName, node] of Object.entries(schema.layoutNodes)) {
    const fieldsForNode = mergedFields(
      schema,
      node.fields,
      node.blockFields,
      node.additionalFields,
    );
    for (const [name, rule] of Object.entries(fieldsForNode))
      add(name, {
        owner: `layout:${nodeName}`,
        context: node.kind,
        rule,
        description: describeField(`layout:${nodeName}`, node.kind, name),
      });
  }
  return [...fields.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function renderFieldIndex(schema) {
  return collectFieldUses(schema)
    .map(([name, uses]) => {
      const grouped = new Map();
      for (const use of uses) {
        const key = JSON.stringify({
          rule: use.rule,
          description: use.description,
        });
        const group = grouped.get(key) ?? { ...use, owners: [] };
        group.owners.push(
          `${use.owner.replace("layout:", "layout ")} · ${use.context}`,
        );
        grouped.set(key, group);
      }
      return `<details class="reference-entry field-reference-entry" id="field-${name}" data-reference-entry data-reference-kind="field" data-reference-label="${escapeHtml(name)}" data-reference-search="${searchText(
        name,
        uses.map((use) => [
          use.owner,
          use.context,
          use.description,
          valueForm(schema, use.rule),
        ]),
      )}">
        <summary><span><span class="reference-kind">Field</span><code>${escapeHtml(name)}</code></span><span>${uses.length} context${uses.length === 1 ? "" : "s"}</span></summary>
        <div class="reference-entry-body field-uses">
          ${[...grouped.values()]
            .map(
              (group) => `<section class="field-use">
                <p class="field-use-context">${group.owners.map((owner) => `<span>${escapeHtml(owner)}</span>`).join("")}</p>
                <p>${escapeHtml(group.description)}</p>
                <dl class="syntax-facts">
                  <div><dt>Value</dt><dd><code>${escapeHtml(valueForm(schema, group.rule))}</code></dd></div>
                  <div><dt>Cardinality</dt><dd>${cardinality(group.rule)}</dd></div>
                  ${ruleNotes(group.rule).length ? `<div><dt>Rules</dt><dd>${escapeHtml(ruleNotes(group.rule).join(" · "))}</dd></div>` : ""}
                </dl>
              </section>`,
            )
            .join("")}
        </div>
      </details>`;
    })
    .join("");
}

function renderTypes(schema) {
  return Object.entries(schema.types)
    .map(
      ([
        name,
        rule,
      ]) => `<details class="reference-entry" id="type-${name}" data-reference-entry data-reference-kind="type" data-reference-label="${escapeHtml(name)}" data-reference-search="${searchText(name, JSON.stringify(rule))}">
        <summary><span><span class="reference-kind">Value type</span><code>${escapeHtml(name)}</code></span><span>${escapeHtml(rule.syntax ?? rule.oneOf?.join(" or ") ?? "bounded value")}</span></summary>
        <div class="reference-entry-body">${renderValueTester(schema, name)}<dl class="schema-rule-list">${Object.entries(
          rule,
        )
          .map(
            ([key, value]) =>
              `<div><dt>${escapeHtml(titleCase(key))}</dt><dd>${escapeHtml(displayValue(value))}</dd></div>`,
          )
          .join("")}</dl></div>
      </details>`,
    )
    .join("");
}

function renderLayouts(schema) {
  return Object.entries(schema.layoutNodes)
    .map(([name, node]) => {
      const fields = mergedFields(
        schema,
        node.fields,
        node.blockFields,
        node.additionalFields,
      );
      const syntax = node.compact ?? `${name}\n  …`;
      const restrictions = Object.entries(node).filter(
        ([key]) =>
          ![
            "kind",
            "fields",
            "blockFields",
            "additionalFields",
            "compact",
          ].includes(key),
      );
      return `<details class="reference-entry" id="layout-${name}" data-reference-entry data-reference-kind="layout" data-reference-label="${escapeHtml(name)}" data-reference-search="${searchText(name, node.kind, Object.keys(fields), JSON.stringify(restrictions))}">
        <summary><span><span class="reference-kind">Layout node</span><code>${escapeHtml(name)}</code></span><span>${escapeHtml(node.kind)}</span></summary>
        <div class="reference-entry-body">
          <div class="syntax-example"><pre><code>${escapeHtml(syntax)}</code></pre><button type="button" data-copy-code>Copy</button></div>
          ${
            restrictions.length
              ? `<dl class="schema-rule-list">${restrictions
                  .map(
                    ([key, value]) =>
                      `<div><dt>${escapeHtml(titleCase(key))}</dt><dd>${escapeHtml(displayValue(value))}</dd></div>`,
                  )
                  .join("")}</dl>`
              : ""
          }
          ${Object.entries(fields)
            .map(([field, rule]) =>
              fieldRow(schema, `layout:${name}`, node.kind, field, rule),
            )
            .join("")}
        </div>
      </details>`;
    })
    .join("");
}

function renderFiles(schema) {
  return Object.entries(schema.files)
    .map(
      ([name, rule]) => `<article class="file-card">
        <div><code>${escapeHtml(name)}</code>${rule.required ? '<span class="reference-badge">required</span>' : '<span class="reference-badge">optional</span>'}</div>
        <p>${escapeHtml(rule.topLevel.join(", "))}</p>
      </article>`,
    )
    .join("");
}

export function renderFormat1BrowserReference(schema) {
  return `<section class="reference-section reference-files" id="package-files" aria-labelledby="package-files-heading" data-reference-group="overview">
    <div class="reference-section-heading"><div><p class="reference-kicker">Start here</p><h2 id="package-files-heading">Files and lexical rules</h2></div><p>Definitions are UTF-8, use LF line endings and two-space indentation, and accept full-line <code>#</code> comments.</p></div>
    <div class="file-card-grid">${renderFiles(schema)}</div>
    <details class="reference-entry" id="lexical-rules" data-reference-entry data-reference-kind="overview" data-reference-label="Lexical rules" data-reference-search="lexical indentation comments handles integers colors paths fields">
      <summary><span><span class="reference-kind">Foundation</span>Lexical rules</span><span>${Object.keys(schema.lexical).length} rules</span></summary>
      <div class="reference-entry-body"><dl class="schema-rule-list">${Object.entries(
        schema.lexical,
      )
        .map(([name, value]) => renderLexicalRule(name, value))
        .join("")}</dl></div>
    </details>
  </section>
  <section class="reference-section" id="declarations" aria-labelledby="declarations-heading" data-reference-group="declaration">
    <div class="reference-section-heading"><div><p class="reference-kicker">Structure and behavior</p><h2 id="declarations-heading">Declarations</h2></div><p>Open a declaration to see every valid context, field form, child, default, and restriction.</p></div>
    <div class="reference-entry-list">${renderDeclarations(schema)}</div>
  </section>
  <section class="reference-section" id="fields" aria-labelledby="fields-heading" data-reference-group="field">
    <div class="reference-section-heading"><div><p class="reference-kicker">Alphabetical lookup</p><h2 id="fields-heading">Field index</h2></div><p>Same-named fields are grouped here with their context-specific meanings kept separate.</p></div>
    <div class="reference-entry-list">${renderFieldIndex(schema)}</div>
  </section>
  <section class="reference-section" id="layouts" aria-labelledby="layouts-heading" data-reference-group="layout">
    <div class="reference-section-heading"><div><p class="reference-kicker">Authored presentation</p><h2 id="layouts-heading">Layout nodes</h2></div><p>Layout chooses where semantic content appears. The application still owns controls and User Tag presentation.</p></div>
    <div class="reference-entry-list">${renderLayouts(schema)}</div>
  </section>
  <section class="reference-section" id="types" aria-labelledby="types-heading" data-reference-group="type">
    <div class="reference-section-heading"><div><p class="reference-kicker">Accepted values</p><h2 id="types-heading">Value types</h2></div><p>Exact tokens, bounded forms, placeholder support, and canonicalization rules.</p></div>
    <div class="reference-entry-list">${renderTypes(schema)}</div>
  </section>
  <section class="reference-section" id="semantic-constraints" aria-labelledby="semantic-constraints-heading" data-reference-group="rule">
    <div class="reference-section-heading"><div><p class="reference-kicker">Cross-field rules</p><h2 id="semantic-constraints-heading">Semantic constraints</h2></div><p>These rules apply after individual declarations and fields are structurally valid.</p></div>
    <div class="constraint-list">${schema.semanticConstraints
      .map(
        ({ code, rule }) =>
          `<article class="constraint-card" id="rule-${escapeHtml(code)}" data-reference-entry data-reference-kind="rule" data-reference-label="${escapeHtml(code)}" data-reference-search="${searchText(code, rule)}"><code>${escapeHtml(code)}</code><p>${escapeHtml(rule)}</p></article>`,
      )
      .join("")}</div>
  </section>`;
}
