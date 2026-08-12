export const inheritanceKinds = ["perk", "item", "companion", "form"] as const;

export type InheritanceKind = (typeof inheritanceKinds)[number];
export type InheritancePool = {
  id: string;
  kinds: InheritanceKind[];
  limit: number;
  unlimited: boolean;
};

export type LimitedInheritanceState = {
  pools: InheritancePool[];
  assignments: Record<string, Record<string, string>>;
  nextPoolSerial: number;
};

export type InheritanceCandidate = {
  id: string;
  kind: InheritanceKind;
  sourceEntryId: string;
  entityId: string;
  name: string;
  description: string;
  tags: readonly string[];
  bundledRecordIds: readonly string[];
};

type CandidateProjection = {
  records: readonly {
    id: string;
    kind: "perk" | "item" | "trait";
    name: string;
    description: string;
    tags?: readonly string[];
    sourceEntryId: string;
    ownerActorId?: string;
    ownerFormId?: string;
  }[];
  forms: readonly {
    id: string;
    name: string;
    description: string;
    sourceEntryId: string;
    tags?: readonly string[];
  }[];
  companions: readonly {
    actorId: string;
    sourceEntryId: string;
    tags?: readonly string[];
    importedEntryIds: readonly string[];
  }[];
  actors: Readonly<Record<string, { name: string; summary: string }>>;
};

export const initialLimitedInheritanceState = (): LimitedInheritanceState => ({
  pools: [
    { id: "pool-1", kinds: ["perk", "item"], limit: 2, unlimited: false },
    { id: "pool-2", kinds: ["companion"], limit: 1, unlimited: false },
    { id: "pool-3", kinds: ["form"], limit: 1, unlimited: false },
  ],
  assignments: {},
  nextPoolSerial: 4,
});

const candidateId = {
  record: (id: string) => `record:${id}`,
  form: (id: string) => `form:${id}`,
  companion: (id: string) => `companion:${id}`,
  companionUpdate: (entryId: string, actorId: string) =>
    `companion-update:${entryId}:${actorId}`,
};

export function inheritanceCandidates(
  evaluation: CandidateProjection,
  entryId: string,
): InheritanceCandidate[] {
  const records = evaluation.records.filter(
    (record) => record.sourceEntryId === entryId,
  );
  const result: InheritanceCandidate[] = records.flatMap((record) =>
    (record.kind === "perk" || record.kind === "item") &&
    record.ownerActorId === "jumper" &&
    !record.ownerFormId
      ? [
          {
            id: candidateId.record(record.id),
            kind: record.kind,
            sourceEntryId: entryId,
            entityId: record.id,
            name: record.name,
            description: record.description,
            tags: record.tags ?? [],
            bundledRecordIds: [record.id],
          },
        ]
      : [],
  );

  for (const form of evaluation.forms.filter(
    (item) => item.sourceEntryId === entryId,
  )) {
    const bundledRecordIds = records
      .filter(
        (record) =>
          record.ownerFormId === form.id &&
          (record.kind === "perk" || record.kind === "item"),
      )
      .map((record) => record.id);
    result.push({
      id: candidateId.form(form.id),
      kind: "form",
      sourceEntryId: entryId,
      entityId: form.id,
      name: form.name,
      description: form.description,
      tags: [
        ...new Set([
          ...(form.tags ?? []),
          ...records
            .filter(
              (record) =>
                record.ownerFormId === form.id &&
                (record.kind === "perk" || record.kind === "item"),
            )
            .flatMap((record) => record.tags ?? []),
        ]),
      ],
      bundledRecordIds,
    });
  }

  for (const companion of evaluation.companions) {
    const actor = evaluation.actors[companion.actorId];
    const bundledRecordIds = records
      .filter(
        (record) =>
          record.ownerActorId === companion.actorId &&
          (record.kind === "perk" || record.kind === "item"),
      )
      .map((record) => record.id);
    if (companion.sourceEntryId === entryId) {
      result.push({
        id: candidateId.companion(companion.actorId),
        kind: "companion",
        sourceEntryId: entryId,
        entityId: companion.actorId,
        name: actor?.name ?? companion.actorId,
        description: actor?.summary ?? "",
        tags: [
          ...new Set([
            ...(companion.tags ?? []),
            ...records
              .filter(
                (record) =>
                  record.ownerActorId === companion.actorId &&
                  (record.kind === "perk" || record.kind === "item"),
              )
              .flatMap((record) => record.tags ?? []),
          ]),
        ],
        bundledRecordIds,
      });
    } else if (
      companion.importedEntryIds.includes(entryId) &&
      bundledRecordIds.length > 0
    ) {
      result.push({
        id: candidateId.companionUpdate(entryId, companion.actorId),
        kind: "companion",
        sourceEntryId: entryId,
        entityId: companion.actorId,
        name: actor?.name ?? companion.actorId,
        description: actor?.summary ?? "",
        tags: [
          ...new Set([
            ...(companion.tags ?? []),
            ...records
              .filter(
                (record) =>
                  record.ownerActorId === companion.actorId &&
                  (record.kind === "perk" || record.kind === "item"),
              )
              .flatMap((record) => record.tags ?? []),
          ]),
        ],
        bundledRecordIds,
      });
    }
  }
  return result;
}

