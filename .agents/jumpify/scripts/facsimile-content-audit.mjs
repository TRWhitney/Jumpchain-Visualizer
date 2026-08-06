function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textBase(value) {
  if (typeof value === "string") return value;
  return typeof value?.base === "string" ? value.base : undefined;
}

function looksLikeDisplayTypography(value) {
  if (typeof value !== "string") return false;
  const letters = value.match(/\p{L}/gu) ?? [];
  return letters.length >= 4 && value === value.toLocaleUpperCase();
}

function semanticComparable(value) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function visibleGrant(grant) {
  return ["perk", "item", "form", "companion", "trait"].includes(grant?.kind);
}

function grantContractKey(grant) {
  return `${grant?.kind ?? "unknown"}:${textBase(grant?.name) ?? grant?.name ?? ""}`;
}

function grantDescription(grant) {
  const block = array(grant?.text).find(
    (text) => text.handle === "description" && textBase(text.content)?.trim(),
  );
  return textBase(block?.content)?.trim();
}

function grantTags(grant) {
  return array(grant?.tags).map((tag) => textBase(tag) ?? tag);
}

function meaningfulTagErrors(tags, label) {
  const errors = [];
  if (tags.length < 1 || tags.length > 5)
    errors.push(`${label} must have between 1 and 5 effect Tags`);
  if (new Set(tags.map(semanticComparable)).size !== tags.length)
    errors.push(`${label} has duplicate-equivalent Tags`);
  if (
    tags.length &&
    tags.every((tag) =>
      GENERIC_CLASSIFICATION_TAGS.has(semanticComparable(tag)),
    )
  )
    errors.push(
      `${label} Tags only repeat a section, cost class, or grant kind; add a concrete effect Tag`,
    );
  return errors;
}

function layoutSlots(layout) {
  const slots = [];
  const visit = (node) => {
    if (!node) return;
    if (node.kind === "slot") slots.push(node.target);
    for (const child of node.children ?? []) visit(child);
  };
  visit(layout?.root);
  return slots;
}

function layoutTargets(layout, kind) {
  const targets = [];
  const visit = (node) => {
    if (!node) return;
    if (node.kind === kind && node.target) targets.push(node.target);
    for (const child of node.children ?? []) visit(child);
  };
  visit(layout?.root);
  return targets;
}

