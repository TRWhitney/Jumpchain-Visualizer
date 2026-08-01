import type {
  CanonicalJumpPackage,
  DiagnosticSeverity,
  PackageDiagnostic,
  PackageValidationOptions,
  ParsedFormatFile,
  SourceField,
  SourceNode,
  JumpLayout,
} from "./model";
import {
  conditionComparisons,
  conditionExpressionSubsumes,
  conditionPropertyOperands,
  parseConditionExpression,
  type ConditionOperand,
} from "./conditionExpression";
import {
  collectConditionProperties,
  conditionControlProperties,
  conditionContextHandles,
} from "./conditionProperties";
import {
  layoutNodeSupportsTextStyling,
  layoutNodeUsesControlAlignment,
} from "./layoutSemantics";
import {
  format1HandlePattern as handlePattern,
  format1IntegerPattern as integerPattern,
  format1SchemaDefinition as schema,
  type ChildRule,
  type FieldRule,
} from "./format1Schema";
import { closestSuggestion } from "./closestSuggestion";

const unquote = (value: string) =>
  value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;

const optionValueIsEmpty = (raw: string) => {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"'))
    try {
      return String(JSON.parse(value)).trim().length === 0;
    } catch {
      return value.slice(1, -1).trim().length === 0;
    }
  return value.length === 0;
};

const normalizedContext = (parent: SourceNode | undefined) => {
  if (!parent) return "top-level";
  if (parent.kind !== "grant") return parent.kind;
  const kind = parent.fields.find((field) => field.name === "kind");
  return `grant:${kind ? unquote(kind.value) : ""}`;
};

function rulesFor(node: SourceNode, parent: SourceNode | undefined) {
  const inLayout = Boolean(
    parent &&
    (parent.kind.endsWith("-layout") ||
      ["stack", "inline", "wrap", "grid"].includes(parent.kind)),
  );
  const layout = schema.layoutNodes[node.kind];
  if (layout && inLayout) {
    const sharedFields =
      typeof layout.fields === "string"
        ? schema.fieldSets[layout.fields]
        : layout.fields;
    return {
      declaration: undefined,
      fields: Object.assign(
        {},
        sharedFields,
        layout.blockFields ? schema.fieldSets[layout.blockFields] : {},
        layout.additionalFields,
      ) as Record<string, FieldRule>,
      children: layout.children === false ? {} : schema.layoutNodes,
      context: parent?.kind ?? "layout",
      layout: true,
    };
  }
  const declaration = schema.declarations[node.kind];
  if (declaration) {
    const context = normalizedContext(parent);
    const form = declaration.formsByContext?.[context];
    return {
      declaration,
      fields: Object.assign(
        {},
        declaration.fieldSet ? schema.fieldSets[declaration.fieldSet] : {},
        declaration.fields,
        declaration.forms?.block?.fields,
        form?.fields,
      ) as Record<string, FieldRule>,
      children: Object.assign(
        {},
        declaration.children,
        declaration.forms?.block?.children,
        form?.children,
      ),
      context,
      layout: false,
    };
  }
  if (!layout) return null;
  const sharedFields =
    typeof layout.fields === "string"
      ? schema.fieldSets[layout.fields]
      : layout.fields;
  return {
    declaration: undefined,
    fields: Object.assign(
      {},
      sharedFields,
      layout.blockFields ? schema.fieldSets[layout.blockFields] : {},
      layout.additionalFields,
    ) as Record<string, FieldRule>,
    children: layout.children === false ? {} : schema.layoutNodes,
    context: parent?.kind ?? "layout",
    layout: true,
  };
}

function fieldTarget(node: SourceNode, field?: SourceField, occurrence = 0) {
  return {
    file: node.range.file,
    declarationFrom: node.range.from,
    field: field?.name,
    occurrence,
    part: field ? ("value" as const) : ("declaration" as const),
  };
}

function scalarRange(node: SourceNode) {
  const scalar = node.scalar ?? "";
  const to = node.range.to;
  return {
    ...node.range,
    column: Math.max(
      node.range.column,
      node.range.column + node.kind.length + 2,
    ),
    from: Math.max(node.range.from, to - scalar.length),
    to,
  };
}

function add(
  diagnostics: PackageDiagnostic[],
  code: string,
  parameters: Record<string, string | number>,
  node: SourceNode,
  field?: SourceField,
  occurrence = 0,
  severity: DiagnosticSeverity = "error",
  targetField?: string,
) {
  diagnostics.push({
    code,
    severity,
    messageKey: `diagnostics.${code}`,
    parameters,
    range: field?.valueRange ?? node.range,
    target: {
      ...fieldTarget(node, field, occurrence),
      field: targetField ?? field?.name,
    },
  });
}

function valueIsValid(
  type: string | undefined,
  raw: string,
  rule: FieldRule,
  sourceField?: SourceField,
) {
  const value = unquote(raw);
  if (!type) return true;
  if (type === "handle" || type.startsWith("handleReference:"))
    return handlePattern.test(value);
  if (type === "integer") return integerPattern.test(value);
  if (type === "boolean") return raw === "true" || raw === "false";
  if (type === "enum")
    return [...(rule.values ?? []), rule.default]
      .filter((item): item is string | number | boolean => item !== undefined)
      .map(String)
      .includes(value);
  if (type === "hexColor") return /^"?#[0-9a-f]{6}"?$/i.test(raw);
  if (type === "color")
    return (
      /^"?#[0-9a-f]{6}"?$/i.test(raw) ||
      (schema.types.color?.builtInTokens ?? []).includes(value) ||
      handlePattern.test(value)
    );
  if (type === "imageDimension")
    return (
      (schema.types.imageDimension?.enum ?? []).includes(value) ||
      /^(?:0|[1-9][0-9]*(?:\.[0-9]+)?|0\.[0-9]+)(?:px|rem)$/.test(value)
    );
  const enumValues = schema.types[type]?.enum?.map(String);
  if (enumValues) return enumValues.includes(value);
  if (type === "costAmount" || type === "grantAmount") {
    const definition = schema.types[type];
    return (
      integerPattern.test(value) ||
      [
        ...(definition?.costTokens ?? []),
        ...(definition?.awardTokens ?? []),
        ...(definition?.grantTokens ?? []),
      ].includes(value)
    );
  }
  if (type === "propertyValue")
    return (
      integerPattern.test(value) ||
      raw === "true" ||
      raw === "false" ||
      (raw.startsWith('"') && raw.endsWith('"'))
    );
  if (type === "richText")
    return (
      Boolean(sourceField?.fenced) || (raw.startsWith('"') && raw.endsWith('"'))
    );
  if (
    type === "quotedString" ||
    type.startsWith("quotedString:") ||
    type === "renderableScalar"
  ) {
    if (!raw.startsWith('"') || !raw.endsWith('"')) return false;
    if (type === "quotedString:assetRelativePath") {
      const path = unquote(raw);
      const segments = path.split("/");
      return (
        Boolean(path) &&
        !path.includes("\\") &&
        !path.startsWith("/") &&
        segments.every(
          (segment) => Boolean(segment) && segment !== "." && segment !== "..",
        ) &&
        !/^(?:[a-z]+:|\/)/i.test(path) &&
        /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(path)
      );
    }
    return true;
  }
  return true;
}

