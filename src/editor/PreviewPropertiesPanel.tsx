import { useMemo, useState } from "react";
import { translate } from "../localization";
import type { TagDefinition } from "../tracker/model";
import { TagBadge } from "../tracker/TagRadar";
import type { JumpPreviewSnapshot } from "./JumpPreview";
import {
  previewBasicDataGroups,
  previewBasicDataHandles,
  previewPropertyRows,
  previewPropertyRowsForHandles,
  type PreviewPropertyRow,
} from "./previewProperties";

type SelectedAcquisition =
  | { kind: "record"; id: string }
  | { kind: "form"; id: string }
  | { kind: "companion"; id: string };

function PreviewTags({
  handles,
  tags,
}: {
  handles: readonly string[];
  tags: Readonly<Record<string, TagDefinition>>;
}) {
  const visible = handles.flatMap((handle) =>
    tags[handle] ? [tags[handle]] : [],
  );
  if (!visible.length) return null;
  return (
    <div className="editor-preview-acquisition-tags">
      {visible.map((tag) => (
        <TagBadge key={tag.id} tag={tag} />
      ))}
    </div>
  );
}

function PreviewPropertyList({
  properties,
}: {
  properties: readonly PreviewPropertyRow[];
}) {
  return (
    <div className="editor-preview-property-list">
      {properties.map((property) => {
        const configured = property.setters.length > 0;
        return (
          <article
            className={configured ? "is-configured" : "is-unconfigured"}
            data-property-handle={property.handle}
            key={property.handle}
          >
            <div>
              <code>{`{{${property.handle}}}`}</code>
              <output>
                {property.value === undefined
                  ? translate("ui.editorWorkspace.previewProperties.unset")
                  : String(property.value)}
              </output>
            </div>
            <p>
              {property.sourceLabel
                ? translate(
                    "ui.editorWorkspace.previewProperties.currentSource",
                    { source: property.sourceLabel },
                  )
                : translate(
                    "ui.editorWorkspace.previewProperties.noCurrentSource",
                  )}
            </p>
            <div>
              <strong>
                {translate(
                  "ui.editorWorkspace.previewProperties.setByThisJump",
                )}
              </strong>
              <span>
                {configured
                  ? property.setters
                      .map((setter) =>
                        setter.inputHandle
                          ? `${setter.choiceName} · ${setter.inputHandle}`
                          : setter.choiceName,
                      )
                      .join(", ")
                  : translate(
                      previewBasicDataHandles.has(property.handle)
                        ? `ui.editorWorkspace.previewProperties.missingBasicWriter.${property.handle}`
                        : "ui.editorWorkspace.previewProperties.noChoiceSetter",
                    )}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function PreviewPropertiesPanel({
  snapshot,
  files,
  tags,
}: {
  snapshot: JumpPreviewSnapshot;
  files: Readonly<Record<string, string>>;
  tags: Readonly<Record<string, TagDefinition>>;
}) {
  const [selected, setSelected] = useState<SelectedAcquisition | null>(null);
  const actor = snapshot.evaluation.runtime["preview-entry"]?.actors.jumper;
  const basicProperties = useMemo(() => {
    if (!actor) return [];
    return previewPropertyRowsForHandles(
      snapshot.packageItem,
      actor,
      previewBasicDataGroups.flatMap((group) => [...group.handles]),
      snapshot.actorState,
    );
  }, [actor, snapshot.actorState, snapshot.packageItem]);
  const interpolatedProperties = useMemo(() => {
    if (!actor) return [];
    return previewPropertyRows(
      snapshot.packageItem,
      actor,
      files,
      snapshot.actorState,
    ).filter((property) => !previewBasicDataHandles.has(property.handle));
  }, [actor, files, snapshot.actorState, snapshot.packageItem]);
  const records = snapshot.evaluation.records.filter(
    (record) =>
      record.sourceEntryId === "preview-entry" &&
      (record.kind === "perk" || record.kind === "item"),
  );
  const forms = snapshot.evaluation.forms.filter(
    (form) => form.sourceEntryId === "preview-entry",
  );
  const companions = snapshot.evaluation.companions.filter(
    (companion) => companion.sourceEntryId === "preview-entry",
  );
  const selectedRecord =
    selected?.kind === "record"
      ? records.find((record) => record.id === selected.id)
      : undefined;
  const selectedForm =
    selected?.kind === "form"
      ? forms.find((form) => form.id === selected.id)
      : undefined;
  const selectedCompanion =
    selected?.kind === "companion"
      ? companions.find((companion) => companion.actorId === selected.id)
      : undefined;
  const selectedCompanionActor = selectedCompanion
    ? snapshot.evaluation.actors[selectedCompanion.actorId]
    : undefined;
  return (
    <>
      <section
        className="editor-preview-property-section editor-preview-basic-data"
        aria-labelledby="editor-preview-basic-data-heading"
      >
        <header>
          <p>
            {translate("ui.editorWorkspace.previewProperties.basicDataHeading")}
          </p>
          <h3 id="editor-preview-basic-data-heading">
            {translate("ui.editorWorkspace.previewProperties.basicData")}
          </h3>
        </header>
        {previewBasicDataGroups.map((group) => (
          <div className="editor-preview-basic-data-group" key={group.key}>
            <h4>
              {translate(`ui.editorWorkspace.previewProperties.${group.key}`)}
            </h4>
            <PreviewPropertyList
              properties={basicProperties.filter((property) =>
                group.handles.some((handle) => handle === property.handle),
              )}
            />
          </div>
        ))}
      </section>

      <section
        className="editor-preview-property-section"
        aria-labelledby="editor-preview-property-heading"
      >
        <header>
          <p>
            {translate("ui.editorWorkspace.previewProperties.runtimeHeading")}
          </p>
          <h3 id="editor-preview-property-heading">
            {translate(
              "ui.editorWorkspace.previewProperties.interpolatedValues",
            )}
          </h3>
        </header>
        {interpolatedProperties.length ? (
          <PreviewPropertyList properties={interpolatedProperties} />
        ) : (
          <p className="editor-preview-properties-empty">
            {translate(
              "ui.editorWorkspace.previewProperties.noInterpolatedValues",
            )}
          </p>
        )}
      </section>

      <section
        className="editor-preview-property-section editor-preview-acquisitions"
        aria-labelledby="editor-preview-acquisitions-heading"
      >
        <header>
          <p>
            {translate(
              "ui.editorWorkspace.previewProperties.currentSelectionHeading",
            )}
          </p>
          <h3 id="editor-preview-acquisitions-heading">
            {translate(
              "ui.editorWorkspace.previewProperties.selectedAcquisitions",
            )}
          </h3>
        </header>

        {records.length > 0 && (
          <>
            <h4>
              {translate("ui.editorWorkspace.previewProperties.perksAndItems")}
            </h4>
            <div className="chain-record-list editor-preview-acquisition-list">
              {records.map((record) => {
                const isSelected =
                  selected?.kind === "record" && selected.id === record.id;
                return (
                  <article
                    key={record.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={translate(
                      "ui.editorWorkspace.previewProperties.viewDetails",
                      { name: record.name },
                    )}
                    onClick={() =>
                      setSelected(
                        isSelected ? null : { kind: "record", id: record.id },
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelected(
                        isSelected ? null : { kind: "record", id: record.id },
                      );
                    }}
                  >
                    <div>
                      <p>
                        {record.kind === "perk"
                          ? translate(
                              "ui.editorWorkspace.previewProperties.perk",
                            )
                          : translate(
                              "ui.editorWorkspace.previewProperties.item",
                            )}
                      </p>
                      <div className="inventory-record-title">
                        <h5>{record.name}</h5>
                        {record.measure && (
                          <span className="record-measure">
                            {record.measure.kind === "rank"
                              ? translate(
                                  "ui.editorWorkspace.previewProperties.rankValue",
                                  { value: record.measure.value },
                                )
                              : `×${record.measure.value}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <PreviewTags handles={record.tags} tags={tags} />
                  </article>
                );
              })}
            </div>
          </>
        )}
        {selectedRecord && (
          <section className="chain-form-detail editor-preview-record-detail">
            <div>
              <p>
                {selectedRecord.kind === "perk"
                  ? translate("ui.editorWorkspace.previewProperties.perk")
                  : translate("ui.editorWorkspace.previewProperties.item")}
              </p>
              <h5 tabIndex={-1}>{selectedRecord.name}</h5>
              <span>
                {translate(
                  "ui.editorWorkspace.previewProperties.currentJumpRecord",
                )}
              </span>
            </div>
            <p>{selectedRecord.description}</p>
            <button type="button" onClick={() => setSelected(null)}>
              {translate("ui.editorWorkspace.previewProperties.close")}
            </button>
          </section>
        )}

        {forms.length > 0 && (
          <>
            <h4>{translate("ui.editorWorkspace.previewProperties.forms")}</h4>
            <div className="chain-form-grid editor-preview-profile-grid">
              {forms.map((form) => {
                const isSelected =
                  selected?.kind === "form" && selected.id === form.id;
                return (
                  <article key={form.id}>
                    <div>
                      <p>
                        {translate("ui.editorWorkspace.previewProperties.form")}
                      </p>
                      <h5>{form.name}</h5>
                      <span>{form.handle}</span>
                    </div>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={translate(
                        "ui.editorWorkspace.previewProperties.viewDetails",
                        { name: form.name },
                      )}
                      onClick={() =>
                        setSelected(
                          isSelected ? null : { kind: "form", id: form.id },
                        )
                      }
                    >
                      {translate("ui.editorWorkspace.previewProperties.view")}
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}
        {selectedForm && (
          <section className="chain-form-detail editor-preview-record-detail">
            <div>
              <p>{translate("ui.editorWorkspace.previewProperties.form")}</p>
              <h5 tabIndex={-1}>{selectedForm.name}</h5>
              <span>{selectedForm.handle}</span>
            </div>
            <p>{selectedForm.description}</p>
            <button type="button" onClick={() => setSelected(null)}>
              {translate("ui.editorWorkspace.previewProperties.close")}
            </button>
          </section>
        )}

        {companions.length > 0 && (
          <>
            <h4>
              {translate("ui.editorWorkspace.previewProperties.companions")}
            </h4>
            <div className="chain-companion-grid editor-preview-profile-grid">
              {companions.map((companion) => {
                const companionActor =
                  snapshot.evaluation.actors[companion.actorId];
                const isSelected =
                  selected?.kind === "companion" &&
                  selected.id === companion.actorId;
                return companionActor ? (
                  <article key={companion.actorId}>
                    <span aria-hidden="true">{companionActor.initials}</span>
                    <div>
                      <h5>{companionActor.name}</h5>
                      <p>
                        {translate(
                          "ui.editorWorkspace.previewProperties.currentJumpCompanion",
                        )}
                      </p>
                      <PreviewTags handles={companion.tags} tags={tags} />
                    </div>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={translate(
                        "ui.editorWorkspace.previewProperties.viewDetails",
                        { name: companionActor.name },
                      )}
                      onClick={() =>
                        setSelected(
                          isSelected
                            ? null
                            : {
                                kind: "companion",
                                id: companion.actorId,
                              },
                        )
                      }
                    >
                      {translate("ui.editorWorkspace.previewProperties.view")}
                    </button>
                  </article>
                ) : null;
              })}
            </div>
          </>
        )}
        {selectedCompanion && selectedCompanionActor && (
          <section className="chain-companion-detail editor-preview-record-detail">
            <div>
              <p>
                {translate("ui.editorWorkspace.previewProperties.companion")}
              </p>
              <h5 tabIndex={-1}>{selectedCompanionActor.name}</h5>
              <span>
                {translate(
                  "ui.editorWorkspace.previewProperties.currentJumpCompanion",
                )}
              </span>
            </div>
            <p>{selectedCompanionActor.summary}</p>
            <button type="button" onClick={() => setSelected(null)}>
              {translate("ui.editorWorkspace.previewProperties.close")}
            </button>
          </section>
        )}

        {!records.length && !forms.length && !companions.length && (
          <p className="editor-preview-properties-empty">
            {translate(
              "ui.editorWorkspace.previewProperties.noSelectedAcquisitions",
            )}
          </p>
        )}
      </section>
    </>
  );
}
