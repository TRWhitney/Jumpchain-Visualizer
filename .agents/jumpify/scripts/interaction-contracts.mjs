const INTERACTION_STATES = new Set([
  "unset",
  "selected",
  "manual",
  "rolled",
  "changed",
  "limit-disabled",
  "ranked",
  "prose",
  "custom",
]);
const OWNERS = new Set(["choice", "choice-source", "prose"]);
const PLACEMENTS = new Set(["direct", "source", "none"]);
const SELECTIONS = new Set([
  "toggle",
  "text",
  "integer",
  "select",
  "companions",
  "source-members",
  "none",
]);
const RESOLUTIONS = new Set(["manual", "random", "either", "none"]);
const CONTINUITIES = new Set(["previous", "original", "none"]);
const GEOMETRY_POLICIES = new Set(["stable", "intentional-source-reflow"]);
const PRICING_POLICIES = new Set([
  "ordinary",
  "rolled-free",
  "continuity-change",
  "none",
]);
const CONTROL_KINDS = new Set([
  "checkbox",
  "radio",
  "text",
  "number",
  "select",
  "companions",
  "none",
]);

function numericCostTotal(observation) {
  const values = Object.values(observation?.resolvedCosts ?? {});
  return values.length && values.every(Number.isInteger)
    ? values.reduce((sum, value) => sum + value, 0)
    : null;
}