function typeLabel(type: string | undefined) {
  if (!type) return "supported value";
  if (type.startsWith("handleReference:")) return "handle reference";
  return type;
}

function validateNode(
  node: SourceNode,
  parent: SourceNode | undefined,
  diagnostics: PackageDiagnostic[],
  layoutKind?: string,
) {
  const resolved = rulesFor(node, parent);
  if (!resolved) {
    const candidates = parent
      ? Object.keys(rulesFor(parent, undefined)?.children ?? {})
      : Object.keys(schema.declarations);
    const proposed = closestSuggestion(node.kind, candidates);
    add(
      diagnostics,
      proposed
        ? "schema.declaration.unknownSuggested"
        : "schema.declaration.unknown",
      { declaration: node.kind, suggestion: proposed ?? "" },
      node,
    );
    return;
  }

  const owningLayout = node.kind.endsWith("-layout") ? node.kind : layoutKind;
  const layoutRule = schema.layoutNodes[node.kind];
  if (
    resolved.layout &&
    owningLayout &&
    layoutRule?.allowedLayouts &&
    !layoutRule.allowedLayouts.includes(owningLayout)
  )
    add(
      diagnostics,
      "layout.node.context",
      { node: node.kind, layout: owningLayout },
      node,
    );

  if (node.scalar !== undefined) {
    const scalarRule = resolved.declaration?.forms?.scalar;
    if (!scalarRule && !layoutRule?.compact)
      diagnostics.push({
        code: "schema.declaration.scalar",
        severity: "error",
        messageKey: "diagnostics.schema.declaration.scalar",
        parameters: { declaration: node.kind },
        range: scalarRange(node),
        target: {
          file: node.range.file,
          declarationFrom: node.range.from,
          part: "value",
        },
      });
    else if (
      scalarRule &&
      !valueIsValid(scalarRule.type, node.scalar, scalarRule)
    )
      diagnostics.push({
        code: "schema.value.type",
        severity: "error",
        messageKey: "diagnostics.schema.value.type",
        parameters: {
          field: node.kind,
          value: unquote(node.scalar),
          expected: typeLabel(scalarRule.type),
        },
        range: scalarRange(node),
        target: {
          file: node.range.file,
          declarationFrom: node.range.from,
          part: "value",
        },
      });
    if (layoutRule?.compact && owningLayout) {
      const layoutName = owningLayout.replace("-layout", "");
      const allowedTargets = layoutRule.targetsByLayout?.[layoutName];
      if (allowedTargets && !allowedTargets.includes(unquote(node.scalar)))
        diagnostics.push({
          code: "layout.slot.target",
          severity: "error",
          messageKey: "diagnostics.layout.slot.target",
          parameters: { target: unquote(node.scalar), layout: owningLayout },
          range: scalarRange(node),
          target: {
            file: node.range.file,
            declarationFrom: node.range.from,
            part: "value",
          },
        });
    }
  }

  if (
    resolved.declaration?.contexts &&
    !resolved.declaration.contexts.includes(resolved.context)
  )
    add(
      diagnostics,
      "schema.declaration.context",
      { declaration: node.kind, context: resolved.context },
      node,
    );

  const compactLayoutChildren = resolved.layout
    ? Object.keys(schema.layoutNodes).filter(
        (kind) => schema.layoutNodes[kind].compact,
      )
    : [];
  const scalarChildren = Object.keys(resolved.children).filter(
    (kind) => schema.declarations[kind]?.forms?.scalar,
  );
  const knownFields = [
    ...Object.keys(resolved.fields),
    ...compactLayoutChildren,
    ...scalarChildren,
  ];
  for (const sourceField of node.fields) {
    if (compactLayoutChildren.includes(sourceField.name)) {
      const compactRule = schema.layoutNodes[sourceField.name];
      if (
        !handlePattern.test(unquote(sourceField.value)) &&
        sourceField.name !== "slot"
      )
        add(
          diagnostics,
          "schema.value.handleReference",
          { field: sourceField.name, value: unquote(sourceField.value) },
          node,
          sourceField,
        );
      if (
        owningLayout &&
        compactRule.allowedLayouts &&
        !compactRule.allowedLayouts.includes(owningLayout)
      )
        add(
          diagnostics,
          "layout.node.context",
          { node: sourceField.name, layout: owningLayout },
          node,
          sourceField,
        );
      const allowedTargets = owningLayout
        ? compactRule.targetsByLayout?.[owningLayout.replace("-layout", "")]
        : undefined;
      if (
        allowedTargets &&
        !allowedTargets.includes(unquote(sourceField.value))
      )
        add(
          diagnostics,
          "layout.slot.target",
          { target: unquote(sourceField.value), layout: owningLayout ?? "" },
          node,
          sourceField,
        );
      continue;
    }
    const slotTarget = unquote(
      node.fields.find((field) => field.name === "target")?.value ?? "",
    );
    if (
      node.kind === "slot" &&
      ((["text-size", "text-color"].includes(sourceField.name) &&
        !layoutNodeSupportsTextStyling(node.kind, slotTarget)) ||
        (sourceField.name === "control-adornments" &&
          !layoutNodeUsesControlAlignment(node.kind, slotTarget)))
    ) {
      const occurrence = node.fields
        .filter((candidate) => candidate.name === sourceField.name)
        .indexOf(sourceField);
      add(
        diagnostics,
        "schema.field.unknown",
        {
          field: sourceField.name,
          declaration: node.kind,
          suggestion: "",
        },
        node,
        sourceField,
        occurrence,
      );
      continue;
    }
    const rule =
      resolved.fields[sourceField.name] ??
      schema.declarations[sourceField.name]?.forms?.scalar;
    const occurrence = node.fields
      .filter((candidate) => candidate.name === sourceField.name)
      .indexOf(sourceField);
    if (!rule) {
      const proposed = closestSuggestion(sourceField.name, knownFields);
      add(
        diagnostics,
        proposed ? "schema.field.unknownSuggested" : "schema.field.unknown",
        {
          field: sourceField.name,
          declaration: node.kind,
          suggestion: proposed ?? "",
        },
        node,
        sourceField,
        occurrence,
      );
      continue;
    }
    if (
      sourceField.condition &&
      !schema.conditionalFields.allowed.includes(sourceField.name)
    )
      add(
        diagnostics,
        "schema.field.condition",
        { field: sourceField.name },
        node,
        sourceField,
        occurrence,
      );
    if (sourceField.condition && sourceField.name === "option") {
      const optionFields = node.fields.slice(
        0,
        node.fields.indexOf(sourceField),
      );
      let lastDifferentField = -1;
      for (let index = optionFields.length - 1; index >= 0; index -= 1)
        if (optionFields[index].name !== "option") {
          lastDifferentField = index;
          break;
        }
      const optionGroup = optionFields.slice(lastDifferentField + 1);
      if (!optionGroup.some((candidate) => !candidate.condition))
        add(
          diagnostics,
          "schema.field.optionAssociation",
          {},
          node,
          sourceField,
          occurrence,
        );
    }
    if (!valueIsValid(rule.type, sourceField.value, rule, sourceField))
      add(
        diagnostics,
        rule.type === "handle"
          ? "schema.value.handle"
          : rule.type?.startsWith("handleReference:")
            ? "schema.value.handleReference"
            : "schema.value.type",
        {
          field: sourceField.name,
          value: unquote(sourceField.value),
          expected: typeLabel(rule.type),
        },
        node,
        sourceField,
        occurrence,
      );
    if (
      rule.const !== undefined &&
      unquote(sourceField.value) !== String(rule.const)
    )
      add(
        diagnostics,
        "schema.value.const",
        { field: sourceField.name, expected: String(rule.const) },
        node,
        sourceField,
        occurrence,
      );
    if (
      rule.type === "integer" &&
      integerPattern.test(unquote(sourceField.value))
    ) {
      const numeric = Number(unquote(sourceField.value));
      const minimum = rule.minimum;
      const maximum = rule.maximum;
      if (
        (minimum !== undefined && numeric < minimum) ||
        (maximum !== undefined && numeric > maximum)
      )
        add(
          diagnostics,
          "schema.value.bounds",
          {
            field: sourceField.name,
            minimum: minimum ?? "",
            maximum: maximum ?? "",
          },
          node,
          sourceField,
          occurrence,
        );
    }
  }

  for (const [name, rule] of Object.entries(resolved.fields)) {
    const matching = node.fields.filter(
      (candidate) => candidate.name === name && !candidate.condition,
    );
    if (
      (rule.required || (rule.min ?? 0) > 0) &&
      !matching.some((item) => unquote(item.value).trim())
    )
      add(
        diagnostics,
        "schema.field.required",
        { declaration: node.kind, field: name },
        node,
        undefined,
        0,
        "error",
        name,
      );
    if ((rule.max ?? (rule.repeatable ? Infinity : 1)) < matching.length)
      matching
        .slice(rule.max ?? 1)
        .forEach((duplicate, index) =>
          add(
            diagnostics,
            "schema.field.duplicate",
            { declaration: node.kind, field: name },
            node,
            duplicate,
            (rule.max ?? 1) + index,
          ),
        );
    if (rule.exactDuplicate) {
      const seen = new Set<string>();
      for (const [occurrence, candidate] of matching.entries()) {
        const normalized = unquote(candidate.value);
        if (seen.has(normalized))
          add(
            diagnostics,
            "schema.field.exactDuplicate",
            { field: name, value: normalized },
            node,
            candidate,
            occurrence,
          );
        seen.add(normalized);
      }
    }
    if (
      rule.exclusiveWith?.some((other) =>
        node.fields.some((item) => item.name === other),
      ) &&
      matching.length
    )
      add(
        diagnostics,
        "schema.field.exclusive",
        {
          field: name,
          other:
            rule.exclusiveWith.find((other) =>
              node.fields.some((item) => item.name === other),
            ) ?? "",
        },
        node,
        matching[0],
      );
  }

  for (const child of node.children) {
    const layoutRoot =
      node.kind.endsWith("-layout") && schema.layoutNodes[child.kind];
    const childRule = resolved.children[child.kind] as ChildRule | undefined;
    const childApplies =
      childRule &&
      Object.entries(childRule.appliesWhen ?? {}).every(([field, allowed]) =>
        allowed.includes(
          unquote(
            node.fields.find((candidate) => candidate.name === field)?.value ??
              "",
          ),
        ),
      );
    if (
      !resolved.layout &&
      !layoutRoot &&
      (!Object.hasOwn(resolved.children, child.kind) || !childApplies)
    )
      add(
        diagnostics,
        "schema.child.invalid",
        { child: child.kind, declaration: node.kind },
        child,
      );
    validateNode(child, node, diagnostics, owningLayout);
  }

  if (!resolved.layout)
    for (const [kind, childRule] of Object.entries(
      resolved.children as Record<string, ChildRule>,
    )) {
      if (
        !Object.entries(childRule.appliesWhen ?? {}).every(([field, allowed]) =>
          allowed.includes(
            unquote(
              node.fields.find((candidate) => candidate.name === field)
                ?.value ?? "",
            ),
          ),
        )
      )
        continue;
      const matching = node.children.filter((child) => child.kind === kind);
      if ((childRule.min ?? 0) > matching.length)
        add(
          diagnostics,
          "schema.child.required",
          { child: kind, declaration: node.kind },
          node,
        );
      const maximum = childRule.max ?? (childRule.repeatable ? Infinity : 1);
      for (const duplicate of matching.slice(maximum))
        add(
          diagnostics,
          "schema.child.cardinality",
          { child: kind, declaration: node.kind },
          duplicate,
        );
      if (childRule.ownerLocalHandleNamespace) {
        const seen = new Set<string>();
        for (const child of matching) {
          const handle = child.fields.find((field) => field.name === "handle");
          if (!handle) continue;
          const identity = unquote(handle.value);
          if (seen.has(identity))
            add(
              diagnostics,
              "schema.handle.duplicate",
              {
                handle: identity,
                namespace: childRule.ownerLocalHandleNamespace,
              },
              child,
              handle,
            );
          seen.add(identity);
        }
      }
    }
}

