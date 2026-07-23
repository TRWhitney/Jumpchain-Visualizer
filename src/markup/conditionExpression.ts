export type ConditionValue = string | number | boolean | undefined;

export type ConditionSpan = { from: number; to: number };

export type ConditionOperand =
  | ({ kind: "property"; handle: string } & ConditionSpan)
  | ({
      kind: "literal";
      value: string | number | boolean;
      valueType: "string" | "integer" | "boolean";
    } & ConditionSpan);

export type ConditionComparisonOperator = "=" | "!=" | "<" | "<=" | ">" | ">=";

export type ConditionExpression =
  | ({ kind: "operand"; operand: ConditionOperand } & ConditionSpan)
  | ({
      kind: "comparison";
      left: ConditionOperand;
      operator: ConditionComparisonOperator;
      right: ConditionOperand;
    } & ConditionSpan)
  | ({ kind: "not"; expression: ConditionExpression } & ConditionSpan)
  | ({
      kind: "logical";
      operator: "and" | "or";
      left: ConditionExpression;
      right: ConditionExpression;
    } & ConditionSpan)
  | ({ kind: "group"; expression: ConditionExpression } & ConditionSpan);

export type ConditionParseError = ConditionSpan & {
  code:
    | "empty"
    | "unexpected-token"
    | "missing-operand"
    | "missing-close-parenthesis"
    | "trailing-token"
    | "unterminated-string"
    | "invalid-escape";
  token?: string;
};

export type ConditionParseResult = {
  expression: ConditionExpression | null;
  errors: readonly ConditionParseError[];
};

type Token = ConditionSpan & {
  kind:
    | "identifier"
    | "string"
    | "integer"
    | "boolean"
    | "comparison"
    | "not"
    | "and"
    | "or"
    | "open"
    | "close"
    | "invalid"
    | "end";
  raw: string;
  value?: string | number | boolean;
};

function tokenizeCondition(source: string) {
  const tokens: Token[] = [];
  const errors: ConditionParseError[] = [];
  let index = 0;
  const push = (token: Token) => tokens.push(token);
  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === '"') {
      const from = index++;
      let value = "";
      let closed = false;
      while (index < source.length) {
        const next = source[index++];
        if (next === '"') {
          closed = true;
          break;
        }
        if (next === "\\" && index < source.length) {
          const escaped = source[index++];
          if (!["n", "r", "t", '"', "\\"].includes(escaped))
            errors.push({
              code: "invalid-escape",
              token: `\\${escaped}`,
              from: index - 2,
              to: index,
            });
          value +=
            escaped === "n"
              ? "\n"
              : escaped === "r"
                ? "\r"
                : escaped === "t"
                  ? "\t"
                  : escaped;
        } else value += next;
      }
      if (!closed)
        errors.push({
          code: "unterminated-string",
          from,
          to: source.length,
        });
      push({
        kind: "string",
        raw: source.slice(from, index),
        value,
        from,
        to: index,
      });
      continue;
    }
    const comparison = source.slice(index).match(/^(?:!=|<=|>=|=|<|>)/)?.[0];
    if (comparison) {
      push({
        kind: "comparison",
        raw: comparison,
        from: index,
        to: index + comparison.length,
      });
      index += comparison.length;
      continue;
    }
    if (character === "!") {
      push({ kind: "not", raw: character, from: index, to: index + 1 });
      index += 1;
      continue;
    }
    if (character === "(") {
      push({ kind: "open", raw: character, from: index, to: index + 1 });
      index += 1;
      continue;
    }
    if (character === ")") {
      push({ kind: "close", raw: character, from: index, to: index + 1 });
      index += 1;
      continue;
    }
    const integer = source.slice(index).match(/^-?(?:0|[1-9][0-9]*)\b/)?.[0];
    if (integer) {
      push({
        kind: "integer",
        raw: integer,
        value: Number(integer),
        from: index,
        to: index + integer.length,
      });
      index += integer.length;
      continue;
    }
    const identifier = source.slice(index).match(/^[a-z_][a-z0-9_]*/i)?.[0];
    if (identifier) {
      const normalized = identifier.toLocaleLowerCase();
      const kind =
        normalized === "and"
          ? "and"
          : normalized === "or"
            ? "or"
            : normalized === "true" || normalized === "false"
              ? "boolean"
              : "identifier";
      push({
        kind,
        raw: identifier,
        value: kind === "boolean" ? normalized === "true" : identifier,
        from: index,
        to: index + identifier.length,
      });
      index += identifier.length;
      continue;
    }
    push({ kind: "invalid", raw: character, from: index, to: index + 1 });
    errors.push({
      code: "unexpected-token",
      token: character,
      from: index,
      to: index + 1,
    });
    index += 1;
  }
  tokens.push({
    kind: "end",
    raw: "",
    from: source.length,
    to: source.length,
  });
  return { tokens, errors };
}

