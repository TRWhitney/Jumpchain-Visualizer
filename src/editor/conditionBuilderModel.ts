import type {
  ConditionComparisonOperator,
  ConditionExpression,
} from "../markup";

export type VisualRule = {
  kind: "rule";
  property: string;
  operator:
    | "active"
    | "inactive"
    | "equal"
    | "not-equal"
    | "less"
    | "less-equal"
    | "greater"
    | "greater-equal"
    | "always"
    | "never";
  value?: string | number | boolean;
};

export type VisualGroup = {
  kind: "group";
  operator: "and" | "or";
  inverted: boolean;
  explicit: boolean;
  children: VisualNode[];
};

export type VisualNode = VisualRule | VisualGroup;

const reverseComparison: Record<
  ConditionComparisonOperator,
  ConditionComparisonOperator
> = {
  "=": "=",
  "!=": "!=",
  "<": ">",
  "<=": ">=",
  ">": "<",
  ">=": "<=",
};

const visualOperator = (
  operator: ConditionComparisonOperator,
): VisualRule["operator"] =>
  operator === "="
    ? "equal"
    : operator === "!="
      ? "not-equal"
      : operator === "<"
        ? "less"
        : operator === "<="
          ? "less-equal"
          : operator === ">"
            ? "greater"
            : "greater-equal";

export function expressionToVisual(
  expression: ConditionExpression,
): VisualNode | null {
  if (expression.kind === "group") {
    const child = expressionToVisual(expression.expression);
    return child
      ? {
          kind: "group",
          operator: child.kind === "group" ? child.operator : "and",
          inverted: false,
          explicit: true,
          children: child.kind === "group" ? child.children : [child],
        }
      : null;
  }
  if (expression.kind === "logical") {
    const left = expressionToVisual(expression.left);
    const right = expressionToVisual(expression.right);
    if (!left || !right) return null;
    const children: VisualNode[] = [];
    if (
      left.kind === "group" &&
      left.operator === expression.operator &&
      !left.inverted &&
      !left.explicit
    )
      children.push(...left.children);
    else children.push(left);
    if (
      right.kind === "group" &&
      right.operator === expression.operator &&
      !right.inverted &&
      !right.explicit
    )
      children.push(...right.children);
    else children.push(right);
    return {
      kind: "group",
      operator: expression.operator,
      inverted: false,
      explicit: false,
      children,
    };
  }
  if (expression.kind === "not") {
    const child = expressionToVisual(expression.expression);
    if (!child) return null;
    if (child.kind === "rule" && child.operator === "active")
      return { ...child, operator: "inactive" };
    if (child.kind === "rule" && child.operator === "inactive")
      return { ...child, operator: "active" };
    if (child.kind === "rule" && child.operator === "always")
      return { ...child, operator: "never" };
    if (child.kind === "rule" && child.operator === "never")
      return { ...child, operator: "always" };
    return child.kind === "group"
      ? { ...child, inverted: !child.inverted }
      : {
          kind: "group",
          operator: "and",
          inverted: true,
          explicit: true,
          children: [child],
        };
  }
  if (expression.kind === "operand") {
    if (expression.operand.kind === "property")
      return {
        kind: "rule",
        property: expression.operand.handle,
        operator: "active",
      };
    if (expression.operand.valueType === "boolean")
      return {
        kind: "rule",
        property: "",
        operator: expression.operand.value ? "always" : "never",
      };
    return null;
  }
  const leftProperty = expression.left.kind === "property";
  const property = leftProperty ? expression.left : expression.right;
  const literal = leftProperty ? expression.right : expression.left;
  if (property.kind !== "property" || literal.kind !== "literal") return null;
  return {
    kind: "rule",
    property: property.handle,
    operator: visualOperator(
      leftProperty
        ? expression.operator
        : reverseComparison[expression.operator],
    ),
    value: literal.value,
  };
}

const quoted = (value: string) =>
  `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\t", "\\t")}"`;

export function visualRuleSource(rule: VisualRule) {
  if (rule.operator === "always") return "true";
  if (rule.operator === "never") return "false";
  if (rule.operator === "active") return rule.property;
  if (rule.operator === "inactive") return `!${rule.property}`;
  const operator =
    rule.operator === "equal"
      ? "="
      : rule.operator === "not-equal"
        ? "!="
        : rule.operator === "less"
          ? "<"
          : rule.operator === "less-equal"
            ? "<="
            : rule.operator === "greater"
              ? ">"
              : ">=";
  const value =
    typeof rule.value === "string" ? quoted(rule.value) : String(rule.value);
  return `${rule.property} ${operator} ${value}`;
}

export function visualSource(node: VisualNode, nested = false): string {
  if (node.kind === "rule") return visualRuleSource(node);
  const joined = node.children
    .map((child) => visualSource(child, true))
    .join(` ${node.operator} `);
  const grouped =
    nested || node.inverted || node.explicit ? `(${joined})` : joined;
  return node.inverted ? `!${grouped}` : grouped;
}

export function updateVisualNode(
  node: VisualNode,
  path: readonly number[],
  update: (node: VisualNode) => VisualNode,
): VisualNode {
  if (!path.length) return update(node);
  if (node.kind !== "group") return node;
  const [head, ...tail] = path;
  return {
    ...node,
    children: node.children.map((child, index) =>
      index === head ? updateVisualNode(child, tail, update) : child,
    ),
  };
}

export function addVisualNode(
  node: VisualNode,
  path: readonly number[],
  child: VisualNode,
): VisualNode {
  if (!path.length) {
    if (node.kind === "group")
      return { ...node, children: [...node.children, child] };
    return {
      kind: "group",
      operator: "and",
      inverted: false,
      explicit: false,
      children: [node, child],
    };
  }
  return updateVisualNode(node, path, (target) =>
    target.kind === "group"
      ? { ...target, children: [...target.children, child] }
      : target,
  );
}

export function removeVisualNode(
  node: VisualNode,
  path: readonly number[],
): VisualNode | null {
  if (path.length < 1) return null;
  if (node.kind !== "group") return node;
  if (path.length === 1) {
    const children = node.children.filter((_, index) => index !== path[0]);
    return children.length === 0
      ? null
      : children.length === 1
        ? children[0]
        : { ...node, children };
  }
  const [head, ...tail] = path;
  const children = node.children.flatMap((child, index) => {
    if (index !== head) return [child];
    const next = removeVisualNode(child, tail);
    return next ? [next] : [];
  });
  return children.length === 0
    ? null
    : children.length === 1
      ? children[0]
      : { ...node, children };
}