function fieldRules(node: SourceNode, parent: SourceNode | undefined) {
  return rulesFor(node, parent)?.fields ?? {};
}

function walk(
  nodes: readonly SourceNode[],
  ancestors: readonly SourceNode[] = [],
): {
  node: SourceNode;
  parent?: SourceNode;
  ancestors: readonly SourceNode[];
}[] {
  return nodes.flatMap((node) => [
    { node, parent: ancestors.at(-1), ancestors },
    ...walk(node.children, [...ancestors, node]),
  ]);
}

function validateReferences(
  parsed: readonly ParsedFormatFile[],
  diagnostics: PackageDiagnostic[],
  options: PackageValidationOptions,
) {
  const entries = parsed.flatMap((file) => walk(file.tree));
  const namespaces = new Map<string, Set<string>>();
  for (const kind of [
    "resource",
    "section",
    "choice",
    "section-layout",
    "choice-layout",
    "trait-layout",
  ])
    namespaces.set(
      kind,
      new Set(
        entries
          .filter(({ node, parent }) => !parent && node.kind === kind)
          .flatMap(({ node }) => {
            const handle = node.fields.find((field) => field.name === "handle");
            return handle ? [unquote(handle.value)] : [];
          }),
      ),
    );
  namespaces.get("resource")?.add("jump_points");
  const forms = new Set<string>();
  const companions = new Set<string>();
  for (const { node, parent } of entries.filter(
    ({ node }) => node.kind === "grant",
  )) {
    const kind = unquote(
      node.fields.find((field) => field.name === "kind")?.value ??
        node.scalar ??
        "",
    );
    const handle = node.fields.find((field) => field.name === "handle");
    if (handle && kind === "form") forms.add(unquote(handle.value));
    if (handle && kind === "companion") companions.add(unquote(handle.value));
    if (!handle && kind === "companion" && parent?.kind === "choice") {
      const ownerHandle = parent.fields.find(
        (field) => field.name === "handle",
      );
      if (ownerHandle) companions.add(unquote(ownerHandle.value));
    }
  }
  for (const { node } of entries.filter(
    ({ node, parent }) => !parent && node.kind === "choice",
  )) {
    const ownerHandle = node.fields.find((field) => field.name === "handle");
    if (
      ownerHandle &&
      unquote(
        node.fields.find((field) => field.name === "selection")?.value ?? "",
      ) === "companions"
    )
      companions.add(unquote(ownerHandle.value));
    if (
      node.fields.some(
        (field) =>
          field.name === "grant" && unquote(field.value) === "companion",
      )
    ) {
      if (ownerHandle) companions.add(unquote(ownerHandle.value));
    }
  }
  namespaces.set("form", forms);
  namespaces.set("companionTarget", companions);
  namespaces.set(
    "theme",
    new Set(
      entries
        .filter(({ node }) => node.kind === "theme")
        .flatMap(({ node }) => {
          const handle = node.fields.find((field) => field.name === "handle");
          return handle ? [unquote(handle.value)] : [];
        }),
    ),
  );

  for (const { node, parent } of entries) {
    const rules = fieldRules(node, parent);
    for (const sourceField of node.fields) {
      const type = rules[sourceField.name]?.type;
      if (type === "color") {
        const color = unquote(sourceField.value);
        if (
          handlePattern.test(color) &&
          !(schema.types.color?.builtInTokens ?? []).includes(color) &&
          !namespaces.get("theme")?.has(color)
        )
          add(
            diagnostics,
            "color.reference",
            { value: color },
            node,
            sourceField,
            node.fields
              .filter((field) => field.name === sourceField.name)
              .indexOf(sourceField),
            options.profile === "editor" ? "warning" : "error",
          );
        continue;
      }
      if (!type?.startsWith("handleReference:")) continue;
      const namespace = type.slice("handleReference:".length);
      const value = unquote(sourceField.value);
      if (!handlePattern.test(value)) continue;
      const known = namespaces.get(namespace);
      if (!known || known.has(value)) continue;
      add(
        diagnostics,
        "reference.unresolved",
        { field: sourceField.name, value, namespace },
        node,
        sourceField,
        node.fields
          .filter((field) => field.name === sourceField.name)
          .indexOf(sourceField),
        options.profile === "editor" ? "warning" : "error",
      );
      const added = diagnostics.at(-1)!;
      added.messageKey = "diagnostics.reference.unresolved";
      added.code =
        node.kind === "expand" && sourceField.name === "using"
          ? "layout.expand.using"
          : namespace === "resource"
            ? "resource.reference"
            : namespace === "form"
              ? "grant.form.reference"
              : namespace === "companionTarget"
                ? "grant.companion.reference"
                : namespace.endsWith("-layout")
                  ? "layout.reference"
                  : namespace === "choice"
                    ? "section.choice.target"
                    : "reference.unresolved";
    }
  }
}