export function parseConditionExpression(source: string): ConditionParseResult {
  const tokenized = tokenizeCondition(source);
  const errors = [...tokenized.errors];
  const tokens = tokenized.tokens;
  let index = 0;
  const current = () => tokens[index];
  const take = () => tokens[index++];
  const operand = (): ConditionOperand | null => {
    const token = current();
    if (token.kind === "identifier") {
      take();
      return {
        kind: "property",
        handle: String(token.value),
        from: token.from,
        to: token.to,
      };
    }
    if (["string", "integer", "boolean"].includes(token.kind)) {
      take();
      return {
        kind: "literal",
        value: token.value as string | number | boolean,
        valueType:
          token.kind === "integer"
            ? "integer"
            : token.kind === "boolean"
              ? "boolean"
              : "string",
        from: token.from,
        to: token.to,
      };
    }
    errors.push({
      code: "missing-operand",
      token: token.raw,
      from: token.from,
      to: token.to,
    });
    if (token.kind !== "end") take();
    return null;
  };
  const primary = (): ConditionExpression | null => {
    if (current().kind === "open") {
      const open = take();
      const expression = parseOr();
      const close = current();
      if (close.kind !== "close")
        errors.push({
          code: "missing-close-parenthesis",
          from: close.from,
          to: close.to,
        });
      else take();
      return expression
        ? {
            kind: "group",
            expression,
            from: open.from,
            to: close.kind === "close" ? close.to : expression.to,
          }
        : null;
    }
    const left = operand();
    if (!left) return null;
    if (current().kind !== "comparison")
      return { kind: "operand", operand: left, from: left.from, to: left.to };
    const operator = take();
    const right = operand();
    if (!right) return null;
    return {
      kind: "comparison",
      left,
      operator: operator.raw as ConditionComparisonOperator,
      right,
      from: left.from,
      to: right.to,
    };
  };
  const parseNot = (): ConditionExpression | null => {
    if (current().kind !== "not") return primary();
    const token = take();
    const expression = parseNot();
    return expression
      ? { kind: "not", expression, from: token.from, to: expression.to }
      : null;
  };
  const parseAnd = (): ConditionExpression | null => {
    let left = parseNot();
    while (left && current().kind === "and") {
      take();
      const right = parseNot();
      if (!right) return left;
      left = {
        kind: "logical",
        operator: "and",
        left,
        right,
        from: left.from,
        to: right.to,
      };
    }
    return left;
  };
  function parseOr(): ConditionExpression | null {
    let left = parseAnd();
    while (left && current().kind === "or") {
      take();
      const right = parseAnd();
      if (!right) return left;
      left = {
        kind: "logical",
        operator: "or",
        left,
        right,
        from: left.from,
        to: right.to,
      };
    }
    return left;
  }
  if (!source.trim())
    errors.push({ code: "empty", from: 0, to: Math.max(0, source.length) });
  const expression = source.trim() ? parseOr() : null;
  if (current().kind !== "end") {
    const token = current();
    errors.push({
      code: "trailing-token",
      token: token.raw,
      from: token.from,
      to: token.to,
    });
  }
  return { expression: errors.length ? null : expression, errors };
}

function operandSource(operand: ConditionOperand) {
  if (operand.kind === "property") return operand.handle;
  if (operand.valueType === "string")
    return `"${String(operand.value).replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\t", "\\t")}"`;
  return String(operand.value);
}

function precedence(expression: ConditionExpression): number {
  if (expression.kind === "logical")
    return expression.operator === "or" ? 1 : 2;
  if (expression.kind === "not") return 3;
  return 4;
}

function expressionSource(
  expression: ConditionExpression,
  parentPrecedence = 0,
): string {
  const ownPrecedence = precedence(expression);
  const value =
    expression.kind === "operand"
      ? operandSource(expression.operand)
      : expression.kind === "comparison"
        ? `${operandSource(expression.left)} ${expression.operator} ${operandSource(expression.right)}`
        : expression.kind === "not"
          ? `!${expression.expression.kind === "group" ? expressionSource(expression.expression) : expressionSource(expression.expression, ownPrecedence)}`
          : expression.kind === "group"
            ? `(${expressionSource(expression.expression)})`
            : `${expressionSource(expression.left, ownPrecedence)} ${expression.operator} ${expressionSource(expression.right, ownPrecedence + (expression.operator === "or" ? 0 : 1))}`;
  return ownPrecedence < parentPrecedence ? `(${value})` : value;
}