function hasPositiveNumericCost(choice) {
  return (choice?.costs ?? []).some(
    (cost) => typeof cost.amount === "number" && cost.amount > 0,
  );
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function renderableBase(value) {
  if (typeof value === "string") return value;
  return typeof value?.base === "string" ? value.base : undefined;
}

function contractChoice(contract, canonical) {
  if (contract.owner !== "choice") return undefined;
  return canonical?.choices?.find(
    (choice) => choice.handle === contract.handle,
  );
}

function rectErrors(rect, label) {
  if (!rect || typeof rect !== "object") return [`${label} is required`];
  const errors = [];
  for (const field of ["x", "y", "width", "height"])
    if (!Number.isFinite(rect[field]))
      errors.push(`${label}.${field} is invalid`);
  if (Number.isFinite(rect.width) && rect.width <= 0)
    errors.push(`${label}.width must be positive`);
  if (Number.isFinite(rect.height) && rect.height <= 0)
    errors.push(`${label}.height must be positive`);
  if (Number.isFinite(rect.width) && rect.width < 4)
    errors.push(`${label}.width is a placeholder, not a measured bound`);
  if (Number.isFinite(rect.height) && rect.height < 4)
    errors.push(`${label}.height is a placeholder, not a measured bound`);
  return errors;
}

function rectDelta(left, right) {
  return Math.max(
    ...["x", "y", "width", "height"].map((field) =>
      Math.abs((left?.[field] ?? Infinity) - (right?.[field] ?? -Infinity)),
    ),
  );
}

function expectedControlKind(contract, canonical) {
  if (contract.owner === "prose") return "none";
  if (contract.owner === "choice-source") {
    const source = canonical?.sections
      ?.find((section) => section.handle === contract.section)
      ?.sources.find((item) => item.handle === contract.handle);
    if (!source) return undefined;
    return source?.mode === "multi" ? "checkbox" : "radio";
  }
  return {
    toggle: "checkbox",
    text: "text",
    integer: "number",
    select: "select",
    companions: "companions",
  }[contract.selection];
}

function observationErrors(contract, canonical) {
  const errors = [];
  const label = contract.id ?? "interaction-contract";
  const states = new Map(
    (contract.states ?? []).map((state) => [state.name, state]),
  );
  const expectedKind = expectedControlKind(contract, canonical);
  const choice = contractChoice(contract, canonical);
  const selectOptions =
    choice?.selection === "select"
      ? (choice.options ?? []).map(renderableBase).filter(Boolean)
      : [];

  for (const state of contract.states ?? []) {
    const observation = state.observation;
    const stateLabel = `${label}.${state.name}.observation`;
    if (!observation || typeof observation !== "object") {
      errors.push(`${stateLabel} is required`);
      continue;
    }
    if (!CONTROL_KINDS.has(observation.controlKind))
      errors.push(`${stateLabel}.controlKind is invalid`);
    if (!Object.hasOwn(observation, "controlValue"))
      errors.push(`${stateLabel}.controlValue is required`);
    if (expectedKind && observation.controlKind !== expectedKind)
      errors.push(
        `${stateLabel}.controlKind expected ${expectedKind} but captured ${observation.controlKind}`,
      );
    if (
      selectOptions.length &&
      observation.controlValue !== null &&
      observation.controlValue !== "" &&
      !selectOptions.includes(String(observation.controlValue))
    )
      errors.push(
        `${stateLabel}.controlValue ${JSON.stringify(observation.controlValue)} is not an authored option for ${contract.handle}`,
      );
    if (!Array.isArray(observation.activationControlKinds))
      errors.push(`${stateLabel}.activationControlKinds must be an array`);
    else if (
      observation.activationControlKinds.some(
        (kind) => !["checkbox", "radio"].includes(kind),
      )
    )
      errors.push(`${stateLabel}.activationControlKinds is invalid`);
    else if (
      contract.owner === "choice" &&
      contract.placement === "direct" &&
      observation.activationControlKinds.some((kind) =>
        ["checkbox", "radio"].includes(kind),
      )
    )
      errors.push(
        `${stateLabel} captured a generic activation checkbox/radio before a direct scalar control`,
      );
    if (
      !observation.resolvedCosts ||
      typeof observation.resolvedCosts !== "object"
    )
      errors.push(`${stateLabel}.resolvedCosts is required`);
    else
      for (const [resource, amount] of Object.entries(
        observation.resolvedCosts,
      ))
        if (!resource || !Number.isInteger(amount))
          errors.push(`${stateLabel}.resolvedCosts.${resource} is invalid`);
    if (!Array.isArray(observation.overlaps))
      errors.push(`${stateLabel}.overlaps must be an array`);
    else if (observation.overlaps.length)
      errors.push(`${stateLabel} contains overlapping live elements`);
    if (contract.owner !== "prose") {
      errors.push(
        ...rectErrors(
          observation.bounds?.surface,
          `${stateLabel}.bounds.surface`,
        ),
      );
      errors.push(
        ...rectErrors(observation.bounds?.rail, `${stateLabel}.bounds.rail`),
      );
    }
    if (
      !["unset", "prose"].includes(state.name) &&
      observation.actionSucceeded !== true
    )
      errors.push(`${stateLabel}.actionSucceeded must be true`);
    if (typeof observation.actionSucceeded !== "boolean")
      errors.push(`${stateLabel}.actionSucceeded must be boolean`);
    if (observation.resolutionStatus !== state.name)
      errors.push(`${stateLabel}.resolutionStatus must be ${state.name}`);
  }

  const unset = states.get("unset")?.observation;
  const changed = states.get("changed")?.observation;
  if (changed && unset && sameValue(changed.controlValue, unset.controlValue))
    errors.push(`${label}.changed did not change the primary control value`);

  if (contract.selection === "text") {
    const typedState =
      contract.continuity === "none"
        ? states.get("manual")?.observation
        : states.get("changed")?.observation;
    if (
      !typedState ||
      typeof typedState.controlValue !== "string" ||
      !typedState.controlValue.trim() ||
      (unset && sameValue(typedState.controlValue, unset.controlValue))
    )
      errors.push(
        `${label} must capture a nonempty typed value distinct from its unset state`,
      );
  }

  if (contract.pricing === "rolled-free") {
    const manual = numericCostTotal(states.get("manual")?.observation);
    const rolled = numericCostTotal(states.get("rolled")?.observation);
    if (!(manual > 0))
      errors.push(`${label}.manual must capture a positive resolved cost`);
    if (rolled !== 0)
      errors.push(`${label}.rolled must capture a zero resolved cost`);
  }
  if (contract.pricing === "continuity-change") {
    const previous = numericCostTotal(unset);
    const changedCost = numericCostTotal(changed);
    if (previous !== 0)
      errors.push(
        `${label}.unset continuity value must capture a zero resolved cost`,
      );
    if (changedCost === null || changedCost === 0)
      errors.push(
        `${label}.changed continuity value must capture a nonzero resolved cost`,
      );
  }

  if (contract.geometry?.policy === "stable" && unset) {
    for (const state of contract.states ?? []) {
      if (state.name === "unset" || !state.observation) continue;
      for (const part of ["surface", "rail", "neighbor"])
        if (unset.bounds?.[part] || state.observation.bounds?.[part]) {
          const delta = rectDelta(
            unset.bounds?.[part],
            state.observation.bounds?.[part],
          );
          if (delta > 1)
            errors.push(
              `${label}.${state.name} ${part} geometry changed by ${Number(delta.toFixed(2))}px`,
            );
        }
    }
  }
  return errors;
}

export function hasMatchingFacsimilePanel(entry, assets) {
  return assets.some(
    (asset) =>
      asset.package &&
      asset.kind === "panel" &&
      asset.page === entry.page &&
      ["x", "y", "width", "height"].every(
        (field) => asset.rect?.[field] === entry.rect?.[field],
      ),
  );
}

export function duplicateSemanticSlotErrors(canonical) {
  const errors = [];
  for (const layout of canonical.layouts ?? []) {
    const counts = new Map();
    const visit = (node) => {
      if (
        node.kind === "slot" &&
        ["control", "roll", "cost"].includes(node.target)
      )
        counts.set(node.target, (counts.get(node.target) ?? 0) + 1);
      for (const child of node.children ?? []) visit(child);
    };
    visit(layout.root);
    for (const [target, count] of counts)
      if (count > 1)
        errors.push(
          `${layout.kind} ${layout.handle} renders live ${target} ${count} times`,
        );
  }
  return errors;
}

function requiredStates(contract, canonical) {
  if (contract.owner === "prose") return ["prose"];
  if (contract.owner === "choice-source") {
    const section = canonical.sections.find(
      (item) => item.handle === contract.section,
    );
    const source = section?.sources.find(
      (item) => item.handle === contract.handle,
    );
    const required = ["unset"];
    if (contract.resolution === "either") required.push("manual", "rolled");
    else if (contract.resolution === "random") required.push("rolled");
    else required.push("selected");
    if (source?.mode === "multi" && source.max) required.push("limit-disabled");
    return required;
  }

  const choice = canonical.choices.find(
    (item) => item.handle === contract.handle,
  );
  const required = ["unset"];
  if (contract.selection === "toggle") required.push("selected");
  else if (contract.resolution === "either") required.push("manual", "rolled");
  else if (contract.resolution === "random") required.push("rolled");
  else if (contract.continuity !== "none") required.push("changed");
  else required.push("manual");
  if (choice?.costs.some((cost) => cost.mode === "each"))
    required.push("ranked");
  return required;
}

export function interactionContractErrors(ledger, canonical, options = {}) {
  const errors = [];
  const complete = options.complete === true;
  const requireCoverage = complete || options.requireCoverage === true;
  const contracts = Array.isArray(ledger.interactionContracts)
    ? ledger.interactionContracts
    : [];
  const entries = new Map(
    (ledger.entries ?? []).map((entry) => [entry.id, entry]),
  );
  const entryMembership = new Map();
  const contractIds = new Set();

  for (const contract of contracts) {
    const label = contract.id ?? "interaction-contract";
    if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(contract.id ?? ""))
      errors.push(`invalid interaction contract id: ${contract.id}`);
    if (contractIds.has(contract.id))
      errors.push(`duplicate interaction contract id: ${contract.id}`);
    contractIds.add(contract.id);
    if (!OWNERS.has(contract.owner)) errors.push(`${label}.owner is invalid`);
    if (!PLACEMENTS.has(contract.placement))
      errors.push(`${label}.placement is invalid`);
    if (!SELECTIONS.has(contract.selection))
      errors.push(`${label}.selection is invalid`);
    if (!RESOLUTIONS.has(contract.resolution))
      errors.push(`${label}.resolution is invalid`);
    if (!CONTINUITIES.has(contract.continuity))
      errors.push(`${label}.continuity is invalid`);
    if (!PRICING_POLICIES.has(contract.pricing))
      errors.push(`${label}.pricing is invalid`);
    if (!Array.isArray(contract.entryIds) || !contract.entryIds.length)
      errors.push(`${label}.entryIds must not be empty`);
    for (const entryId of contract.entryIds ?? []) {
      if (!entries.has(entryId))
        errors.push(`${label} references missing entry ${entryId}`);
      if (!contract.sourceActivation)
        entryMembership.set(entryId, (entryMembership.get(entryId) ?? 0) + 1);
    }
    if (!contract.sourceBehavior?.trim())
      errors.push(`${label}.sourceBehavior is required`);
    if (contract.sourceActivation) {
      if (contract.owner !== "choice" || contract.placement !== "source")
        errors.push(
          `${label}.sourceActivation is valid only for a Choice placed through a Source`,
        );
      if (!contract.sourceActivation.decision?.trim())
        errors.push(`${label}.sourceActivation.decision is required`);
      if (!contract.sourceActivation.directInsufficient?.trim())
        errors.push(`${label}.sourceActivation.directInsufficient is required`);
      if (!/\.png$/i.test(contract.sourceActivation.evidence ?? ""))
        errors.push(`${label}.sourceActivation.evidence must be a PNG`);
    }
    if (complete) {
      const states = new Set(
        (contract.states ?? []).map((state) => state.name),
      );
      for (const name of requiredStates(
        contract,
        canonical ?? { sections: [], choices: [] },
      ))
        if (!states.has(name)) errors.push(`${label} is missing ${name} state`);
      errors.push(...observationErrors(contract, canonical));
    }
    if (!canonical) continue;

    const section = canonical.sections.find(
      (item) => item.handle === contract.section,
    );
    if (!section) {
      errors.push(`${label} references missing Section ${contract.section}`);
      continue;
    }

    if (contract.owner === "prose") {
      if (
        contract.handle !== undefined ||
        contract.placement !== "none" ||
        contract.selection !== "none" ||
        contract.resolution !== "none" ||
        contract.continuity !== "none"
      )
        errors.push(`${label} prose contract must not declare a control`);
    } else if (contract.owner === "choice-source") {
      const source = section.sources.find(
        (item) => item.handle === contract.handle,
      );
      if (!source)
        errors.push(
          `${label} references missing Choice Source ${contract.handle} in ${contract.section}`,
        );
      else {
        if (contract.placement !== "source")
          errors.push(`${label}.placement must be source`);
        if (contract.selection !== "source-members")
          errors.push(`${label}.selection must be source-members`);
        if (contract.resolution !== source.resolution)
          errors.push(
            `${label}.resolution expected ${contract.resolution} but JDEF resolves ${source.resolution}`,
          );
        if (contract.continuity !== "none")
          errors.push(`${label}.continuity must be none`);
        const pricedMembers = canonical.choices.filter(
          (choice) =>
            source.group &&
            choice.groups.includes(source.group) &&
            hasPositiveNumericCost(choice),
        );
        if (
          source.resolution === "either" &&
          pricedMembers.length > 0 &&
          contract.pricing !== "rolled-free"
        )
          errors.push(
            `${label}.pricing must be rolled-free for a priced either-resolution Source`,
          );
        for (const entryId of contract.entryIds ?? []) {
          const entry = entries.get(entryId);
          for (const handle of entry?.handles ?? []) {
            const choice = canonical.choices.find(
              (item) => item.handle === handle,
            );
            if (choice && source.group && !choice.groups.includes(source.group))
              errors.push(
                `${label} entry ${entryId} Choice ${handle} is not a member of ${contract.handle}`,
              );
          }
        }
      }
    } else if (contract.owner === "choice") {
      const choice = canonical.choices.find(
        (item) => item.handle === contract.handle,
      );
      if (!choice) {
        errors.push(`${label} references missing Choice ${contract.handle}`);
      } else {
        if (
          choice.continuity &&
          hasPositiveNumericCost(choice) &&
          contract.pricing !== "continuity-change"
        )
          errors.push(
            `${label}.pricing must be continuity-change for a priced continuity Choice`,
          );
        else if (
          !choice.continuity &&
          choice.resolution === "either" &&
          hasPositiveNumericCost(choice) &&
          contract.pricing !== "rolled-free"
        )
          errors.push(
            `${label}.pricing must be rolled-free for a priced either-resolution Choice`,
          );
        if (choice.selection !== contract.selection)
          errors.push(
            `${label}.selection expected ${contract.selection} but JDEF resolves ${choice.selection}`,
          );
        if (choice.resolution !== contract.resolution)
          errors.push(
            `${label}.resolution expected ${contract.resolution} but JDEF resolves ${choice.resolution}`,
          );
        if ((choice.continuity ?? "none") !== contract.continuity)
          errors.push(
            `${label}.continuity expected ${contract.continuity} but JDEF resolves ${choice.continuity ?? "none"}`,
          );
      }

      if (contract.placement === "direct") {
        if (
          !section.directChoices.some(
            (placement) => placement.target === contract.handle,
          )
        )
          errors.push(
            `${label} requires direct placement of ${contract.handle} in ${contract.section}`,
          );
        if (contract.sourceHandle !== undefined)
          errors.push(`${label}.sourceHandle is invalid for direct placement`);
        const sameSectionSources = section.sources.filter(
          (source) => source.group && choice?.groups.includes(source.group),
        );
        if (sameSectionSources.length)
          errors.push(
            `${label} direct Choice ${contract.handle} is also activated through ${sameSectionSources.map((source) => source.handle).join(", ")}`,
          );
      } else if (contract.placement === "source") {
        const source = section.sources.find(
          (item) => item.handle === contract.sourceHandle,
        );
        if (!source)
          errors.push(
            `${label} references missing sourceHandle ${contract.sourceHandle} in ${contract.section}`,
          );
        else if (
          source.group &&
          choice &&
          !choice.groups.includes(source.group)
        )
          errors.push(
            `${label} Choice ${contract.handle} is not a member of ${contract.sourceHandle}`,
          );
      } else {
        errors.push(`${label}.placement must be direct or source`);
      }
    }
  }

  if (requireCoverage) {
    for (const entry of entries.values())
      if (entry.sourceKind === "choice" && entryMembership.get(entry.id) !== 1)
        errors.push(
          `${entry.id} must belong to exactly one interaction contract`,
        );
    if (canonical)
      for (const section of canonical.sections)
        for (const source of section.sources) {
          const matches = contracts.filter(
            (contract) =>
              contract.owner === "choice-source" &&
              contract.section === section.handle &&
              contract.handle === source.handle,
          );
          if (matches.length !== 1)
            errors.push(
              `${section.handle}:${source.handle} must have exactly one Choice Source interaction contract`,
            );
          if (source.group)
            for (const choice of canonical.choices.filter(
              (item) =>
                item.selection !== "toggle" &&
                item.groups.includes(source.group),
            )) {
              const nestedContracts = contracts.filter(
                (contract) =>
                  contract.owner === "choice" &&
                  contract.handle === choice.handle &&
                  contract.section === section.handle &&
                  contract.placement === "source" &&
                  contract.sourceHandle === source.handle &&
                  contract.sourceActivation,
              );
              if (nestedContracts.length !== 1)
                errors.push(
                  `${section.handle}:${source.handle} non-toggle member ${choice.handle} requires exactly one source-authored two-stage interaction contract; otherwise place the scalar Choice directly`,
                );
            }
        }
  }

  for (const contract of contracts) {
    const label = contract.id ?? "interaction-contract";
    const stateNames = new Set();
    for (const state of contract.states ?? []) {
      if (!INTERACTION_STATES.has(state.name))
        errors.push(`${label} has invalid state ${state.name}`);
      if (stateNames.has(state.name))
        errors.push(`${label} has duplicate state ${state.name}`);
      stateNames.add(state.name);
      if (!/\.png$/i.test(state.evidence ?? ""))
        errors.push(`${label}.${state.name} evidence must be a PNG`);
    }
    if (!contract.geometry || !GEOMETRY_POLICIES.has(contract.geometry.policy))
      errors.push(`${label}.geometry.policy is invalid`);
    if (!/\.png$/i.test(contract.geometry?.evidence ?? ""))
      errors.push(`${label}.geometry.evidence must be a PNG`);
    if (
      contract.geometry?.policy === "intentional-source-reflow" &&
      !contract.geometry.note?.trim()
    )
      errors.push(
        `${label}.geometry.note must identify the source-authorized reflow`,
      );
  }

  return errors;
}