function validateAuthoringWarnings(
  parsed: readonly ParsedFormatFile[],
  packageItem: Omit<CanonicalJumpPackage, "diagnostics">,
  diagnostics: PackageDiagnostic[],
  options: PackageValidationOptions,
) {
  const entries = parsed.flatMap((file) => walk(file.tree));
  const assetPaths = new Set(options.assetPaths ?? []);
  const directlyReferencedChoices = new Set(
    packageItem.sections.flatMap((section) =>
      section.directChoices.map((choice) => choice.target),
    ),
  );
  for (const { node, parent } of entries) {
    const layoutContentNode = Boolean(
      parent && ["stack", "inline", "wrap", "grid"].includes(parent.kind),
    );
    if (node.kind === "text" && !layoutContentNode) {
      const content = node.fields.filter((field) => field.name === "content");
      if (!content.some((field) => unquote(field.value).trim()))
        add(
          diagnostics,
          "text.empty",
          {},
          node,
          content[0],
          0,
          "warning",
          "content",
        );
    }
    if (node.kind === "image" && !layoutContentNode) {
      const src = node.fields.find((field) => field.name === "src");
      const alt = node.fields.find((field) => field.name === "alt");
      if (!src || !unquote(src.value).trim())
        add(
          diagnostics,
          "image.src.missing",
          {},
          node,
          src,
          0,
          options.profile === "editor" ? "warning" : "error",
          "src",
        );
      else if (
        options.assetPaths !== undefined &&
        !assetPaths.has(unquote(src.value))
      )
        add(
          diagnostics,
          "image.asset.missing",
          { path: unquote(src.value) },
          node,
          src,
          0,
          options.profile === "editor" ? "warning" : "error",
        );
      if (
        options.warnings?.missingImageAlt !== false &&
        (!alt || !unquote(alt.value).trim())
      )
        add(
          diagnostics,
          "image.alt.missing",
          {},
          node,
          alt,
          0,
          "warning",
          "alt",
        );
    }
    if (["stack", "inline", "wrap", "grid"].includes(node.kind)) {
      const compactChildren = node.fields.some(
        (field) => schema.layoutNodes[field.name]?.compact,
      );
      if (!node.children.length && !compactChildren)
        add(
          diagnostics,
          "layout.container.empty",
          {},
          node,
          undefined,
          0,
          "warning",
        );
    }
    if (node.kind === "choice") {
      const topLevel = parsed.some((file) => file.tree.includes(node));
      const handle = node.fields.find(
        (field) => field.name === "handle",
      )?.value;
      if (
        topLevel &&
        !node.fields.some((field) => field.name === "group") &&
        !directlyReferencedChoices.has(unquote(handle ?? ""))
      )
        add(
          diagnostics,
          "choice.group.missing",
          {},
          node,
          undefined,
          0,
          "warning",
          "group",
        );
    }
  }

  for (const section of packageItem.sections) {
    const sectionNode = entries.find(
      ({ node }) =>
        node.kind === "section" &&
        node.fields.some(
          (field) =>
            field.name === "handle" && unquote(field.value) === section.handle,
        ),
    )?.node;
    if (!sectionNode) continue;
    for (const source of section.sources) {
      const sourceNode = sectionNode.children.find(
        (child) =>
          child.kind === "choice-source" &&
          child.fields.some(
            (field) =>
              field.name === "handle" && unquote(field.value) === source.handle,
          ),
      );
      if (!sourceNode) continue;
      const groupField = sourceNode.fields.find(
        (field) => field.name === "group",
      );
      if (!source.group)
        add(
          diagnostics,
          "choiceSource.group.missing",
          { source: source.handle },
          sourceNode,
          groupField,
          0,
          "warning",
          "group",
        );
      else if (
        handlePattern.test(source.group) &&
        !packageItem.choices.some((choice) =>
          choice.groups.includes(source.group!),
        )
      )
        add(
          diagnostics,
          "choiceSource.empty",
          { source: source.handle, group: source.group },
          sourceNode,
          groupField,
          0,
          "warning",
        );
    }
  }

  if (options.warnings?.missingLayoutTargets !== false) {
    const layoutNodes = new Map<string, SourceNode>();
    const layoutKey = (kind: JumpLayout["kind"], handle: string) =>
      `${kind}\0${handle}`;
    for (const { node } of entries.filter(({ node }) =>
      node.kind.endsWith("-layout"),
    )) {
      const handle = node.fields.find((field) => field.name === "handle");
      if (handle)
        layoutNodes.set(
          layoutKey(node.kind as JumpLayout["kind"], unquote(handle.value)),
          node,
        );
    }
    const consumers = new Map<
      string,
      {
        layout: string;
        owners: {
          label: string;
          owner: SourceNode;
          handles: Record<string, Set<string>>;
        }[];
      }
    >();
    const addConsumer = (
      layoutKind: JumpLayout["kind"],
      layout: string | undefined,
      label: string,
      owner: SourceNode | undefined,
    ) => {
      if (!layout || !owner) return;
      const handles: Record<string, Set<string>> = {
        text: new Set(),
        image: new Set(),
        input: new Set(),
        choice: new Set(),
        "choice-source": new Set(),
      };
      for (const child of owner.children) {
        const handle = child.fields.find((field) => field.name === "handle");
        if (handle && handles[child.kind])
          handles[child.kind].add(unquote(handle.value));
      }
      const key = layoutKey(layoutKind, layout);
      const current = consumers.get(key) ?? { layout, owners: [] };
      current.owners.push({ label, owner, handles });
      consumers.set(key, current);
    };
    for (const section of packageItem.sections) {
      const owner = entries.find(
        ({ node, parent }) =>
          !parent &&
          node.kind === "section" &&
          node.fields.some(
            (field) =>
              field.name === "handle" &&
              unquote(field.value) === section.handle,
          ),
      )?.node;
      addConsumer(
        "section-layout",
        section.layout ?? packageItem.defaultSectionLayout,
        `section ${section.handle}`,
        owner,
      );
    }
    for (const choice of packageItem.choices) {
      const owner = entries.find(
        ({ node, parent }) =>
          !parent &&
          node.kind === "choice" &&
          node.fields.some(
            (field) =>
              field.name === "handle" && unquote(field.value) === choice.handle,
          ),
      )?.node;
      addConsumer(
        "choice-layout",
        choice.layout ?? packageItem.defaultChoiceLayout,
        `choice ${choice.handle}`,
        owner,
      );
    }
    for (const { node } of entries) {
      if (node.kind !== "grant") continue;
      const kind = node.fields.find((field) => field.name === "kind");
      if (!kind || unquote(kind.value) !== "trait") continue;
      const layout = node.fields.find((field) => field.name === "layout");
      const ownerChoice = entries.find(
        ({ node: candidate }) =>
          candidate.kind === "choice" &&
          candidate.range.file === node.range.file &&
          candidate.range.from <= node.range.from &&
          candidate.range.to >= node.range.to,
      )?.node;
      const choiceHandle = ownerChoice?.fields.find(
        (field) => field.name === "handle",
      );
      addConsumer(
        "trait-layout",
        layout ? unquote(layout.value) : packageItem.defaultTraitLayout,
        `trait ${choiceHandle ? unquote(choiceHandle.value) : "grant"}`,
        node,
      );
    }
    for (const [key, { layout: layoutHandle, owners }] of consumers) {
      const declaration = layoutNodes.get(key);
      if (!declaration) continue;
      const placedInputs = new Set(
        walk(declaration.children).flatMap(({ node }) => [
          ...(node.kind === "input"
            ? node.fields
                .filter((field) => field.name === "target")
                .map((field) => unquote(field.value))
            : []),
          ...node.fields
            .filter((field) => field.name === "input")
            .map((field) => unquote(field.value)),
        ]),
      );
      for (const owner of owners)
        for (const child of owner.owner.children.filter(
          (candidate) => candidate.kind === "input",
        )) {
          const handle = child.fields.find((field) => field.name === "handle");
          if (handle && !placedInputs.has(unquote(handle.value)))
            add(
              diagnostics,
              "layout.input.unreachable",
              {
                input: unquote(handle.value),
                layout: layoutHandle,
              },
              child,
              handle,
              0,
              "warning",
            );
        }
      for (const { node } of walk(declaration.children)) {
        if (["text", "image", "input"].includes(node.kind)) {
          const target = node.fields.find((field) => field.name === "target");
          if (target) {
            const value = unquote(target.value);
            for (const owner of owners)
              if (!owner.handles[node.kind].has(value))
                add(
                  diagnostics,
                  "layout.typedTarget.missing",
                  { kind: node.kind, target: value, owner: owner.label },
                  node,
                  target,
                  0,
                  "warning",
                );
          }
        }
        const background = node.fields.find(
          (field) => field.name === "background-image",
        );
        if (!background) continue;
        const value = unquote(background.value);
        for (const owner of owners)
          if (!owner.handles.image.has(value))
            add(
              diagnostics,
              "layout.typedTarget.missing",
              { kind: "image", target: value, owner: owner.label },
              node,
              background,
              0,
              "warning",
            );
      }
      const compact = walk(declaration.children).flatMap(({ node }) =>
        node.fields
          .filter((field) => ["text", "image", "input"].includes(field.name))
          .map((field) => ({ node, field })),
      );
      for (const { node, field } of compact) {
        const value = unquote(field.value);
        for (const owner of owners)
          if (!owner.handles[field.name].has(value))
            add(
              diagnostics,
              "layout.typedTarget.missing",
              { kind: field.name, target: value, owner: owner.label },
              node,
              field,
              0,
              "warning",
            );
      }
      const expanded = walk(declaration.children).flatMap(({ node }) =>
        node.kind === "expand"
          ? [
              {
                node,
                source: node.fields.find(
                  (candidate) => candidate.name === "source",
                ),
              },
            ]
          : [],
      );
      for (const { node, source } of expanded)
        for (const owner of owners) {
          if (!source && owner.handles["choice-source"].size !== 1)
            add(
              diagnostics,
              "layout.expand.ambiguous",
              { layout: layoutHandle, owner: owner.label },
              node,
              undefined,
              0,
              options.profile === "editor" ? "warning" : "error",
              "source",
            );
          else if (
            source &&
            !owner.handles["choice-source"].has(unquote(source.value))
          )
            add(
              diagnostics,
              "layout.expand.source",
              { source: unquote(source.value), owner: owner.label },
              node,
              source,
              0,
              options.profile === "editor" ? "warning" : "error",
            );
        }
      const placed = walk(declaration.children).flatMap(({ node }) =>
        node.fields
          .filter((candidate) => candidate.name === "choice")
          .map((candidate) => ({ node, field: candidate })),
      );
      for (const { node, field: choiceField } of placed)
        for (const owner of owners)
          if (!owner.handles.choice.has(unquote(choiceField.value)))
            add(
              diagnostics,
              "layout.choice.target",
              { target: unquote(choiceField.value), owner: owner.label },
              node,
              choiceField,
              0,
              options.profile === "editor" ? "warning" : "error",
            );
    }
  }

  if (parsed.some((file) => file.file === "choices.jdef"))
    for (const node of parsed.find((file) => file.file === "jump.jdef")?.tree ??
      [])
      if (node.kind === "choice")
        add(
          diagnostics,
          "file.choice.mixed",
          {},
          node,
          undefined,
          0,
          "warning",
        );
  if (parsed.some((file) => file.file === "layout.jdef"))
    for (const node of parsed.find((file) => file.file === "jump.jdef")?.tree ??
      [])
      if (
        [
          "jump-appearance",
          "theme",
          "section-layout",
          "choice-layout",
          "trait-layout",
        ].includes(node.kind)
      )
        add(
          diagnostics,
          "file.layout.mixed",
          {},
          node,
          undefined,
          0,
          "warning",
        );
}