function layoutNodes(layout, predicate) {
  const nodes = [];
  const visit = (node) => {
    if (!node) return;
    if (predicate(node)) nodes.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(layout?.root);
  return nodes;
}

function choiceDescription(choice) {
  const block = array(choice?.text).find(
    (text) => text.handle === "description" && textBase(text.content)?.trim(),
  );
  return textBase(block?.content)?.trim();
}

function imageSource(image) {
  return textBase(image?.src)?.replace(/^\.\//, "");
}

function rectContains(outer, inner) {
  if (!outer || !inner) return false;
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function duplicateValues(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

function exactStringSet(left, right) {
  return (
    JSON.stringify([...array(left)].sort()) ===
    JSON.stringify([...array(right)].sort())
  );
}

function tagGrantReviewRef(scope, index, grant) {
  return `${scope}:${index}:${grantContractKey(grant)}`;
}

function justifiedUniformTagReview(review, field, values) {
  return (
    review?.status === "justified" &&
    review.reason?.trim() &&
    exactStringSet(review[field], values)
  );
}

const ALIGNMENT_RELATIONS = new Set([
  "same-row",
  "same-column",
  "left-edge",
  "right-edge",
  "top-edge",
  "bottom-edge",
  "center-x",
  "center-y",
  "equal-width",
  "equal-height",
]);

const GENERIC_CLASSIFICATION_TAGS = new Set([
  "age",
  "background",
  "choice",
  "companion",
  "drawback",
  "flaw",
  "form",
  "gender",
  "item",
  "origin",
  "perk",
  "trait",
  "world",
]);

const EFFECT_ROLE_GRANT_KINDS = {
  "entity-acquisition": new Set(["companion", "form"]),
  "entity-classification": new Set(["property"]),
  "entity-enhancement": new Set(["perk"]),
  ability: new Set(["perk"]),
  possession: new Set(["item"]),
  form: new Set(["form"]),
  "current-jump-circumstance": new Set(["trait"]),
  "identity-property": new Set(["property"]),
  "resource-change": new Set(["resource"]),
};

const STRICT_ALIGNMENT_RELATIONS = [
  "left-edge",
  "right-edge",
  "top-edge",
  "bottom-edge",
  "center-x",
  "center-y",
  "equal-width",
  "equal-height",
];

function validMeasuredRect(rect) {
  return (
    isObject(rect) &&
    ["x", "y", "width", "height"].every((field) =>
      Number.isFinite(rect[field]),
    ) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function maxDelta(values) {
  return values.length ? Math.max(...values) - Math.min(...values) : Infinity;
}

function alignmentMatches(relation, bounds, tolerance) {
  if (bounds.length < 2 || bounds.some((rect) => !validMeasuredRect(rect)))
    return false;
  if (relation === "same-row") {
    const commonTop = Math.max(...bounds.map((rect) => rect.y));
    const commonBottom = Math.min(
      ...bounds.map((rect) => rect.y + rect.height),
    );
    const ordered = [...bounds].sort((left, right) => left.x - right.x);
    return (
      commonBottom - commonTop > tolerance &&
      ordered.every(
        (rect, index) =>
          index === 0 ||
          ordered[index - 1].x + ordered[index - 1].width <= rect.x + tolerance,
      )
    );
  }
  if (relation === "same-column") {
    const commonLeft = Math.max(...bounds.map((rect) => rect.x));
    const commonRight = Math.min(...bounds.map((rect) => rect.x + rect.width));
    const ordered = [...bounds].sort((left, right) => left.y - right.y);
    return (
      commonRight - commonLeft > tolerance &&
      ordered.every(
        (rect, index) =>
          index === 0 ||
          ordered[index - 1].y + ordered[index - 1].height <=
            rect.y + tolerance,
      )
    );
  }
  const values = {
    "left-edge": bounds.map((rect) => rect.x),
    "right-edge": bounds.map((rect) => rect.x + rect.width),
    "top-edge": bounds.map((rect) => rect.y),
    "bottom-edge": bounds.map((rect) => rect.y + rect.height),
    "center-x": bounds.map((rect) => rect.x + rect.width / 2),
    "center-y": bounds.map((rect) => rect.y + rect.height / 2),
    "equal-width": bounds.map((rect) => rect.width),
    "equal-height": bounds.map((rect) => rect.height),
  }[relation];
  return maxDelta(values ?? []) <= tolerance;
}

function rectDifference(left, right) {
  if (!validMeasuredRect(left) || !validMeasuredRect(right)) return Infinity;
  return Math.max(
    ...["x", "y", "width", "height"].map((field) =>
      Math.abs(left[field] - right[field]),
    ),
  );
}

function inferredStrictRelations(bounds, tolerance) {
  return STRICT_ALIGNMENT_RELATIONS.filter((relation) =>
    alignmentMatches(relation, bounds, tolerance),
  );
}

function lostSourceRelationships(relationship, renderedBounds) {
  if (
    !Array.isArray(relationship.sourceBounds) ||
    relationship.sourceBounds.length < 2 ||
    relationship.sourceBounds.some((rect) => !validMeasuredRect(rect)) ||
    renderedBounds.length !== relationship.sourceBounds.length
  )
    return [];
  return inferredStrictRelations(
    relationship.sourceBounds,
    relationship.sourceTolerance ?? 8,
  ).filter(
    (relation) =>
      !alignmentMatches(
        relation,
        renderedBounds,
        relationship.renderTolerance ?? 2,
      ),
  );
}

export function facsimileRenderedAlignmentErrors(ledger, renderAudit) {
  const errors = [];
  const reports = renderAudit?.widths?.["1440"] ?? [];
  const entries = new Map(
    array(ledger.entries).map((entry) => [entry.id, entry]),
  );
  const sectionForEntry = (entryId, entry) => {
    const contract = array(ledger.interactionContracts).find((candidate) =>
      array(candidate.entryIds).includes(entryId),
    );
    if (contract?.section)
      return array(ledger.sections).find(
        (candidate) => candidate.handle === contract.section,
      );
    const page = array(ledger.sourcePages).find(
      (candidate) => candidate.page === entry?.page,
    );
    if (page?.sectionHandles?.length === 1)
      return array(ledger.sections).find(
        (candidate) => candidate.handle === page.sectionHandles[0],
      );
    return undefined;
  };
  for (const relationship of ledger.facsimileContracts
    ?.alignmentRelationships ?? []) {
    const measured = [];
    for (const entryId of relationship.entryIds ?? []) {
      const entry = entries.get(entryId);
      const asset = array(ledger.assets).find(
        (candidate) =>
          candidate.package &&
          candidate.kind === "panel" &&
          candidate.page === entry?.page &&
          ["x", "y", "width", "height"].every(
            (field) => candidate.rect?.[field] === entry?.rect?.[field],
          ),
      );
      const section = sectionForEntry(entryId, entry);
      const report = reports.find(
        (candidate) => candidate.index === section?.renderIndex,
      );
      const image = report?.imageBounds?.find(
        (candidate) => candidate.alt === asset?.alt,
      );
      if (!image)
        errors.push(
          `${relationship.id} could not measure rendered panel for ${entryId}`,
        );
      else measured.push(image.rect);
    }
    if (measured.length !== relationship.entryIds?.length) continue;
    measured.forEach((rect, index) => {
      if (rectDifference(rect, relationship.renderBounds?.[index]) > 0.75)
        errors.push(
          `${relationship.id}.renderBounds[${index}] does not match captured DOM geometry`,
        );
    });
    if (
      !alignmentMatches(
        relationship.relation,
        measured,
        relationship.renderTolerance ?? 2,
      )
    )
      errors.push(
        `${relationship.id} does not preserve its declared relation in captured DOM geometry`,
      );
    for (const relation of lostSourceRelationships(relationship, measured))
      errors.push(
        `${relationship.id} loses source-demonstrated ${relation} alignment in captured DOM geometry`,
      );
  }
  return errors;
}

export function facsimileContentContractErrors(
  ledger,
  canonical = null,
  options = {},
) {
  const errors = [];
  const complete = options.complete === true;
  const contract = ledger.facsimileContracts;
  if (!isObject(contract))
    return ["facsimileContracts is required for facsimile conversion"];

  for (const field of [
    "semanticNames",
    "choiceGrantSemantics",
    "referentResolutions",
    "dynamicEntities",
    "tagPlacements",
    "alignmentRelationships",
  ])
    if (!Array.isArray(contract[field]))
      errors.push(`facsimileContracts.${field} must be an array`);
  if (!isObject(contract.grantInventory))
    errors.push("facsimileContracts.grantInventory must be an object");
  if (!isObject(contract.independentReview))
    errors.push("facsimileContracts.independentReview must be an object");

  const entries = new Map(
    array(ledger.entries).map((entry) => [entry.id, entry]),
  );
  const semanticNames = array(contract.semanticNames);
  const nameHandles = semanticNames.map((record) => record.handle);
  for (const handle of duplicateValues(nameHandles))
    errors.push(`duplicate facsimile semantic name contract: ${handle}`);
  for (const record of semanticNames) {
    if (!record.handle)
      errors.push("facsimile semantic name handle is required");
    if (!record.sourceEntry || !entries.has(record.sourceEntry))
      errors.push(
        `${record.handle ?? "semantic-name"}.sourceEntry must reference a ledger entry`,
      );
    if (!record.sourceText?.trim())
      errors.push(`${record.handle ?? "semantic-name"}.sourceText is required`);
    if (!record.semanticName?.trim())
      errors.push(
        `${record.handle ?? "semantic-name"}.semanticName is required`,
      );
    if (!record.sourceEffectText?.trim())
      errors.push(
        `${record.handle ?? "semantic-name"}.sourceEffectText is required`,
      );
    if (!record.liveDescription?.trim())
      errors.push(
        `${record.handle ?? "semantic-name"}.liveDescription is required`,
      );
    const sourceEntry = entries.get(record.sourceEntry);
    if (
      record.semanticName?.trim() &&
      sourceEntry?.transcription?.trim() &&
      !semanticComparable(sourceEntry.transcription).includes(
        semanticComparable(record.semanticName),
      ) &&
      !record.developerAuthorization?.trim()
    )
      errors.push(
        `${record.handle}.semanticName is not present in its source transcription; preserve source wording or record explicit Developer authorization`,
      );
    if (
      record.sourceEffectText?.trim() &&
      sourceEntry?.transcription?.trim() &&
      !semanticComparable(sourceEntry.transcription).includes(
        semanticComparable(record.sourceEffectText),
      )
    )
      errors.push(
        `${record.handle}.sourceEffectText is not an exact contiguous extract of its source entry transcription`,
      );
    if (
      record.sourceEffectText?.trim() &&
      record.liveDescription?.trim() &&
      semanticComparable(record.sourceEffectText) !==
        semanticComparable(record.liveDescription)
    )
      errors.push(
        `${record.handle}.liveDescription paraphrases or shortens the source effect text`,
      );
    if (
      looksLikeDisplayTypography(record.semanticName) &&
      record.intentionalAllCaps !== true
    )
      errors.push(
        `${record.handle}.semanticName preserves source all-caps display typography; use semantic casing or mark a genuine acronym intentional`,
      );
    if (
      semanticComparable(record.sourceText) !==
        semanticComparable(record.semanticName) &&
      !record.normalizationNote?.trim()
    )
      errors.push(
        `${record.handle}.normalizationNote is required when semantic wording differs from source display text`,
      );
  }

  const choiceGrantSemantics = array(contract.choiceGrantSemantics);
  const semanticGrantKeys = choiceGrantSemantics.map(
    (record) => `${record.choiceHandle}:${record.grantIndex}`,
  );
  for (const key of duplicateValues(semanticGrantKeys))
    errors.push(`duplicate facsimile Choice grant semantic contract: ${key}`);
  for (const record of choiceGrantSemantics) {
    const label = `${record.choiceHandle ?? "choice"}.grant[${record.grantIndex ?? "?"}]`;
    const sourceEntry = entries.get(record.sourceEntry);
    if (!record.choiceHandle) errors.push(`${label}.choiceHandle is required`);
    if (!Number.isInteger(record.grantIndex) || record.grantIndex < 0)
      errors.push(`${label}.grantIndex must be a non-negative integer`);
    if (!sourceEntry)
      errors.push(`${label}.sourceEntry must reference a ledger entry`);
    if (!record.sourceEvidence?.trim())
      errors.push(`${label}.sourceEvidence is required`);
    else if (
      sourceEntry?.transcription?.trim() &&
      !semanticComparable(sourceEntry.transcription).includes(
        semanticComparable(record.sourceEvidence),
      )
    )
      errors.push(`${label}.sourceEvidence is not present in its source entry`);
    if (!EFFECT_ROLE_GRANT_KINDS[record.effectRole])
      errors.push(`${label}.effectRole is invalid`);
    if (!record.reason?.trim()) errors.push(`${label}.reason is required`);
  }

  for (const record of array(contract.referentResolutions)) {
    const label = `referent resolution ${record.sourceEntry ?? "unknown"}`;
    const sourceEntry = entries.get(record.sourceEntry);
    if (!sourceEntry) errors.push(`${label} references a missing source entry`);
    if (!record.sourceEvidence?.trim())
      errors.push(`${label}.sourceEvidence is required`);
    else if (semanticComparable(record.sourceEvidence).split(/\s+/u).length < 3)
      errors.push(
        `${label}.sourceEvidence must include enough contiguous context to establish the relationship`,
      );
    else if (
      sourceEntry?.transcription?.trim() &&
      !semanticComparable(sourceEntry.transcription).includes(
        semanticComparable(record.sourceEvidence),
      )
    )
      errors.push(`${label}.sourceEvidence is not present in its source entry`);
    if (
      !["same-entity", "new-entity", "narrative-only"].includes(
        record.resolution,
      )
    )
      errors.push(`${label}.resolution is invalid`);
    if (
      ["same-entity", "new-entity"].includes(record.resolution) &&
      !(
        (record.targetChoiceHandle && record.targetGrantHandle) ||
        record.targetJumpGrantRef
      )
    )
      errors.push(
        `${label} must identify either the canonical Choice grant or exact Jump grant for an entity resolution`,
      );
    if (
      record.targetJumpGrantRef &&
      (record.targetChoiceHandle || record.targetGrantHandle)
    )
      errors.push(
        `${label} must not mix Choice-grant and Jump-grant entity targets`,
      );
    if (record.resolution === "new-entity") {
      if (!record.distinctnessEvidence?.trim())
        errors.push(
          `${label}.distinctnessEvidence is required for a new entity`,
        );
      else if (
        sourceEntry?.transcription?.trim() &&
        !semanticComparable(sourceEntry.transcription).includes(
          semanticComparable(record.distinctnessEvidence),
        )
      )
        errors.push(
          `${label}.distinctnessEvidence is not present in its source entry`,
        );
      if (!Array.isArray(record.comparedDynamicEntityRefs))
        errors.push(
          `${label}.comparedDynamicEntityRefs must inventory same-kind dynamic candidates`,
        );
      if (
        ![
          "explicit-additionality",
          "independent-slot-or-count",
          "simultaneous-possession",
          "incompatible-source-identity",
        ].includes(record.distinctnessBasis)
      )
        errors.push(`${label}.distinctnessBasis is required for a new entity`);
    }
    if (!record.reason?.trim()) errors.push(`${label}.reason is required`);
  }

  const inventory = contract.grantInventory;
  if (isObject(inventory)) {
    if (!Array.isArray(inventory.entryDecisions))
      errors.push(
        "facsimileContracts.grantInventory.entryDecisions must be an array",
      );
    else {
      const expectedReviewed = [...entries.values()]
        .filter((entry) => ["prose", "choice"].includes(entry.sourceKind))
        .map((entry) => entry.id)
        .sort();
      const actualReviewed = inventory.entryDecisions
        .map((decision) => decision.entryId)
        .sort();
      if (JSON.stringify(actualReviewed) !== JSON.stringify(expectedReviewed))
        errors.push(
          "facsimileContracts.grantInventory.entryDecisions must contain exactly one decision for every prose and Choice entry",
        );
      for (const decision of inventory.entryDecisions) {
        const label = `grant decision ${decision.entryId ?? "unknown"}`;
        const sourceEntry = entries.get(decision.entryId);
        const clauses = array(decision.clauses);
        if (!clauses.length) errors.push(`${label}.clauses must not be empty`);
        const clauseEvidence = clauses.map((clause) =>
          semanticComparable(clause.sourceEvidence),
        );
        if (
          clauseEvidence.some(
            (evidence, index) =>
              evidence && clauseEvidence.indexOf(evidence) !== index,
          )
        )
          errors.push(
            `${label}.clauses must not reuse one evidence span for distinct semantic forces`,
          );
        const declaredKeys = [];
        for (const [clauseIndex, clause] of clauses.entries()) {
          const clauseLabel = `${label}.clauses[${clauseIndex}]`;
          if (!clause.reason?.trim())
            errors.push(`${clauseLabel}.reason is required`);
          if (!clause.sourceEvidence?.trim())
            errors.push(`${clauseLabel}.sourceEvidence is required`);
          else if (
            sourceEntry?.transcription?.trim() &&
            !semanticComparable(sourceEntry.transcription).includes(
              semanticComparable(clause.sourceEvidence),
            )
          )
            errors.push(
              `${clauseLabel}.sourceEvidence is not present in its source entry`,
            );
          if (
            ![
              "explicit-grant",
              "retained-existing",
              "narrative",
              "current-jump-rule",
              "conditional-choice-effect",
              "mechanical-instruction",
              "presentation",
            ].includes(clause.semanticForce)
          )
            errors.push(`${clauseLabel}.semanticForce is invalid`);
          const dispositions = array(clause.dispositions);
          if (!dispositions.length)
            errors.push(`${clauseLabel}.dispositions must not be empty`);
          if (new Set(dispositions).size !== dispositions.length)
            errors.push(
              `${clauseLabel}.dispositions must not contain duplicates`,
            );
          if (dispositions.includes("no-grant") && dispositions.length !== 1)
            errors.push(
              `${clauseLabel} cannot combine no-grant with a grant disposition`,
            );
          if (
            dispositions.includes("jump-grant") &&
            !["explicit-grant", "current-jump-rule"].includes(
              clause.semanticForce,
            )
          )
            errors.push(
              `${clauseLabel} cannot create an unconditional grant from ${clause.semanticForce} wording`,
            );
          if (
            !dispositions.every((value) =>
              [
                "jump-grant",
                "choice-grant",
                "shared-choice-grant",
                "no-grant",
              ].includes(value),
            )
          )
            errors.push(
              `${clauseLabel}.dispositions contains an invalid value`,
            );
          const clauseKeys = array(clause.grantKeys);
          if (dispositions.includes("jump-grant")) {
            if (!clauseKeys.length)
              errors.push(
                `${clauseLabel}.grantKeys must enumerate every unconditional grant produced by that clause`,
              );
            declaredKeys.push(...clauseKeys);
            for (const key of clauseKeys) {
              const declaredGrant = array(inventory.grants).find(
                (grant) =>
                  grant.entryId === decision.entryId &&
                  grantContractKey(grant) === key,
              );
              if (
                declaredGrant?.description?.trim() &&
                !semanticComparable(clause.sourceEvidence).includes(
                  semanticComparable(declaredGrant.description),
                )
              )
                errors.push(
                  `${clauseLabel} cannot own ${key}; its exact evidence does not contain that grant's complete effect`,
                );
            }
          } else if (clauseKeys.length)
            errors.push(
              `${clauseLabel}.grantKeys is allowed only with a jump-grant disposition`,
            );
          if (dispositions.includes("shared-choice-grant")) {
            if (!clause.sharedEffectText?.trim())
              errors.push(`${clauseLabel}.sharedEffectText is required`);
            else if (
              sourceEntry?.transcription?.trim() &&
              !semanticComparable(sourceEntry.transcription).includes(
                semanticComparable(clause.sharedEffectText),
              )
            )
              errors.push(
                `${clauseLabel}.sharedEffectText is not an exact contiguous extract of its source entry transcription`,
              );
            if (!array(clause.targetHandles).length)
              errors.push(`${clauseLabel}.targetHandles must not be empty`);
          }
        }
        if (new Set(declaredKeys).size !== declaredKeys.length)
          errors.push(
            `${label} assigns an unconditional grant to multiple clauses`,
          );
        const expectedKeys = array(inventory.grants)
          .filter((grant) => grant.entryId === decision.entryId)
          .map(grantContractKey)
          .sort();
        if (
          JSON.stringify([...declaredKeys].sort()) !==
          JSON.stringify(expectedKeys)
        )
          errors.push(
            `${label}.clauses must exactly reconcile the unconditional grant inventory for that source entry`,
          );
      }
    }
    if (!Array.isArray(inventory.sourceEntryIds))
      errors.push(
        "facsimileContracts.grantInventory.sourceEntryIds must be an array",
      );
    else
      for (const entryId of inventory.sourceEntryIds)
        if (!entries.has(entryId))
          errors.push(`grant inventory references missing entry ${entryId}`);
    if (!Array.isArray(inventory.grants))
      errors.push("facsimileContracts.grantInventory.grants must be an array");
    else {
      const canonicalGrantRefs = inventory.grants
        .map((grant) => grant.canonicalGrantRef)
        .filter(Boolean);
      if (duplicateValues(canonicalGrantRefs).length)
        errors.push(
          "facsimileContracts.grantInventory.grants canonicalGrantRef values must be unique",
        );
      for (const grant of inventory.grants) {
        if (!grant.entryId || !entries.has(grant.entryId))
          errors.push(
            `unconditional grant ${grant.kind ?? "unknown"}:${grant.name ?? "unnamed"} must reference a source entry`,
          );
        if (!visibleGrant(grant) || !grant.name?.trim())
          errors.push(
            "every unconditional grant contract requires a visible kind and name",
          );
        if (!grant.description?.trim())
          errors.push(
            `unconditional grant ${grant.kind ?? "unknown"}:${grant.name ?? "unnamed"} requires a complete live description`,
          );
        errors.push(
          ...meaningfulTagErrors(
            array(grant.tags),
            `unconditional grant ${grant.kind ?? "unknown"}:${grant.name ?? "unnamed"}`,
          ),
        );
        if (!grant.tagRationale?.trim())
          errors.push(
            `unconditional grant ${grant.kind ?? "unknown"}:${grant.name ?? "unnamed"}.tagRationale is required`,
          );
        if (
          ["companion", "form"].includes(grant.kind) &&
          !grant.canonicalGrantRef?.trim()
        )
          errors.push(
            `unconditional grant ${grant.kind}:${grant.name ?? "unnamed"}.canonicalGrantRef is required`,
          );
        const sourceEntry = entries.get(grant.entryId);
        if (
          grant.description?.trim() &&
          sourceEntry?.transcription?.trim() &&
          !semanticComparable(sourceEntry.transcription).includes(
            semanticComparable(grant.description),
          )
        )
          errors.push(
            `unconditional grant ${grant.kind ?? "unknown"}:${grant.name ?? "unnamed"} description is not an exact contiguous extract of its source entry transcription`,
          );
      }
    }
    const declaredGrantEntries = [
      ...new Set(array(inventory.grants).map((grant) => grant.entryId)),
    ].sort();
    const sourceGrantEntries = [
      ...new Set(array(inventory.sourceEntryIds)),
    ].sort();
    if (
      JSON.stringify(declaredGrantEntries) !==
      JSON.stringify(sourceGrantEntries)
    )
      errors.push(
        "facsimileContracts.grantInventory.sourceEntryIds must exactly identify the entries that produced unconditional grants",
      );
    const jumpGrantDecisionEntries = array(inventory.entryDecisions)
      .filter((decision) =>
        array(decision.clauses).some((clause) =>
          array(clause.dispositions).includes("jump-grant"),
        ),
      )
      .map((decision) => decision.entryId)
      .sort();
    if (
      JSON.stringify(jumpGrantDecisionEntries) !==
      JSON.stringify(sourceGrantEntries)
    )
      errors.push(
        "facsimileContracts.grantInventory jump-grant decisions must exactly match sourceEntryIds",
      );
    if (!inventory.note?.trim())
      errors.push("facsimileContracts.grantInventory.note is required");
    if (complete && inventory.status !== "complete")
      errors.push("facsimileContracts.grantInventory must be complete");
  }

  for (const entity of array(contract.dynamicEntities)) {
    const label = entity.choiceHandle ?? "dynamic-entity";
    if (!entity.choiceHandle || !entity.grantHandle)
      errors.push(`${label} requires choiceHandle and grantHandle`);
    if (!entity.contextLabel?.trim())
      errors.push(`${label}.contextLabel is required`);
    if (!entity.visibleNameTemplate?.includes("{{"))
      errors.push(
        `${label}.visibleNameTemplate must interpolate the entered value`,
      );
    if (!Array.isArray(entity.classificationChoiceHandles))
      errors.push(`${label}.classificationChoiceHandles must be an array`);
    if (array(entity.classificationChoiceHandles).length) {
      if (!entity.classificationPropertyHandle)
        errors.push(
          `${label}.classificationPropertyHandle is required when the source classifies the entity`,
        );
      if (!entity.classificationSourceHandle)
        errors.push(
          `${label}.classificationSourceHandle is required when the source classifies the entity`,
        );
      if (
        !entity.visibleNameTemplate?.includes(
          `{{${entity.classificationPropertyHandle}}}`,
        )
      )
        errors.push(
          `${label}.visibleNameTemplate must interpolate the selected classification {{${entity.classificationPropertyHandle}}}`,
        );
    } else if (
      entity.contextLabel &&
      !entity.visibleNameTemplate
        ?.toLocaleLowerCase()
        .includes(entity.contextLabel.toLocaleLowerCase())
    )
      errors.push(
        `${label}.visibleNameTemplate must include its context label`,
      );
    if (!Array.isArray(entity.upgradeHandles))
      errors.push(`${label}.upgradeHandles must be an array`);
    if (!entity.creationEvidence?.trim())
      errors.push(`${label}.creationEvidence is required`);
    if (!entity.trackerEvidence?.trim())
      errors.push(`${label}.trackerEvidence is required`);
    if (entity.upgradeHandles?.length && !entity.upgradeEvidence?.trim())
      errors.push(`${label}.upgradeEvidence is required when upgrades exist`);
  }

  const tagPlacements = array(contract.tagPlacements);
  const tagHandles = tagPlacements.map((record) => record.choiceHandle);
  for (const handle of duplicateValues(tagHandles))
    errors.push(`duplicate facsimile Tag placement contract: ${handle}`);
  for (const record of tagPlacements) {
    const label = record.choiceHandle ?? "tag-placement";
    if (!record.choiceHandle)
      errors.push("Tag placement choiceHandle is required");
    if (!["placed", "not-applicable"].includes(record.decision))
      errors.push(`${label}.decision must be placed or not-applicable`);
    if (!Array.isArray(record.tags))
      errors.push(`${label}.tags must be an array`);
    if (record.decision === "placed") {
      errors.push(...meaningfulTagErrors(record.tags ?? [], label));
      if (!record.tagRationale?.trim())
        errors.push(`${label}.tagRationale is required for placed Tags`);
      if (!record.layoutHandle)
        errors.push(`${label}.layoutHandle is required`);
      if (
        !Array.isArray(record.railOrder) ||
        !record.railOrder.includes("tags")
      )
        errors.push(`${label}.railOrder must include tags`);
    } else if (!record.reason?.trim())
      errors.push(`${label}.reason is required when Tags are not applicable`);
    else if (
      /(?:source|art|document).{0,40}(?:no|without|omit|lack).{0,20}tag|(?:no|without|omit|lack).{0,20}tag.{0,40}(?:source|art|document)/iu.test(
        record.reason,
      )
    )
      errors.push(
        `${label}.reason cannot use the absence of source Tag strings; derive Tags from the live effect`,
      );
  }
  if (
    complete &&
    tagPlacements.length &&
    !tagPlacements.some((item) => item.decision === "placed")
  )
    errors.push(
      "a complete interactive facsimile must place applicable live Tags; every Choice was marked not-applicable",
    );
  const placedTagCounts = tagPlacements
    .filter((record) => record.decision === "placed")
    .map((record) => array(record.tags).length);
  if (
    placedTagCounts.length >= 8 &&
    placedTagCounts.every((count) => count === 1) &&
    !justifiedUniformTagReview(
      contract.tagCardinalityReview,
      "choiceHandles",
      tagPlacements
        .filter((record) => record.decision === "placed")
        .map((record) => record.choiceHandle),
    )
  )
    errors.push(
      "Choice Tags are suspiciously uniform: a substantial conversion with one Tag on every Choice requires an exact justified tagCardinalityReview",
    );

  for (const relationship of array(contract.alignmentRelationships)) {
    const label = relationship.id ?? "alignment-relationship";
    if (!relationship.id) errors.push("alignment relationship id is required");
    if (
      !Array.isArray(relationship.entryIds) ||
      relationship.entryIds.length < 2
    )
      errors.push(
        `${label}.entryIds must identify at least two related source surfaces`,
      );
    else
      for (const entryId of relationship.entryIds)
        if (!entries.has(entryId))
          errors.push(`${label} references missing entry ${entryId}`);
    if (!relationship.sourceRelation?.trim())
      errors.push(`${label}.sourceRelation is required`);
    if (!ALIGNMENT_RELATIONS.has(relationship.relation))
      errors.push(`${label}.relation is invalid`);
    if (relationship.width !== 1440)
      errors.push(`${label}.width must be the 1440px primary comparison`);
    if (
      !Array.isArray(relationship.sourceBounds) ||
      relationship.sourceBounds.length < 2
    )
      errors.push(
        `${label}.sourceBounds must contain at least two measured rectangles`,
      );
    else if (relationship.sourceBounds.length !== relationship.entryIds?.length)
      errors.push(`${label}.sourceBounds must correspond to entryIds in order`);
    else {
      relationship.entryIds.forEach((entryId, index) => {
        const entryRect = entries.get(entryId)?.rect;
        if (
          JSON.stringify(relationship.sourceBounds[index]) !==
          JSON.stringify(entryRect)
        )
          errors.push(
            `${label}.sourceBounds[${index}] must equal ${entryId}.rect`,
          );
      });
      if (
        ALIGNMENT_RELATIONS.has(relationship.relation) &&
        !alignmentMatches(
          relationship.relation,
          relationship.sourceBounds,
          relationship.sourceTolerance ?? 8,
        )
      )
        errors.push(
          `${label} does not demonstrate its declared source relation`,
        );
    }
    if (!Array.isArray(relationship.renderBounds))
      errors.push(`${label}.renderBounds must be an array`);
    if (
      complete &&
      relationship.status !== "pass" &&
      !/^gap:.+/.test(relationship.status ?? "")
    )
      errors.push(
        `${label}.status must be pass or a demonstrated gap when complete`,
      );
    if (complete && !relationship.evidence?.trim())
      errors.push(`${label}.evidence is required when complete`);
    if (
      complete &&
      relationship.renderBounds?.length !== relationship.entryIds?.length
    )
      errors.push(
        `${label}.renderBounds must measure every entryId when complete`,
      );
    else if (
      complete &&
      ALIGNMENT_RELATIONS.has(relationship.relation) &&
      !alignmentMatches(
        relationship.relation,
        relationship.renderBounds,
        relationship.renderTolerance ?? 2,
      )
    )
      errors.push(`${label} does not preserve its declared rendered relation`);
    if (complete)
      for (const relation of lostSourceRelationships(
        relationship,
        relationship.renderBounds ?? [],
      ))
        errors.push(`${label} loses source-demonstrated ${relation} alignment`);
  }
  if (complete && !array(contract.alignmentRelationships).length)
    errors.push(
      "a complete facsimile requires measured alignment relationships",
    );

  const review = contract.independentReview;
  if (isObject(review)) {
    if (!["clean-context-agent", "independent-human"].includes(review.reviewer))
      errors.push("facsimileContracts.independentReview.reviewer is invalid");
    if (!Array.isArray(review.findings))
      errors.push(
        "facsimileContracts.independentReview.findings must be an array",
      );
    else
      for (const finding of review.findings) {
        if (
          !finding.id ||
          !finding.description?.trim() ||
          !finding.evidence?.trim()
        )
          errors.push(
            "every independent review finding requires id, description, and evidence",
          );
        if (!["open", "resolved", "gap"].includes(finding.status))
          errors.push(`${finding.id ?? "review-finding"}.status is invalid`);
        if (complete && finding.status === "open")
          errors.push(`${finding.id} remains open after independent review`);
      }
    const expectedContinuityReviews = array(contract.referentResolutions)
      .filter((record) => record.resolution === "new-entity")
      .map((record) => ({
        sourceEntry: record.sourceEntry,
        targetRef:
          record.targetJumpGrantRef ??
          `choice:${record.targetChoiceHandle}:${record.targetGrantHandle}`,
      }));
    const actualContinuityReviews = array(review.entityContinuityReviews);
    const expectedContinuityKeys = expectedContinuityReviews.map(
      (record) => `${record.sourceEntry}|${record.targetRef}`,
    );
    const actualContinuityKeys = actualContinuityReviews.map(
      (record) => `${record.sourceEntry}|${record.targetRef}`,
    );
    const continuityReviewDue = complete || review.status !== "unreviewed";
    if (continuityReviewDue) {
      if (!exactStringSet(expectedContinuityKeys, actualContinuityKeys))
        errors.push(
          "facsimileContracts.independentReview.entityContinuityReviews must exactly adjudicate every new-entity resolution",
        );
      if (duplicateValues(actualContinuityKeys).length)
        errors.push(
          "facsimileContracts.independentReview.entityContinuityReviews contains duplicate targets",
        );
      for (const continuityReview of actualContinuityReviews) {
        if (
          !continuityReview.reason?.trim() ||
          !continuityReview.evidence?.trim()
        )
          errors.push(
            `entity continuity review ${continuityReview.sourceEntry ?? "unknown"} requires independent reason and evidence`,
          );
        if (!["supported", "unsupported"].includes(continuityReview.status))
          errors.push(
            `entity continuity review ${continuityReview.sourceEntry ?? "unknown"}.status is invalid`,
          );
        if (complete && continuityReview.status !== "supported")
          errors.push(
            `entity continuity review ${continuityReview.sourceEntry ?? "unknown"} remains unsupported`,
          );
      }
    }
    if (complete && review.status !== "pass")
      errors.push("facsimileContracts.independentReview must pass");
    if (complete && !review.evidence?.trim())
      errors.push("facsimileContracts.independentReview.evidence is required");
  }

  if (!canonical) return errors;

  const choices = new Map(
    array(canonical.choices).map((choice) => [choice.handle, choice]),
  );
  const actualChoiceGrantKeys = [];
  for (const choice of choices.values())
    array(choice.grants).forEach((_grant, grantIndex) =>
      actualChoiceGrantKeys.push(`${choice.handle}:${grantIndex}`),
    );
  if (
    JSON.stringify([...semanticGrantKeys].sort()) !==
    JSON.stringify(actualChoiceGrantKeys.sort())
  )
    errors.push(
      "facsimileContracts.choiceGrantSemantics must contain exactly one source-evidenced semantic role for every canonical Choice grant",
    );
  for (const record of choiceGrantSemantics) {
    const owningEntry = semanticNames.find(
      (semantic) => semantic.handle === record.choiceHandle,
    )?.sourceEntry;
    const sharedSource = array(inventory?.entryDecisions).some(
      (decision) =>
        decision.entryId === record.sourceEntry &&
        array(decision.clauses).some(
          (clause) =>
            array(clause.dispositions).includes("shared-choice-grant") &&
            array(clause.targetHandles).includes(record.choiceHandle),
        ),
    );
    if (record.sourceEntry !== owningEntry && !sharedSource)
      errors.push(
        `${record.choiceHandle}.grant[${record.grantIndex}] cites source ${record.sourceEntry} that neither owns the Choice nor declares a shared effect for it`,
      );
  }
  for (const record of array(contract.referentResolutions)) {
    if (!["same-entity", "new-entity"].includes(record.resolution)) continue;
    const targetChoice = choices.get(record.targetChoiceHandle);
    const choiceTargetGrant = array(targetChoice?.grants).find(
      (grant) => grant.handle === record.targetGrantHandle,
    );
    const jumpTargetGrant = array(canonical.grants)
      .map((grant, index) => ({
        grant,
        ref: tagGrantReviewRef("jump", index, grant),
      }))
      .find(({ ref }) => ref === record.targetJumpGrantRef)?.grant;
    const targetGrant = choiceTargetGrant ?? jumpTargetGrant;
    if (record.targetChoiceHandle && !targetChoice)
      errors.push(
        `referent resolution ${record.sourceEntry} targets missing Choice ${record.targetChoiceHandle}`,
      );
    else if (record.targetChoiceHandle && !choiceTargetGrant)
      errors.push(
        `referent resolution ${record.sourceEntry} targets missing grant ${record.targetGrantHandle} on Choice ${record.targetChoiceHandle}`,
      );
    if (record.targetJumpGrantRef && !jumpTargetGrant)
      errors.push(
        `referent resolution ${record.sourceEntry} targets missing Jump grant ${record.targetJumpGrantRef}`,
      );
    if (record.targetJumpGrantRef) {
      const reviewedJumpGrant = array(inventory?.grants).find(
        (grant) => grant.canonicalGrantRef === record.targetJumpGrantRef,
      );
      if (!reviewedJumpGrant)
        errors.push(
          `referent resolution ${record.sourceEntry} Jump target ${record.targetJumpGrantRef} has no exact grant-inventory record`,
        );
      else if (reviewedJumpGrant.entryId !== record.sourceEntry)
        errors.push(
          `referent resolution ${record.sourceEntry} Jump target ${record.targetJumpGrantRef} belongs to source entry ${reviewedJumpGrant.entryId}`,
        );
    }
    if (!targetGrant) continue;

    if (record.resolution === "new-entity") {
      const comparedDynamicEntityRefs = array(contract.dynamicEntities)
        .filter(
          (entity) =>
            entity.kind === targetGrant.kind &&
            !(
              entity.choiceHandle === record.targetChoiceHandle &&
              entity.grantHandle === record.targetGrantHandle
            ),
        )
        .map((entity) => `${entity.choiceHandle}:${entity.grantHandle}`);
      if (
        !exactStringSet(
          record.comparedDynamicEntityRefs,
          comparedDynamicEntityRefs,
        )
      )
        errors.push(
          `referent resolution ${record.sourceEntry}.comparedDynamicEntityRefs must exactly inventory every other dynamic ${targetGrant.kind} candidate`,
        );
    }

    if (record.resolution === "same-entity") {
      const owningChoiceHandles = semanticNames
        .filter((semantic) => semantic.sourceEntry === record.sourceEntry)
        .map((semantic) => semantic.handle);
      const competingGrants = owningChoiceHandles.flatMap(
        (owningChoiceHandle) =>
          array(choices.get(owningChoiceHandle)?.grants).filter(
            (grant) =>
              grant.kind === targetGrant.kind &&
              !(
                owningChoiceHandle === record.targetChoiceHandle &&
                grant.handle === record.targetGrantHandle
              ),
          ),
      );
      const competingJumpGrants = array(inventory?.grants).filter(
        (grant) =>
          grant.entryId === record.sourceEntry &&
          grant.kind === targetGrant.kind &&
          !array(canonical.grants).some(
            (actual, index) =>
              tagGrantReviewRef("jump", index, actual) ===
                record.targetJumpGrantRef &&
              grantContractKey(actual) === `${grant.kind}:${grant.name}`,
          ),
      );
      if (competingGrants.length || competingJumpGrants.length)
        errors.push(
          `referent resolution ${record.sourceEntry} is same-entity but its source entry also creates a competing ${targetGrant.kind} grant`,
        );
    }
  }

  const dynamicEntityGrantTargets = new Set(
    array(contract.dynamicEntities).map(
      (entity) => `${entity.choiceHandle}:${entity.grantHandle}`,
    ),
  );
  const continuityCandidates = [];
  for (const choice of choices.values())
    array(choice.grants).forEach((grant) => {
      if (!["companion", "form"].includes(grant.kind)) return;
      if (dynamicEntityGrantTargets.has(`${choice.handle}:${grant.handle}`))
        return;
      if (
        !array(contract.dynamicEntities).some(
          (entity) => entity.kind === grant.kind,
        )
      )
        return;
      continuityCandidates.push({
        label: `Choice ${choice.handle} grant ${grant.handle}`,
        matches: array(contract.referentResolutions).filter(
          (record) =>
            record.resolution === "new-entity" &&
            record.targetChoiceHandle === choice.handle &&
            record.targetGrantHandle === grant.handle,
        ),
      });
    });
  array(canonical.grants).forEach((grant, index) => {
    if (!["companion", "form"].includes(grant.kind)) return;
    if (
      !array(contract.dynamicEntities).some(
        (entity) => entity.kind === grant.kind,
      )
    )
      return;
    const ref = tagGrantReviewRef("jump", index, grant);
    continuityCandidates.push({
      label: `Jump grant ${ref}`,
      matches: array(contract.referentResolutions).filter(
        (record) =>
          record.resolution === "new-entity" &&
          record.targetJumpGrantRef === ref,
      ),
    });
  });
  for (const candidate of continuityCandidates)
    if (candidate.matches.length !== 1)
      errors.push(
        `${candidate.label} must have exactly one new-entity continuity resolution against same-kind dynamic entities`,
      );
  for (const decision of array(inventory?.entryDecisions)) {
    for (const clause of array(decision.clauses)) {
      if (!array(clause.dispositions).includes("shared-choice-grant")) continue;
      for (const handle of array(clause.targetHandles)) {
        const choice = choices.get(handle);
        if (!choice)
          errors.push(
            `grant decision ${decision.entryId} references missing Choice ${handle}`,
          );
        else if (
          !array(choice.grants).some(
            (grant) =>
              grant.kind === "trait" &&
              semanticComparable(grantDescription(grant)).includes(
                semanticComparable(clause.sharedEffectText),
              ),
          )
        )
          errors.push(
            `Choice ${handle} does not preserve shared Trait effect from ${decision.entryId}`,
          );
      }
    }
  }
  const layouts = new Map(
    array(canonical.layouts).map((layout) => [layout.handle, layout]),
  );
  const discountedGroups = new Set(
    [...choices.values()].flatMap((choice) =>
      array(choice.discounts).map((discount) => discount.group),
    ),
  );
  for (const choice of choices.values()) {
    const record = semanticNames.find((item) => item.handle === choice.handle);
    if (!record)
      errors.push(`Choice ${choice.handle} has no semantic name contract`);
    else if (record.semanticName !== textBase(choice.name))
      errors.push(
        `Choice ${choice.handle} name is ${JSON.stringify(textBase(choice.name))}, expected semantic name ${JSON.stringify(record.semanticName)}`,
      );
    const layout = layouts.get(choice.layout);
    if (choice.selection === "select" && !array(choice.options).length)
      errors.push(`Choice ${choice.handle} select control has no options`);
    if (
      choice.selection === "text" &&
      !(textBase(choice.placeholder) ?? choice.placeholder)?.trim()
    )
      errors.push(
        `Choice ${choice.handle} text control requires a meaningful placeholder`,
      );
    else if (
      choice.selection === "text" &&
      ["enter value", "type here", "value", "text"].includes(
        semanticComparable(textBase(choice.placeholder) ?? choice.placeholder),
      )
    )
      errors.push(
        `Choice ${choice.handle} text control placeholder must identify the value being entered`,
      );
    const reservedIdentityName = semanticComparable(textBase(choice.name));
    if (
      ["age", "gender", "location", "origin"].includes(reservedIdentityName)
    ) {
      const property = array(choice.grants).find(
        (grant) => grant.kind === "property",
      );
      if (property?.handle !== reservedIdentityName)
        errors.push(
          `Choice ${choice.handle} represents reserved ${reservedIdentityName} identity but does not grant that reserved Property`,
        );
    }
    if (
      array(choice.costs).some((cost) => cost.mode === "each") &&
      array(choice.groups).some((group) => discountedGroups.has(group)) &&
      layoutNodes(
        layout,
        (node) =>
          node.kind === "slot" &&
          node.target === "cost" &&
          node.presentation?.costDensity === "compact",
      ).length
    )
      errors.push(
        `Choice ${choice.handle} uses compact Cost density even though a repeatable discounted total must remain visibly readable`,
      );
    const sourceEntry = entries.get(record?.sourceEntry);
    const panelStrategy = record?.panelStrategy ?? "intact";
    const sourcePanelAsset = array(ledger.assets).find(
      (asset) =>
        asset.package &&
        asset.kind === "panel" &&
        asset.page === sourceEntry?.page &&
        ["x", "y", "width", "height"].every(
          (field) => asset.rect?.[field] === sourceEntry?.rect?.[field],
        ),
    );
    const sourcePanelImage = array(choice.images).find(
      (image) => imageSource(image) === sourcePanelAsset?.output,
    );
    if (panelStrategy === "measured-fragments") {
      const declaredFragments = array(record?.sourcePanelAssets);
      if (declaredFragments.length < 2)
        errors.push(
          `Choice ${choice.handle} measured-fragments strategy requires at least two sourcePanelAssets`,
        );
      if (!record?.decompositionReason?.trim())
        errors.push(
          `Choice ${choice.handle} measured-fragments strategy requires decompositionReason`,
        );
      for (const output of declaredFragments) {
        const asset = array(ledger.assets).find(
          (candidate) => candidate.output === output,
        );
        if (
          !asset ||
          !asset.package ||
          asset.kind !== "panel" ||
          asset.page !== sourceEntry?.page ||
          !rectContains(sourceEntry?.rect, asset.rect)
        )
          errors.push(
            `Choice ${choice.handle} source fragment ${output} must be a packaged panel contained by its source entry`,
          );
        const image = array(choice.images).find(
          (candidate) => imageSource(candidate) === output,
        );
        if (!image)
          errors.push(
            `Choice ${choice.handle} does not declare measured source fragment ${output}`,
          );
        else if (!layoutTargets(layout, "image").includes(image.handle))
          errors.push(
            `Choice ${choice.handle} layout does not render measured source fragment ${image.handle}`,
          );
      }
    } else {
      if (record?.sourcePanelAssets?.length || record?.decompositionReason)
        errors.push(
          `Choice ${choice.handle} sourcePanelAssets and decompositionReason require measured-fragments strategy`,
        );
      if (!sourcePanelAsset)
        errors.push(
          `Choice ${choice.handle} has no packaged intact source-panel asset`,
        );
      else if (!sourcePanelImage)
        errors.push(
          `Choice ${choice.handle} does not declare its intact source-panel asset ${sourcePanelAsset.output}`,
        );
      else if (
        !layoutTargets(layout, "image").includes(sourcePanelImage.handle)
      )
        errors.push(
          `Choice ${choice.handle} layout does not render its intact source panel ${sourcePanelImage.handle}; a title fragment or retyped description is not a facsimile substitute`,
        );
    }
    const description = choiceDescription(choice);
    if (
      record &&
      semanticComparable(description) !==
        semanticComparable(record.liveDescription)
    )
      errors.push(
        `Choice ${choice.handle} description does not match its reviewed live description`,
      );
    if (
      description?.length >= 40 &&
      layoutTargets(layout, "image").includes("source_panel") &&
      layoutTargets(layout, "text").includes("description") &&
      semanticComparable(sourceEntry?.transcription).includes(
        semanticComparable(description),
      )
    )
      errors.push(
        `Choice ${choice.handle} visibly duplicates its description beneath a source panel that already contains the same prose`,
      );
    const tagRecord = tagPlacements.find(
      (item) => item.choiceHandle === choice.handle,
    );
    if (!tagRecord)
      errors.push(`Choice ${choice.handle} has no Tag placement decision`);
    else {
      const actualTags = [...array(choice.tags)].sort();
      const expectedTags = [...array(tagRecord.tags)].sort();
      if (JSON.stringify(actualTags) !== JSON.stringify(expectedTags))
        errors.push(
          `Choice ${choice.handle} Tags do not match its placement contract`,
        );
      if (tagRecord.decision === "placed") {
        if (choice.layout !== tagRecord.layoutHandle)
          errors.push(
            `Choice ${choice.handle} does not use Tag layout ${tagRecord.layoutHandle}`,
          );
        const slots = layoutSlots(layouts.get(tagRecord.layoutHandle));
        if (!slots.includes("tags"))
          errors.push(
            `Choice layout ${tagRecord.layoutHandle} has no live tags slot`,
          );
        const expected = tagRecord.railOrder;
        let cursor = -1;
        for (const target of expected) {
          const next = slots.indexOf(target, cursor + 1);
          if (next === -1) {
            errors.push(
              `Choice layout ${tagRecord.layoutHandle} does not preserve rail order ${expected.join(" -> ")}`,
            );
            break;
          }
          cursor = next;
        }
        const controlIndex = slots.indexOf("control");
        const tagsIndex = slots.indexOf("tags");
        const costIndex = slots.indexOf("cost");
        if (
          controlIndex !== -1 &&
          tagsIndex !== -1 &&
          costIndex !== -1 &&
          !(controlIndex < tagsIndex && tagsIndex < costIndex) &&
          !tagRecord.reason?.trim()
        )
          errors.push(
            `Choice layout ${tagRecord.layoutHandle} must use available action-rail space in Control -> Tags -> Cost order or record the source/measured reason for another order`,
          );
      }
    }
    for (const [grantIndex, grant] of array(choice.grants).entries()) {
      const semanticGrant = choiceGrantSemantics.find(
        (item) =>
          item.choiceHandle === choice.handle && item.grantIndex === grantIndex,
      );
      if (semanticGrant) {
        const allowedKinds = EFFECT_ROLE_GRANT_KINDS[semanticGrant.effectRole];
        if (!allowedKinds?.has(grant.kind))
          errors.push(
            `Choice ${choice.handle} grant[${grantIndex}] is ${grant.kind}, which does not match contextual role ${semanticGrant.effectRole}`,
          );
        if (visibleGrant(grant) && !semanticGrant.tagRationale?.trim())
          errors.push(
            `Choice ${choice.handle} grant[${grantIndex}].tagRationale is required for its visible grant Tags`,
          );
        if (
          semanticGrant.effectRole === "entity-classification" &&
          (!semanticGrant.subjectGrantHandle ||
            semanticGrant.projection !== "entity-name")
        )
          errors.push(
            `Choice ${choice.handle} grant[${grantIndex}] entity classification must name its subject and entity-name projection`,
          );
        if (
          semanticGrant.effectRole === "entity-classification" &&
          String(textBase(grant.value) ?? grant.value ?? "").trim() &&
          !semanticComparable(semanticGrant.sourceEvidence).includes(
            semanticComparable(textBase(grant.value) ?? grant.value),
          )
        )
          errors.push(
            `Choice ${choice.handle} grant[${grantIndex}] classification value is not present in its source evidence`,
          );
        if (
          semanticGrant.effectRole === "entity-enhancement" &&
          (!semanticGrant.subjectGrantHandle ||
            ![grant.companion, grant.form].includes(
              semanticGrant.subjectGrantHandle,
            ))
        )
          errors.push(
            `Choice ${choice.handle} grant[${grantIndex}] entity enhancement must target its declared subject`,
          );
        if (
          semanticGrant.effectRole === "entity-classification" &&
          semanticGrant.projection === "entity-name"
        ) {
          const subject = [...choices.values()]
            .flatMap((candidate) => array(candidate.grants))
            .find(
              (candidate) =>
                ["companion", "form"].includes(candidate.kind) &&
                candidate.handle === semanticGrant.subjectGrantHandle,
            );
          if (!subject)
            errors.push(
              `Choice ${choice.handle} classification cannot find subject grant ${semanticGrant.subjectGrantHandle ?? "(missing)"}`,
            );
          else if (!textBase(subject.name)?.includes(`{{${grant.handle}}}`))
            errors.push(
              `Choice ${choice.handle} classification is declared in the entity name but ${subject.handle} does not interpolate {{${grant.handle}}}`,
            );
        }
      }
      if (visibleGrant(grant)) {
        errors.push(
          ...meaningfulTagErrors(
            grantTags(grant),
            `Choice ${choice.handle} visible grant ${JSON.stringify(textBase(grant.name))}`,
          ),
        );
        if (looksLikeDisplayTypography(textBase(grant.name)))
          errors.push(
            `Choice ${choice.handle} grant ${JSON.stringify(textBase(grant.name))} preserves source all-caps display typography`,
          );
        if (!grantDescription(grant))
          errors.push(
            `Choice ${choice.handle} visible grant ${JSON.stringify(textBase(grant.name))} requires a complete live description`,
          );
        else if (
          semanticGrant?.sourceEvidence?.trim() &&
          !semanticComparable(semanticGrant.sourceEvidence).includes(
            semanticComparable(grantDescription(grant)),
          )
        )
          errors.push(
            `Choice ${choice.handle} visible grant ${JSON.stringify(textBase(grant.name))} description is not an exact contiguous extract of its grant evidence`,
          );
      }
    }
  }

  const expectedJumpGrants = array(inventory?.grants);
  const actualJumpGrantRecords = array(canonical.grants)
    .map((grant, index) => ({
      grant,
      ref: tagGrantReviewRef("jump", index, grant),
    }))
    .filter(({ grant }) => visibleGrant(grant));
  const actualJumpGrants = actualJumpGrantRecords.map(({ grant }) => grant);
  for (const expected of expectedJumpGrants) {
    const actualRecord = expected.canonicalGrantRef
      ? actualJumpGrantRecords.find(
          ({ ref }) => ref === expected.canonicalGrantRef,
        )
      : actualJumpGrantRecords.find(
          ({ grant }) => grantContractKey(grant) === grantContractKey(expected),
        );
    if (!actualRecord)
      errors.push(
        `missing unconditional Jump grant ${expected.canonicalGrantRef ?? grantContractKey(expected)}`,
      );
    else {
      const actual = actualRecord.grant;
      if (grantContractKey(actual) !== grantContractKey(expected))
        errors.push(
          `unconditional Jump grant ${expected.canonicalGrantRef} does not match reviewed ${grantContractKey(expected)}`,
        );
      if (grantDescription(actual) !== expected.description)
        errors.push(
          `unconditional Jump grant ${grantContractKey(expected)} description does not match its reviewed source contract`,
        );
      if (
        JSON.stringify([...grantTags(actual)].sort()) !==
        JSON.stringify([...array(expected.tags)].sort())
      )
        errors.push(
          `unconditional Jump grant ${grantContractKey(expected)} Tags do not match its reviewed effect classification`,
        );
    }
  }
  for (const { grant: actual, ref } of actualJumpGrantRecords)
    if (
      !expectedJumpGrants.some(
        (grant) =>
          grant.canonicalGrantRef === ref ||
          (!grant.canonicalGrantRef &&
            grantContractKey(grant) === grantContractKey(actual)),
      )
    )
      errors.push(
        `unreviewed unconditional Jump grant ${grantContractKey(actual)}`,
      );

  const visibleGrantReview = [
    ...array(canonical.grants).flatMap((grant, grantIndex) =>
      visibleGrant(grant)
        ? [
            {
              grant,
              ref: tagGrantReviewRef("jump", grantIndex, grant),
            },
          ]
        : [],
    ),
    ...[...choices.values()].flatMap((choice) =>
      array(choice.grants).flatMap((grant, grantIndex) =>
        visibleGrant(grant)
          ? [
              {
                grant,
                ref: tagGrantReviewRef(
                  `choice:${choice.handle}`,
                  grantIndex,
                  grant,
                ),
              },
            ]
          : [],
      ),
    ),
  ];
  const visibleGrantTagCounts = visibleGrantReview.map(
    ({ grant }) => grantTags(grant).length,
  );
  if (
    visibleGrantTagCounts.length >= 8 &&
    visibleGrantTagCounts.every((count) => count === 1) &&
    !justifiedUniformTagReview(
      contract.tagCardinalityReview,
      "grantRefs",
      visibleGrantReview.map(({ ref }) => ref),
    )
  )
    errors.push(
      "visible grant Tags are suspiciously uniform: a substantial conversion with one Tag on every grant requires an exact justified tagCardinalityReview",
    );
  for (const actual of actualJumpGrants)
    if (looksLikeDisplayTypography(textBase(actual.name)))
      errors.push(
        `unconditional Jump grant ${JSON.stringify(textBase(actual.name))} preserves source all-caps display typography`,
      );

  for (const entity of array(contract.dynamicEntities)) {
    const choice = choices.get(entity.choiceHandle);
    const grant = choice?.grants?.find(
      (item) => item.kind === entity.kind && item.handle === entity.grantHandle,
    );
    if (!grant)
      errors.push(
        `${entity.choiceHandle} does not create ${entity.kind}:${entity.grantHandle}`,
      );
    else if (textBase(grant.name) !== entity.visibleNameTemplate)
      errors.push(
        `${entity.choiceHandle} visible entity name does not match its context template`,
      );
    const entityGrantOwners = [...choices.values()].filter((candidate) =>
      array(candidate.grants).some(
        (candidateGrant) =>
          candidateGrant.kind === entity.kind &&
          candidateGrant.handle === entity.grantHandle,
      ),
    );
    if (entityGrantOwners.length !== 1)
      errors.push(
        `${entity.choiceHandle} dynamic ${entity.kind} ${entity.grantHandle} must be created exactly once`,
      );
    const continuityReferents = array(contract.referentResolutions).filter(
      (record) =>
        record.resolution === "same-entity" &&
        record.targetChoiceHandle === entity.choiceHandle &&
        record.targetGrantHandle === entity.grantHandle &&
        record.sourceEntry !==
          semanticNames.find(
            (semantic) => semantic.handle === entity.choiceHandle,
          )?.sourceEntry,
    );
    if (continuityReferents.length && !entity.continuityEvidence?.trim())
      errors.push(
        `${entity.choiceHandle} requires continuityEvidence for earlier same-entity source references`,
      );
    const classificationHandles = array(entity.classificationChoiceHandles);
    if (classificationHandles.includes(entity.choiceHandle))
      errors.push(
        `${entity.choiceHandle} creation control must be separate from its classification Choices`,
      );
    if (classificationHandles.length && choice?.selection === "toggle")
      errors.push(
        `${entity.choiceHandle} must own the entered entity value as a scalar control above the classification Source`,
      );
    const classificationSection = array(canonical.sections).find((section) =>
      array(section.sources).some(
        (source) => source.handle === entity.classificationSourceHandle,
      ),
    );
    const classificationSource = classificationSection?.sources?.find(
      (source) => source.handle === entity.classificationSourceHandle,
    );
    if (classificationHandles.length) {
      if (!classificationSource)
        errors.push(
          `${entity.choiceHandle} references missing classification Source ${entity.classificationSourceHandle}`,
        );
      else {
        if (classificationSource.mode !== "single")
          errors.push(
            `${entity.choiceHandle} classification Source ${classificationSource.handle} must be single-select`,
          );
        if (!classificationSource.group)
          errors.push(
            `${entity.choiceHandle} classification Source ${classificationSource.handle} must target one Choice group`,
          );
        const sourceMembers = [...choices.values()]
          .filter((candidate) =>
            array(candidate.groups).includes(classificationSource.group),
          )
          .map((candidate) => candidate.handle)
          .sort();
        if (
          JSON.stringify(sourceMembers) !==
          JSON.stringify([...classificationHandles].sort())
        )
          errors.push(
            `${entity.choiceHandle} classificationChoiceHandles must exactly equal every member of single-select Source ${classificationSource.handle}`,
          );
        const ownerPlacement = array(classificationSection.directChoices).find(
          (placement) => placement.target === entity.choiceHandle,
        );
        const ownerIndex = array(classificationSection.members).findIndex(
          (member) =>
            member.kind === "choice" &&
            member.handle === ownerPlacement?.handle,
        );
        const sourceIndex = array(classificationSection.members).findIndex(
          (member) =>
            member.kind === "source" &&
            member.handle === classificationSource.handle,
        );
        if (ownerIndex < 0 || sourceIndex < 0 || ownerIndex >= sourceIndex)
          errors.push(
            `${entity.choiceHandle} scalar creation control must be placed before classification Source ${classificationSource.handle} in the same Section`,
          );
      }
    }
    for (const classificationHandle of array(
      entity.classificationChoiceHandles,
    )) {
      const classification = choices.get(classificationHandle);
      const property = array(classification?.grants).find(
        (item) =>
          item.kind === "property" &&
          item.handle === entity.classificationPropertyHandle,
      );
      if (!classification)
        errors.push(
          `${entity.choiceHandle} references missing classification ${classificationHandle}`,
        );
      else {
        if (classification.selection !== "toggle")
          errors.push(
            `${classificationHandle} classification Source member must be a toggle rendered by the single-select Source, not a nested scalar control`,
          );
        if (!property)
          errors.push(
            `${classificationHandle} must grant shared classification Property ${entity.classificationPropertyHandle}`,
          );
        else if (
          !String(textBase(property.value) ?? property.value ?? "").trim()
        )
          errors.push(
            `${classificationHandle} must give shared classification Property ${entity.classificationPropertyHandle} an explicit source-authored value`,
          );
      }
      const semanticGrant = choiceGrantSemantics.find(
        (record) =>
          record.choiceHandle === classificationHandle &&
          record.grantIndex === array(classification?.grants).indexOf(property),
      );
      if (
        property &&
        (semanticGrant?.effectRole !== "entity-classification" ||
          semanticGrant?.subjectGrantHandle !== entity.grantHandle ||
          semanticGrant?.projection !== "entity-name")
      )
        errors.push(
          `${classificationHandle} must declare its shared Property as an entity classification projected into ${entity.grantHandle}'s name`,
        );
    }
    const semanticallyDeclaredClassifications = choiceGrantSemantics
      .filter(
        (record) =>
          record.effectRole === "entity-classification" &&
          record.subjectGrantHandle === entity.grantHandle,
      )
      .map((record) => record.choiceHandle)
      .sort();
    if (
      JSON.stringify([...new Set(semanticallyDeclaredClassifications)]) !==
      JSON.stringify([...classificationHandles].sort())
    )
      errors.push(
        `${entity.choiceHandle} classification inventory must exactly match every entity-classification semantic record targeting ${entity.grantHandle}`,
      );
    for (const upgradeHandle of array(entity.upgradeHandles)) {
      const upgrade = choices.get(upgradeHandle);
      if (!upgrade)
        errors.push(
          `${entity.choiceHandle} references missing upgrade ${upgradeHandle}`,
        );
      else if (
        !upgrade.grants?.some(
          (item) =>
            item.kind === "perk" && item[entity.kind] === entity.grantHandle,
        )
      )
        errors.push(
          `${upgradeHandle} does not target ${entity.kind} ${entity.grantHandle}`,
        );
    }
    for (const owner of choices.values())
      for (const ownedGrant of array(owner.grants))
        if (
          ownedGrant.kind === "perk" &&
          ownedGrant[entity.kind] === entity.grantHandle &&
          textBase(ownedGrant.name)?.toLocaleLowerCase() ===
            entity.contextLabel?.toLocaleLowerCase()
        )
          errors.push(
            `${owner.handle} encodes the ${entity.contextLabel} role as a generic perk instead of entity identity`,
          );
  }

  return errors;
}
