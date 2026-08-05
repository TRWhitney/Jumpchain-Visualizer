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
        if (!decision.reason?.trim())
          errors.push(`${label}.reason is required`);
        const dispositions = array(decision.dispositions);
        if (!dispositions.length)
          errors.push(`${label}.dispositions must not be empty`);
        if (new Set(dispositions).size !== dispositions.length)
          errors.push(`${label}.dispositions must not contain duplicates`);
        if (dispositions.includes("no-grant") && dispositions.length !== 1)
          errors.push(
            `${label} cannot combine no-grant with a grant disposition`,
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
          errors.push(`${label}.dispositions contains an invalid value`);
        const declaredKeys = [...array(decision.grantKeys)].sort();
        const expectedKeys = array(inventory.grants)
          .filter((grant) => grant.entryId === decision.entryId)
          .map(grantContractKey)
          .sort();
        if (dispositions.includes("jump-grant")) {
          if (!declaredKeys.length)
            errors.push(
              `${label}.grantKeys must enumerate every unconditional grant from that source entry`,
            );
          else if (
            JSON.stringify(declaredKeys) !== JSON.stringify(expectedKeys)
          )
            errors.push(
              `${label}.grantKeys must exactly reconcile the unconditional grant inventory for that source entry`,
            );
        } else if (declaredKeys.length)
          errors.push(
            `${label}.grantKeys is allowed only with a jump-grant disposition`,
          );
        if (dispositions.includes("shared-choice-grant")) {
          const sourceEntry = entries.get(decision.entryId);
          if (!decision.sharedEffectText?.trim())
            errors.push(`${label}.sharedEffectText is required`);
          else if (
            sourceEntry?.transcription?.trim() &&
            !semanticComparable(sourceEntry.transcription).includes(
              semanticComparable(decision.sharedEffectText),
            )
          )
            errors.push(
              `${label}.sharedEffectText is not an exact contiguous extract of its source entry transcription`,
            );
          if (!array(decision.targetHandles).length)
            errors.push(`${label}.targetHandles must not be empty`);
        }
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
    else
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
      .filter((decision) => array(decision.dispositions).includes("jump-grant"))
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
    if (
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
      if (!record.tags?.length)
        errors.push(`${label} placed Tags must not be empty`);
      else if (
        record.tags.every((tag) =>
          GENERIC_CLASSIFICATION_TAGS.has(semanticComparable(tag)),
        )
      )
        errors.push(
          `${label} Tags only repeat a section, cost class, or grant kind; add a concrete effect Tag`,
        );
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
    if (complete && review.status !== "pass")
      errors.push("facsimileContracts.independentReview must pass");
    if (complete && !review.evidence?.trim())
      errors.push("facsimileContracts.independentReview.evidence is required");
  }

  if (!canonical) return errors;

  const choices = new Map(
    array(canonical.choices).map((choice) => [choice.handle, choice]),
  );
  for (const decision of array(inventory?.entryDecisions)) {
    if (!array(decision.dispositions).includes("shared-choice-grant")) continue;
    for (const handle of array(decision.targetHandles)) {
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
              semanticComparable(decision.sharedEffectText),
            ),
        )
      )
        errors.push(
          `Choice ${handle} does not preserve shared Trait effect from ${decision.entryId}`,
        );
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
    for (const grant of array(choice.grants))
      if (visibleGrant(grant)) {
        if (looksLikeDisplayTypography(textBase(grant.name)))
          errors.push(
            `Choice ${choice.handle} grant ${JSON.stringify(textBase(grant.name))} preserves source all-caps display typography`,
          );
        if (!grantDescription(grant))
          errors.push(
            `Choice ${choice.handle} visible grant ${JSON.stringify(textBase(grant.name))} requires a complete live description`,
          );
      }
  }

  const expectedJumpGrants = array(inventory?.grants);
  const actualJumpGrants = array(canonical.grants).filter(visibleGrant);
  for (const expected of expectedJumpGrants)
    if (
      !actualJumpGrants.some(
        (grant) => grantContractKey(grant) === grantContractKey(expected),
      )
    )
      errors.push(
        `missing unconditional Jump grant ${grantContractKey(expected)}`,
      );
    else {
      const actual = actualJumpGrants.find(
        (grant) => grantContractKey(grant) === grantContractKey(expected),
      );
      if (grantDescription(actual) !== expected.description)
        errors.push(
          `unconditional Jump grant ${grantContractKey(expected)} description does not match its reviewed source contract`,
        );
    }
  for (const actual of actualJumpGrants)
    if (
      !expectedJumpGrants.some(
        (grant) => grantContractKey(grant) === grantContractKey(actual),
      )
    )
      errors.push(
        `unreviewed unconditional Jump grant ${grantContractKey(actual)}`,
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
    for (const upgradeHandle of array(entity.upgradeHandles)) {
      const upgrade = choices.get(upgradeHandle);
      if (!upgrade)
        errors.push(
          `${entity.choiceHandle} references missing upgrade ${upgradeHandle}`,
        );
      else if (
        !upgrade.grants?.some(
          (item) =>
            item.kind === "perk" && item.companion === entity.grantHandle,
        )
      )
        errors.push(
          `${upgradeHandle} does not target companion ${entity.grantHandle}`,
        );
    }
    for (const owner of choices.values())
      for (const ownedGrant of array(owner.grants))
        if (
          ownedGrant.kind === "perk" &&
          ownedGrant.companion === entity.grantHandle &&
          textBase(ownedGrant.name)?.toLocaleLowerCase() ===
            entity.contextLabel?.toLocaleLowerCase()
        )
          errors.push(
            `${owner.handle} encodes the ${entity.contextLabel} role as a generic perk instead of entity identity`,
          );
  }

  return errors;
}