const canonicalTag = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s_\p{Pd}]+/gu, " ")
    .trim();

function validateConditionsAndPlaceholders(
  entries: readonly {
    node: SourceNode;
    parent?: SourceNode;
    ancestors?: readonly SourceNode[];
  }[],
  diagnostics: PackageDiagnostic[],
  options: PackageValidationOptions,
) {
  const propertyCatalog = collectConditionProperties(entries);
  const globalProperties = new Map(
    propertyCatalog
      .filter((property) => property.category !== "context")
      .map((property) => [property.handle, property.type]),
  );
  const severity = options.profile === "editor" ? "warning" : "error";
  const rangeWithinCondition = (
    sourceField: SourceField,
    from: number,
    to: number,
  ) => {
    const conditionRange = sourceField.conditionRange ?? sourceField.range;
    return {
      ...conditionRange,
      column: conditionRange.column + from,
      from: conditionRange.from + from,
      to: conditionRange.from + Math.max(from + 1, to),
    };
  };
  const operandType = (
    properties: ReadonlyMap<string, string>,
    operand: ConditionOperand,
  ) =>
    operand.kind === "property"
      ? properties.get(operand.handle)
      : operand.valueType;
  for (const { node, parent, ancestors } of entries) {
    const properties = new Map(globalProperties);
    for (const handle of conditionContextHandles(node, parent, ancestors))
      properties.set(handle, "integer");
    for (const property of conditionControlProperties(node, parent, ancestors))
      properties.set(property.handle, property.type);
    const variantOccurrences = new Map<string, number>();
    const baseOccurrences = new Map<string, number>();
    const priorConditions = new Map<
      string,
      {
        source: string;
        expression: NonNullable<
          ReturnType<typeof parseConditionExpression>["expression"]
        >;
      }[]
    >();
    for (const sourceField of node.fields) {
      if (sourceField.condition) {
        const variantOccurrence = variantOccurrences.get(sourceField.name) ?? 0;
        variantOccurrences.set(sourceField.name, variantOccurrence + 1);
        const baseOccurrence = Math.max(
          0,
          (baseOccurrences.get(sourceField.name) ?? 0) - 1,
        );
        const target = {
          ...fieldTarget(node, sourceField, variantOccurrence),
          baseOccurrence,
          variantOccurrence,
          part: "condition" as const,
        };
        const parsed = parseConditionExpression(sourceField.condition);
        if (!parsed.expression) {
          const firstError = parsed.errors[0] ?? {
            from: 0,
            to: sourceField.condition.length,
          };
          diagnostics.push({
            code: "condition.syntax",
            severity: "error",
            messageKey: "diagnostics.condition.syntax",
            parameters: { condition: sourceField.condition },
            range: rangeWithinCondition(
              sourceField,
              firstError.from,
              firstError.to,
            ),
            target,
          });
        } else {
          for (const operand of conditionPropertyOperands(parsed.expression)) {
            if (properties.has(operand.handle)) continue;
            diagnostics.push({
              code: "condition.property.unresolved",
              severity,
              messageKey: "diagnostics.condition.property.unresolved",
              parameters: { property: operand.handle },
              range: rangeWithinCondition(
                sourceField,
                operand.from,
                operand.to,
              ),
              target,
            });
          }
          for (const comparison of conditionComparisons(parsed.expression)) {
            const propertyOperand =
              comparison.left.kind === "property"
                ? comparison.left
                : comparison.right.kind === "property"
                  ? comparison.right
                  : undefined;
            if (!propertyOperand) continue;
            const propertyType = properties.get(propertyOperand.handle);
            const comparedType =
              comparison.left === propertyOperand
                ? operandType(properties, comparison.right)
                : operandType(properties, comparison.left);
            if (
              !propertyType ||
              !comparedType ||
              propertyType === "unknown" ||
              comparedType === "unknown"
            )
              continue;
            if (
              propertyType !== comparedType ||
              (["<", "<=", ">", ">="].includes(comparison.operator) &&
                propertyType !== "integer")
            ) {
              diagnostics.push({
                code: "condition.type",
                severity: "error",
                messageKey: "diagnostics.condition.type",
                parameters: {
                  property: propertyOperand.handle,
                  propertyType,
                  literalType: comparedType,
                  operator: comparison.operator,
                },
                range: rangeWithinCondition(
                  sourceField,
                  comparison.from,
                  comparison.to,
                ),
                target,
              });
            }
          }
          const conditionGroup = `${sourceField.name}:${baseOccurrence}`;
          const prior = priorConditions.get(conditionGroup) ?? [];
          const shadowing = prior.find((candidate) =>
            conditionExpressionSubsumes(
              candidate.expression,
              parsed.expression!,
            ),
          );
          if (shadowing)
            diagnostics.push({
              code: "condition.shadowed",
              severity: "warning",
              messageKey: "diagnostics.condition.shadowed",
              parameters: { condition: shadowing.source },
              range: sourceField.conditionRange ?? sourceField.range,
              target,
            });
          prior.push({
            source: sourceField.condition,
            expression: parsed.expression,
          });
          priorConditions.set(conditionGroup, prior);
        }
      } else {
        baseOccurrences.set(
          sourceField.name,
          (baseOccurrences.get(sourceField.name) ?? 0) + 1,
        );
      }
      const type = fieldRules(node, parent)[sourceField.name]?.type;
      const allowsPlaceholders =
        type === "renderableScalar" ||
        type === "richText" ||
        type === "quotedString";
      for (const match of unquote(sourceField.value).matchAll(
        /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi,
      )) {
        const property = match[1];
        if (!allowsPlaceholders) {
          add(
            diagnostics,
            "placeholder.field.invalid",
            { field: sourceField.name },
            node,
            sourceField,
            node.fields
              .filter((field) => field.name === sourceField.name)
              .indexOf(sourceField),
          );
          continue;
        }
        if (properties.has(property)) continue;
        const occurrence = node.fields
          .filter((field) => field.name === sourceField.name)
          .indexOf(sourceField);
        const quotedOffset = sourceField.value.startsWith('"') ? 1 : 0;
        const from = quotedOffset + (match.index ?? 0);
        diagnostics.push({
          code: "placeholder.property.unresolved",
          severity,
          messageKey: "diagnostics.placeholder.property.unresolved",
          parameters: { property },
          range: sourceField.fenced
            ? sourceField.valueRange
            : {
                ...sourceField.valueRange,
                column: sourceField.valueRange.column + from,
                from: sourceField.valueRange.from + from,
                to: sourceField.valueRange.from + from + match[0].length,
              },
          target: fieldTarget(node, sourceField, occurrence),
        });
      }
    }
  }
}