export function printConditionExpression(expression: ConditionExpression) {
  return expressionSource(expression);
}

function operandValue(
  operand: ConditionOperand,
  context: Readonly<Record<string, ConditionValue>>,
) {
  return operand.kind === "property" ? context[operand.handle] : operand.value;
}

export function evaluateParsedCondition(
  expression: ConditionExpression,
  context: Readonly<Record<string, ConditionValue>>,
): boolean {
  if (expression.kind === "group")
    return evaluateParsedCondition(expression.expression, context);
  if (expression.kind === "not")
    return !evaluateParsedCondition(expression.expression, context);
  if (expression.kind === "logical")
    return expression.operator === "and"
      ? evaluateParsedCondition(expression.left, context) &&
          evaluateParsedCondition(expression.right, context)
      : evaluateParsedCondition(expression.left, context) ||
          evaluateParsedCondition(expression.right, context);
  if (expression.kind === "operand")
    return Boolean(operandValue(expression.operand, context));
  const left = operandValue(expression.left, context);
  const right = operandValue(expression.right, context);
  if (expression.operator === "=") return left === right;
  if (expression.operator === "!=") return left !== right;
  if (typeof left !== "number" || typeof right !== "number") return false;
  if (expression.operator === "<") return left < right;
  if (expression.operator === "<=") return left <= right;
  if (expression.operator === ">") return left > right;
  return left >= right;
}

export function evaluateConditionExpression(
  source: string,
  context: Readonly<Record<string, ConditionValue>>,
) {
  const parsed = parseConditionExpression(source);
  return parsed.expression
    ? evaluateParsedCondition(parsed.expression, context)
    : false;
}

export function conditionPropertyOperands(expression: ConditionExpression) {
  const result: Extract<ConditionOperand, { kind: "property" }>[] = [];
  const addOperand = (operand: ConditionOperand) => {
    if (operand.kind === "property") result.push(operand);
  };
  const visit = (item: ConditionExpression) => {
    if (item.kind === "operand") addOperand(item.operand);
    else if (item.kind === "comparison") {
      addOperand(item.left);
      addOperand(item.right);
    } else if (item.kind === "logical") {
      visit(item.left);
      visit(item.right);
    } else visit(item.expression);
  };
  visit(expression);
  return result;
}

export function conditionComparisons(expression: ConditionExpression) {
  const result: Extract<ConditionExpression, { kind: "comparison" }>[] = [];
  const visit = (item: ConditionExpression) => {
    if (item.kind === "comparison") result.push(item);
    else if (item.kind === "logical") {
      visit(item.left);
      visit(item.right);
    } else if (item.kind === "not" || item.kind === "group")
      visit(item.expression);
  };
  visit(expression);
  return result;
}

function ungroup(expression: ConditionExpression): ConditionExpression {
  return expression.kind === "group"
    ? ungroup(expression.expression)
    : expression;
}

function numericComparison(expression: ConditionExpression) {
  const item = ungroup(expression);
  if (
    item.kind !== "comparison" ||
    item.left.kind !== "property" ||
    item.right.kind !== "literal" ||
    item.right.valueType !== "integer"
  )
    return null;
  return {
    property: item.left.handle,
    operator: item.operator,
    value: item.right.value as number,
  };
}

export function conditionExpressionSubsumes(
  earlier: ConditionExpression,
  later: ConditionExpression,
) {
  const earlierSource = printConditionExpression(earlier);
  const laterSource = printConditionExpression(later);
  if (earlierSource === "true" || earlierSource === laterSource) return true;
  const left = numericComparison(earlier);
  const right = numericComparison(later);
  if (!left || !right || left.property !== right.property) return false;
  if (left.operator === "=")
    return right.operator === "=" && left.value === right.value;
  if (left.operator === ">" || left.operator === ">=") {
    if (right.operator !== ">" && right.operator !== ">=") return false;
    return left.operator === ">"
      ? left.value < right.value ||
          (left.value === right.value && right.operator === ">")
      : left.value <= right.value;
  }
  if (left.operator === "<" || left.operator === "<=") {
    if (right.operator !== "<" && right.operator !== "<=") return false;
    return left.operator === "<"
      ? left.value > right.value ||
          (left.value === right.value && right.operator === "<")
      : left.value >= right.value;
  }
  return false;
}