export function effectiveCandidatePool(
  limited: LimitedInheritanceState,
  entryId: string,
  candidate: InheritanceCandidate,
) {
  const explicit = limited.assignments[entryId]?.[candidate.id];
  if (explicit && limited.pools.some((pool) => pool.id === explicit))
    return explicit;
  return limited.pools.find(
    (pool) => pool.unlimited && pool.kinds.includes(candidate.kind),
  )?.id;
}

export function poolSelectionCount(
  limited: LimitedInheritanceState,
  entryId: string,
  poolId: string,
) {
  return Object.values(limited.assignments[entryId] ?? {}).filter(
    (assignedPoolId) => assignedPoolId === poolId,
  ).length;
}

export function inheritancePoolAssignmentEntryIds(
  limited: LimitedInheritanceState,
  poolId: string,
) {
  return Object.entries(limited.assignments).flatMap(
    ([entryId, assignments]) =>
      Object.values(assignments).includes(poolId) ? [entryId] : [],
  );
}

export function canAssignCandidate(
  limited: LimitedInheritanceState,
  entryId: string,
  poolId: string,
  candidate: InheritanceCandidate,
) {
  if (effectiveCandidatePool(limited, entryId, candidate)) return false;
  const pool = limited.pools.find((item) => item.id === poolId);
  if (!pool || !pool.kinds.includes(candidate.kind)) return false;
  return (
    pool.unlimited || poolSelectionCount(limited, entryId, pool.id) < pool.limit
  );
}

export function assignCandidate(
  limited: LimitedInheritanceState,
  entryId: string,
  poolId: string,
  candidate: InheritanceCandidate,
): LimitedInheritanceState {
  if (!canAssignCandidate(limited, entryId, poolId, candidate)) return limited;
  return {
    ...limited,
    assignments: {
      ...limited.assignments,
      [entryId]: {
        ...limited.assignments[entryId],
        [candidate.id]: poolId,
      },
    },
  };
}

export function unassignCandidate(
  limited: LimitedInheritanceState,
  entryId: string,
  candidateIdValue: string,
): LimitedInheritanceState {
  const current = limited.assignments[entryId];
  if (!current?.[candidateIdValue]) return limited;
  const next = { ...current };
  delete next[candidateIdValue];
  return {
    ...limited,
    assignments: { ...limited.assignments, [entryId]: next },
  };
}

export function removeInheritancePool(
  limited: LimitedInheritanceState,
  poolId: string,
): LimitedInheritanceState {
  if (!limited.pools.some((pool) => pool.id === poolId)) return limited;
  return {
    ...limited,
    pools: limited.pools.filter((pool) => pool.id !== poolId),
    assignments: Object.fromEntries(
      Object.entries(limited.assignments).map(([entryId, assignments]) => [
        entryId,
        Object.fromEntries(
          Object.entries(assignments).filter(([, value]) => value !== poolId),
        ),
      ]),
    ),
  };
}