function validateSemanticFields(
  parsed: readonly ParsedFormatFile[],
  diagnostics: PackageDiagnostic[],
  options: PackageValidationOptions,
) {
  const entries = parsed.flatMap((file) => walk(file.tree));
  for (const { node, parent } of entries) {
    if (node.kind === "jump") {
      const authors = node.fields.filter((field) => field.name === "author");
      const seen = new Set<string>();
      for (const author of authors) {
        const identity = unquote(author.value)
          .normalize("NFKC")
          .toLocaleLowerCase();
        if (seen.has(identity))
          add(
            diagnostics,
            "jump.author.duplicate",
            { author: unquote(author.value) },
            node,
            author,
          );
        seen.add(identity);
      }
    }
    if (node.kind === "choice") {
      const selection = unquote(
        node.fields.find((field) => field.name === "selection")?.value ??
          "toggle",
      );
      const optionsFields = node.fields.filter(
        (field) => field.name === "option",
      );
      const placeholder = node.fields.find(
        (field) => field.name === "placeholder",
      );
      if (
        placeholder &&
        !["text", "integer", "select", "companions"].includes(selection)
      )
        add(diagnostics, "choice.placeholder.domain", {}, node, placeholder);
      if (selection !== "select" && optionsFields.length)
        for (const option of optionsFields)
          add(diagnostics, "choice.option.domain", {}, node, option);
      optionsFields.forEach((option, occurrence) => {
        if (optionValueIsEmpty(option.value))
          add(
            diagnostics,
            "option.empty",
            {},
            node,
            option,
            occurrence,
            "warning",
          );
      });
      if (
        selection === "select" &&
        !optionsFields.some((option) => !optionValueIsEmpty(option.value))
      )
        add(
          diagnostics,
          "choice.select.options",
          {},
          node,
          undefined,
          0,
          "warning",
          "option",
        );
      const minimum = node.fields.find((field) => field.name === "min");
      const maximum = node.fields.find((field) => field.name === "max");
      if (
        selection === "companions" &&
        maximum &&
        (!integerPattern.test(unquote(maximum.value)) ||
          Number(unquote(maximum.value)) <= 0)
      )
        add(
          diagnostics,
          "choice.companions.max",
          {},
          node,
          maximum,
          0,
          "error",
          "max",
        );
      const resolvedMinimum =
        selection === "companions" && !minimum
          ? 1
          : minimum && integerPattern.test(unquote(minimum.value))
            ? Number(unquote(minimum.value))
            : undefined;
      const resolvedMaximum =
        selection === "companions" && !maximum
          ? 1
          : maximum && integerPattern.test(unquote(maximum.value))
            ? Number(unquote(maximum.value))
            : undefined;
      if (
        selection === "companions" &&
        resolvedMinimum !== undefined &&
        resolvedMaximum !== undefined &&
        resolvedMinimum > resolvedMaximum
      )
        add(diagnostics, "choice.companions.bounds", {}, node, maximum);
      if (
        selection === "companions" &&
        node.fields.some(
          (field) =>
            field.name === "grant" && unquote(field.value) === "companion",
        )
      )
        add(
          diagnostics,
          "choice.companions.shorthand",
          {},
          node,
          node.fields.find(
            (field) =>
              field.name === "grant" && unquote(field.value) === "companion",
          ),
        );
      const groups = node.fields.filter((field) => field.name === "group");
      const groupSet = new Set<string>();
      for (const group of groups) {
        const value = unquote(group.value);
        if (!handlePattern.test(value))
          add(diagnostics, "choice.group.invalid", { value }, node, group);
        if (groupSet.has(value))
          add(diagnostics, "choice.group.duplicate", { value }, node, group);
        groupSet.add(value);
      }
      const costs = node.children.filter((child) => child.kind === "cost");
      const seenResources = new Set<string>();
      for (const cost of node.fields.filter((field) => field.name === "cost")) {
        if (seenResources.has("jump_points"))
          add(
            diagnostics,
            "cost.unique_resource",
            { resource: "jump_points" },
            node,
            cost,
            node.fields.filter((field) => field.name === "cost").indexOf(cost),
          );
        seenResources.add("jump_points");
      }
      for (const cost of costs) {
        const resource = cost.scalar
          ? "jump_points"
          : unquote(
              cost.fields.find((field) => field.name === "resource")?.value ??
                "",
            );
        if (!resource) continue;
        if (seenResources.has(resource)) {
          const resourceField = cost.fields.find(
            (field) => field.name === "resource",
          );
          if (resourceField)
            add(
              diagnostics,
              "cost.unique_resource",
              { resource },
              cost,
              resourceField,
            );
          else
            diagnostics.push({
              code: "cost.unique_resource",
              severity: "error",
              messageKey: "diagnostics.cost.unique_resource",
              parameters: { resource },
              range: scalarRange(cost),
              target: {
                file: cost.range.file,
                declarationFrom: cost.range.from,
                part: "value",
              },
            });
        }
        seenResources.add(resource);
      }
    }
    if (node.kind === "section") {
      const directTargets = node.children
        .filter((child) => child.kind === "choice")
        .flatMap((child) => {
          const target = child.fields.find((field) => field.name === "target");
          return target ? [{ child, target }] : [];
        });
      const seenTargets = new Set<string>();
      for (const { child, target } of directTargets) {
        const identity = unquote(target.value);
        if (seenTargets.has(identity))
          add(
            diagnostics,
            "section.choice.target.unique",
            { target: identity },
            child,
            target,
          );
        seenTargets.add(identity);
      }
    }
    if (node.kind === "choice-source") {
      const group = node.fields.find((field) => field.name === "group");
      if (group && !handlePattern.test(unquote(group.value)))
        add(
          diagnostics,
          "choiceSource.group.invalid",
          { value: unquote(group.value) },
          node,
          group,
        );
    }
    if (node.kind === "input") {
      const selection = unquote(
        node.fields.find((field) => field.name === "selection")?.value ?? "",
      );
      const minimum = node.fields.find((field) => field.name === "min");
      const maximum = node.fields.find((field) => field.name === "max");
      const optionsFields = node.fields.filter(
        (field) => field.name === "option",
      );
      if (selection !== "integer")
        for (const bound of [minimum, maximum])
          if (bound)
            add(diagnostics, "input.bounds.domain", { selection }, node, bound);
      if (
        minimum &&
        maximum &&
        integerPattern.test(unquote(minimum.value)) &&
        integerPattern.test(unquote(maximum.value)) &&
        Number(unquote(minimum.value)) > Number(unquote(maximum.value))
      )
        add(diagnostics, "input.bounds.order", {}, node, maximum);
      if (selection !== "select" && optionsFields.length)
        for (const option of optionsFields)
          add(diagnostics, "input.option.domain", { selection }, node, option);
      optionsFields.forEach((option, occurrence) => {
        if (optionValueIsEmpty(option.value))
          add(
            diagnostics,
            "option.empty",
            {},
            node,
            option,
            occurrence,
            "warning",
          );
      });
      if (
        selection === "select" &&
        !optionsFields.some((option) => !optionValueIsEmpty(option.value))
      )
        add(
          diagnostics,
          "input.option.empty",
          {},
          node,
          undefined,
          0,
          "warning",
          "option",
        );
    }
    if (node.kind === "cost") {
      const mode = unquote(
        node.fields.find((field) => field.name === "mode")?.value ?? "flat",
      );
      if (mode === "each") {
        const selection = unquote(
          parent?.fields.find((field) => field.name === "selection")?.value ??
            "toggle",
        );
        const minimum = parent?.fields.find((field) => field.name === "min");
        if (
          selection !== "integer" ||
          !minimum ||
          !integerPattern.test(unquote(minimum.value)) ||
          Number(unquote(minimum.value)) < 0
        ) {
          const modeField = node.fields.find((field) => field.name === "mode");
          add(
            diagnostics,
            "cost.each.integer_only",
            {},
            node,
            modeField,
            0,
            "error",
            modeField ? undefined : "mode",
          );
        }
      }
    }
    if (node.kind === "resource") {
      const handle = node.fields.find((field) => field.name === "handle");
      if (handle && unquote(handle.value) === "jump_points")
        add(diagnostics, "resource.reserved", {}, node, handle);
    }
    if (node.kind === "grant") {
      const kind = unquote(
        node.fields.find((field) => field.name === "kind")?.value ?? "",
      );
      const visible = new Set(["perk", "item", "form", "companion", "trait"]);
      for (const name of ["name", "tag", "layout"])
        for (const candidate of node.fields.filter(
          (field) => field.name === name,
        )) {
          if (!visible.has(kind) || (name === "layout" && kind !== "trait"))
            add(
              diagnostics,
              "grant.visible.field",
              { field: name, kind },
              node,
              candidate,
            );
        }
    }
    for (const fieldName of ["tag", "group", "author"]) {
      const matching = node.fields.filter((field) => field.name === fieldName);
      if (fieldName === "author") continue;
      const seen = new Set<string>();
      for (const candidate of matching) {
        const identity = canonicalTag(unquote(candidate.value));
        if (!identity)
          add(diagnostics, "tag.empty", { field: fieldName }, node, candidate);
        else if (seen.has(identity))
          add(
            diagnostics,
            "tag.duplicate",
            { field: fieldName, value: unquote(candidate.value) },
            node,
            candidate,
          );
        seen.add(identity);
      }
    }
  }
  validateConditionsAndPlaceholders(entries, diagnostics, options);
}

