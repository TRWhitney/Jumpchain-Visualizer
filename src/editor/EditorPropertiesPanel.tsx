import type { ImageHeaderMetadata, PackageAssetMetadata } from "../archive";
import type { TagDefinition } from "../domain/tags";
import { translate } from "../localization";
import { PreviewPropertiesPanel } from "./PreviewPropertiesPanel";
import type { JumpPreviewSnapshot } from "./JumpPreview";
import type { FormatSymbol } from "./languageService";
import { summarizeWorkspace } from "./model";
import { assetBasename, assetFolder } from "./assetPaths";
import {
  editorDeclarationLabel,
  editorSymbolLabel,
} from "./editorPresentation";

export function PropertiesPanel({
  summary,
  symbol,
  symbolLine,
  symbolOwner,
  asset,
  assetMetadata,
  assetReferenceCount,
  selectedFile,
  selectedFileBytes,
  selectedFileDiagnosticCount,
  previewSnapshot,
  previewFiles,
  previewTags,
}: {
  summary: ReturnType<typeof summarizeWorkspace>;
  symbol: FormatSymbol | null;
  symbolLine?: number;
  symbolOwner?: FormatSymbol;
  asset: string | null;
  assetMetadata?: PackageAssetMetadata;
  assetReferenceCount: number;
  selectedFile: string | null;
  selectedFileBytes?: number;
  selectedFileDiagnosticCount?: number;
  previewSnapshot?: JumpPreviewSnapshot;
  previewFiles: Readonly<Record<string, string>>;
  previewTags: Readonly<Record<string, TagDefinition>>;
}) {
  const title = asset
    ? assetBasename(asset)
    : selectedFile
      ? selectedFile
      : symbol
        ? editorSymbolLabel(symbol)
        : summary.name;
  return (
    <div className="editor-properties-panel">
      <p>{translate("ui.editorWorkspace.text.selection")}</p>
      <h2>{title}</h2>
      <dl>
        {asset ? (
          <>
            <div>
              <dt>{translate("ui.editorWorkspace.text.kind")}</dt>
              <dd>{translate("ui.editorWorkspace.asset.assetFile")}</dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.asset.folder")}</dt>
              <dd>
                {assetFolder(asset) ||
                  translate("ui.editorWorkspace.asset.rootFolder")}
              </dd>
            </div>
            {assetMetadata && (
              <>
                <div>
                  <dt>{translate("ui.editorWorkspace.asset.format")}</dt>
                  <dd>{assetMetadata.format}</dd>
                </div>
                <div>
                  <dt>{translate("ui.editorWorkspace.asset.dimensions")}</dt>
                  <dd>
                    {assetMetadata.width} × {assetMetadata.height}
                  </dd>
                </div>
                <div>
                  <dt>{translate("ui.editorWorkspace.text.size")}</dt>
                  <dd>
                    {assetMetadata.bytes}
                    {translate("ui.editorWorkspace.text.bytes")}
                  </dd>
                </div>
                {assetHeaderProperties(assetMetadata.header).map((property) => (
                  <div key={property.key}>
                    <dt>{property.label}</dt>
                    <dd>{property.value}</dd>
                  </div>
                ))}
              </>
            )}
            <div>
              <dt>{translate("ui.editorWorkspace.asset.references")}</dt>
              <dd>{assetReferenceCount}</dd>
            </div>
          </>
        ) : selectedFile ? (
          <>
            <div>
              <dt>{translate("ui.editorWorkspace.text.kind")}</dt>
              <dd>{translate("ui.editorWorkspace.asset.definitionFile")}</dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.text.size")}</dt>
              <dd>
                {selectedFileBytes ?? 0}
                {translate("ui.editorWorkspace.text.bytes")}
              </dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.text.diagnostics")}</dt>
              <dd>{selectedFileDiagnosticCount ?? 0}</dd>
            </div>
          </>
        ) : symbol && symbol.kind !== "jump" ? (
          <>
            <div>
              <dt>{translate("ui.editorWorkspace.text.kind")}</dt>
              <dd>{editorDeclarationLabel(symbol.kind)}</dd>
            </div>
            {symbol.handle && (
              <div>
                <dt>{translate("ui.editorWorkspace.field.handle")}</dt>
                <dd>{symbol.handle}</dd>
              </div>
            )}
            {symbolOwner && (
              <div>
                <dt>{translate("ui.editorWorkspace.asset.owner")}</dt>
                <dd>{editorSymbolLabel(symbolOwner)}</dd>
              </div>
            )}
            <div>
              <dt>{translate("ui.editorWorkspace.asset.sourceLocation")}</dt>
              <dd>
                {symbol.file}:{symbolLine ?? 1}
              </dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>{translate("ui.editorWorkspace.text.version")}</dt>
              <dd>{summary.version}</dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.text.authors")}</dt>
              <dd>{summary.authors.join(", ")}</dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.text.sections")}</dt>
              <dd>{summary.sectionCount}</dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.text.choices")}</dt>
              <dd>{summary.choiceCount}</dd>
            </div>
            <div>
              <dt>{translate("ui.editorWorkspace.text.gauntlet")}</dt>
              <dd>
                {summary.nativeGauntlet
                  ? translate("ui.editorWorkspace.asset.native")
                  : translate("ui.editorWorkspace.asset.no")}
              </dd>
            </div>
          </>
        )}
      </dl>
      {previewSnapshot && (
        <PreviewPropertiesPanel
          snapshot={previewSnapshot}
          files={previewFiles}
          tags={previewTags}
        />
      )}
      <p className="editor-property-note">
        {translate("ui.editorWorkspace.asset.propertiesReadOnly")}
      </p>
    </div>
  );
}

function formatHeaderNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function assetHeaderProperties(header: ImageHeaderMetadata) {
  const properties: { key: string; label: string; value: string }[] = [];
  const add = (key: string, value: string | undefined) => {
    if (value)
      properties.push({
        key,
        label: translate(`ui.editorWorkspace.asset.header.${key}`),
        value,
      });
  };
  add(
    "colorModel",
    header.colorModel
      ? translate(
          `ui.editorWorkspace.asset.header.colorModelValue.${header.colorModel}`,
        )
      : undefined,
  );
  add(
    "bitDepth",
    header.bitDepth
      ? translate("ui.editorWorkspace.asset.header.bits", {
          count: header.bitDepth,
        })
      : undefined,
  );
  add(
    "colorResolution",
    header.colorResolution
      ? translate("ui.editorWorkspace.asset.header.bits", {
          count: header.colorResolution,
        })
      : undefined,
  );
  add(
    "encoding",
    header.encoding
      ? translate(
          `ui.editorWorkspace.asset.header.encodingValue.${header.encoding}`,
        )
      : undefined,
  );
  add(
    "interlaced",
    header.interlaced === undefined
      ? undefined
      : translate(
          `ui.editorWorkspace.asset.header.boolean.${header.interlaced ? "yes" : "no"}`,
        ),
  );
  add(
    "alpha",
    header.alpha === undefined
      ? undefined
      : translate(
          `ui.editorWorkspace.asset.header.boolean.${header.alpha ? "yes" : "no"}`,
        ),
  );
  add(
    "animated",
    header.animated === undefined
      ? undefined
      : translate(
          `ui.editorWorkspace.asset.header.boolean.${header.animated ? "yes" : "no"}`,
        ),
  );
  add(
    "colorProfile",
    header.colorProfile
      ? translate(
          `ui.editorWorkspace.asset.header.colorProfileValue.${header.colorProfile}`,
        )
      : undefined,
  );
  add(
    "pixelDensity",
    header.densityX && header.densityY && header.densityUnit
      ? translate("ui.editorWorkspace.asset.header.pixelDensityValue", {
          x: formatHeaderNumber(header.densityX),
          y: formatHeaderNumber(header.densityY),
          unit: header.densityUnit,
        })
      : undefined,
  );
  add(
    "orientation",
    header.orientation
      ? translate(
          `ui.editorWorkspace.asset.header.orientationValue.${header.orientation}`,
        )
      : undefined,
  );
  add("version", header.version);
  add(
    "palette",
    header.paletteColors
      ? translate("ui.editorWorkspace.asset.header.paletteValue", {
          count: header.paletteColors,
        })
      : undefined,
  );
  return properties;
}