export function addInheritancePool(
  limited: LimitedInheritanceState,
): LimitedInheritanceState {
  if (limited.pools.length >= 32) return limited;
  const existingIds = new Set(limited.pools.map((pool) => pool.id));
  let serial = limited.nextPoolSerial;
  while (existingIds.has(`pool-${serial}`)) serial += 1;
  return {
    ...limited,
    pools: [
      ...limited.pools,
      {
        id: `pool-${serial}`,
        kinds: [],
        limit: 1,
        unlimited: false,
      },
    ],
    nextPoolSerial: serial + 1,
  };
}

export function updateInheritancePool(
  limited: LimitedInheritanceState,
  poolId: string,
  update: Partial<Pick<InheritancePool, "kinds" | "limit" | "unlimited">>,
): LimitedInheritanceState {
  const kinds = update.kinds
    ? inheritanceKinds.filter((kind) => update.kinds?.includes(kind))
    : undefined;
  const limit =
    typeof update.limit === "number"
      ? Math.max(0, Math.min(99, Math.trunc(update.limit)))
      : undefined;
  return {
    ...limited,
    pools: limited.pools.map((pool) =>
      pool.id === poolId
        ? {
            ...pool,
            ...(kinds ? { kinds } : {}),
            ...(limit !== undefined ? { limit } : {}),
            ...(typeof update.unlimited === "boolean"
              ? { unlimited: update.unlimited }
              : {}),
          }
        : pool,
    ),
  };
}

export function normalizeLimitedInheritanceState(
  value: unknown,
): LimitedInheritanceState {
  const fallback = initialLimitedInheritanceState();
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fallback;
  const item = value as Partial<LimitedInheritanceState>;
  const seenPoolIds = new Set<string>();
  const pools = Array.isArray(item.pools)
    ? item.pools.slice(0, 32).flatMap((pool) => {
        if (!pool || typeof pool !== "object") return [];
        const candidate = pool as {
          id?: unknown;
          kinds?: unknown;
          limit?: unknown;
          unlimited?: unknown;
        };
        if (
          typeof candidate.id !== "string" ||
          candidate.id.length < 1 ||
          candidate.id.length > 100 ||
          !Array.isArray(candidate.kinds) ||
          !(
            candidate.limit === "unlimited" ||
            (typeof candidate.limit === "number" &&
              Number.isSafeInteger(candidate.limit) &&
              candidate.limit >= 0 &&
              candidate.limit <= 99)
          ) ||
          (candidate.unlimited !== undefined &&
            typeof candidate.unlimited !== "boolean")
        )
          return [];
        if (seenPoolIds.has(candidate.id)) return [];
        seenPoolIds.add(candidate.id);
        return [
          {
            id: candidate.id,
            kinds: inheritanceKinds.filter((kind) =>
              (candidate.kinds as unknown[]).includes(kind),
            ),
            limit: candidate.limit === "unlimited" ? 1 : candidate.limit,
            unlimited:
              candidate.limit === "unlimited" || candidate.unlimited === true,
          },
        ];
      })
    : fallback.pools;
  const poolIds = new Set(pools.map((pool) => pool.id));
  const assignments =
    item.assignments && typeof item.assignments === "object"
      ? Object.fromEntries(
          Object.entries(item.assignments)
            .slice(0, 1000)
            .flatMap(([entryId, entryAssignments]) =>
              entryId.length <= 200 &&
              entryAssignments &&
              typeof entryAssignments === "object" &&
              !Array.isArray(entryAssignments)
                ? [
                    [
                      entryId,
                      Object.fromEntries(
                        Object.entries(entryAssignments)
                          .slice(0, 10_000)
                          .filter(
                            ([id, poolId]) =>
                              id.length <= 1000 &&
                              typeof poolId === "string" &&
                              poolIds.has(poolId),
                          ),
                      ),
                    ],
                  ]
                : [],
            ),
        )
      : {};
  return {
    pools,
    assignments,
    nextPoolSerial:
      typeof item.nextPoolSerial === "number" &&
      Number.isSafeInteger(item.nextPoolSerial) &&
      item.nextPoolSerial > 0 &&
      item.nextPoolSerial <= 1_000_000
        ? item.nextPoolSerial
        : fallback.nextPoolSerial,
  };
}