function validatePackageStructure(
  parsed: readonly ParsedFormatFile[],
  diagnostics: PackageDiagnostic[],
  options: PackageValidationOptions,
) {
  const roots = parsed.flatMap((file) => file.tree);
  const jumps = roots.filter((node) => node.kind === "jump");
  if (jumps.length !== 1) {
    const owner = jumps[0] ?? roots[0];
    diagnostics.push({
      code: "jump.cardinality",
      severity: "error",
      messageKey: "diagnostics.jump.cardinality",
      parameters: { count: jumps.length },
      range: owner?.range,
      target: owner
        ? {
            file: owner.range.file,
            declarationFrom: owner.range.from,
            part: "declaration",
          }
        : undefined,
    });
  }
  const sections = roots.filter((node) => node.kind === "section");
  if (!sections.length) {
    const owner = jumps[0] ?? roots[0];
    diagnostics.push({
      code: "section.required",
      severity: options.profile === "editor" ? "warning" : "error",
      messageKey: "diagnostics.section.required",
      parameters: {},
      range: owner?.range,
      target: owner
        ? {
            file: owner.range.file,
            declarationFrom: owner.range.from,
            part: "declaration",
          }
        : undefined,
    });
  }

  for (const kind of [
    "resource",
    "section",
    "choice",
    "theme",
    "section-layout",
    "choice-layout",
    "trait-layout",
  ]) {
    const seen = new Set<string>();
    for (const node of roots.filter((candidate) => candidate.kind === kind)) {
      const handle = node.fields.find(
        (candidate) => candidate.name === "handle",
      );
      if (!handle) continue;
      const identity = unquote(handle.value);
      if (seen.has(identity))
        add(
          diagnostics,
          "schema.handle.duplicate",
          { handle: identity, namespace: kind },
          node,
          handle,
        );
      seen.add(identity);
    }
  }

  for (const node of roots.filter((candidate) =>
    candidate.kind.endsWith("-layout"),
  )) {
    const rootName = `${node.kind.replace("-layout", "")}LayoutRoot`;
    const rootRule = schema.roots[rootName];
    if (!rootRule) continue;
    const allowed = node.children.filter((child) =>
      rootRule.allowed?.includes(child.kind),
    );
    if (rootRule.exactlyOne && allowed.length !== 1)
      add(
        diagnostics,
        "layout.root.cardinality",
        { layout: node.kind, count: allowed.length },
        node,
      );
    for (const child of node.children)
      if (!rootRule.allowed?.includes(child.kind))
        add(
          diagnostics,
          "layout.root.child",
          { child: child.kind, layout: node.kind },
          child,
        );
  }
}

export function validateFormat1(
  parsed: readonly ParsedFormatFile[],
  packageItem: Omit<CanonicalJumpPackage, "diagnostics">,
  options: PackageValidationOptions = {},
) {
  const diagnostics: PackageDiagnostic[] = [];
  validatePackageStructure(parsed, diagnostics, options);
  for (const file of parsed) {
    const allowed = schema.files[file.file]?.topLevel;
    for (const node of file.tree) {
      if (allowed && !allowed.includes(node.kind))
        add(
          diagnostics,
          "schema.file.placement",
          { declaration: node.kind, file: file.file },
          node,
        );
      validateNode(node, undefined, diagnostics);
    }
  }
  validateReferences(parsed, diagnostics, options);
  validateAuthoringWarnings(parsed, packageItem, diagnostics, options);
  validateSemanticFields(parsed, diagnostics, options);
  const syntaxLines = new Set(
    parsed.flatMap((file) =>
      file.diagnostics.flatMap((diagnostic) =>
        diagnostic.range
          ? [`${diagnostic.range.file}:${diagnostic.range.line}`]
          : [],
      ),
    ),
  );
  return diagnostics.filter(
    (diagnostic) =>
      !diagnostic.range ||
      !syntaxLines.has(`${diagnostic.range.file}:${diagnostic.range.line}`),
  );
}