export function carriedCandidateIds(
  limited: LimitedInheritanceState,
  evaluation: CandidateProjection,
  entryId: string,
) {
  return new Set(
    inheritanceCandidates(evaluation, entryId)
      .filter((candidate) =>
        effectiveCandidatePool(limited, entryId, candidate),
      )
      .map((candidate) => candidate.id),
  );
}

type LimitedProjectionState = CandidateProjection & {
  order: readonly string[];
  inspectionPointId: string;
  enabledSupplements: { "limited-inheritance": boolean };
  supplements: { limitedInheritance: LimitedInheritanceState };
};

const sourceIsCurrent = (state: LimitedProjectionState, entryId: string) =>
  entryId === state.inspectionPointId;

const sourceIsThroughInspection = (
  state: LimitedProjectionState,
  entryId: string,
) => {
  const source = state.order.indexOf(entryId);
  const cutoff = state.order.indexOf(state.inspectionPointId);
  return source >= 0 && cutoff >= 0 && source <= cutoff;
};

function candidateIsCarried(
  state: LimitedProjectionState,
  entryId: string,
  id: string,
) {
  const candidate = inheritanceCandidates(state, entryId).find(
    (item) => item.id === id,
  );
  return Boolean(
    candidate &&
    effectiveCandidatePool(
      state.supplements.limitedInheritance,
      entryId,
      candidate,
    ),
  );
}

export function inheritanceRecordIsVisible(
  state: LimitedProjectionState,
  record: CandidateProjection["records"][number],
) {
  if (!sourceIsThroughInspection(state, record.sourceEntryId)) return false;
  if (
    !state.enabledSupplements["limited-inheritance"] ||
    sourceIsCurrent(state, record.sourceEntryId)
  )
    return true;
  if (record.ownerFormId)
    return candidateIsCarried(
      state,
      record.sourceEntryId,
      candidateId.form(record.ownerFormId),
    );
  if (record.ownerActorId && record.ownerActorId !== "jumper") {
    const companion = state.companions.find(
      (item) => item.actorId === record.ownerActorId,
    );
    return companion?.sourceEntryId === record.sourceEntryId
      ? candidateIsCarried(
          state,
          record.sourceEntryId,
          candidateId.companion(record.ownerActorId),
        )
      : candidateIsCarried(
          state,
          record.sourceEntryId,
          candidateId.companionUpdate(
            record.sourceEntryId,
            record.ownerActorId,
          ),
        );
  }
  return candidateIsCarried(
    state,
    record.sourceEntryId,
    candidateId.record(record.id),
  );
}

export function inheritanceFormIsVisible(
  state: LimitedProjectionState,
  form: CandidateProjection["forms"][number],
) {
  if (!sourceIsThroughInspection(state, form.sourceEntryId)) return false;
  return (
    !state.enabledSupplements["limited-inheritance"] ||
    sourceIsCurrent(state, form.sourceEntryId) ||
    candidateIsCarried(state, form.sourceEntryId, candidateId.form(form.id))
  );
}

export function inheritanceCompanionIsVisible(
  state: LimitedProjectionState,
  companion: CandidateProjection["companions"][number],
) {
  if (!sourceIsThroughInspection(state, companion.sourceEntryId)) return false;
  if (!state.enabledSupplements["limited-inheritance"]) return true;
  if (
    sourceIsCurrent(state, companion.sourceEntryId) ||
    companion.importedEntryIds.some((entryId) =>
      sourceIsThroughInspection(state, entryId),
    )
  )
    return true;
  if (
    candidateIsCarried(
      state,
      companion.sourceEntryId,
      candidateId.companion(companion.actorId),
    )
  )
    return true;
  return false;
}

export const inheritanceCandidateIds = candidateId;
