import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Konva from "konva";
import {
  Arrow,
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import {
  createRasterEditorDocument,
  eraseUnlockedLayers,
  paintLayerBounds,
  rasterPreset,
  transformPaintLayerToBounds,
  type RasterAssetEditorDocument,
  type RasterCorrectionName,
  type RasterLayer,
  type RasterPaintLayer,
  type RasterShapeLayer,
  type RasterStroke,
  type RasterTextLayer,
} from "./assetEditorModel";
import { RasterRenderClient } from "./rasterRenderClient";
import { renderCorrectedRasterProxy } from "./rasterCorrections";
import { extractSafeImageMetadata } from "./safeImageMetadata";
import { translate } from "../localization";
import { NumberStepperButtons } from "../tracker/NumberStepper";
import { useContextMenu } from "../ui";
import {
  keybindingDisplay,
  matchesKeybinding,
  type KeybindingAction,
  type KeybindingChord,
} from "../settings/model";

type RasterTool =
  | "select"
  | "pan"
  | "crop"
  | "paint"
  | "eraser"
  | "text"
  | "line"
  | "arrow"
  | "rectangle"
  | "ellipse";

type ActivePaintGesture = {
  layer: RasterPaintLayer;
  points: number[];
  color: string;
  size: number;
  hardness: number;
  opacity: number;
  erase: boolean;
};

type ActiveBoxGesture = {
  tool: "crop" | "text" | "line" | "arrow" | "rectangle" | "ellipse";
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type ActivePaintTransformGesture = {
  pointerId: number;
  started: boolean;
  mode: "move" | "resize";
  handleX: -1 | 0 | 1;
  handleY: -1 | 0 | 1;
  startX: number;
  startY: number;
  layer: RasterPaintLayer;
  bounds: ReturnType<typeof paintLayerBounds>;
  nextDocument: RasterAssetEditorDocument;
};

type ShapeFillMode = "none" | "current" | "white" | "black";

const correctionLabels: Record<RasterCorrectionName, string> = {
  exposure: "Exposure",
  contrast: "Contrast",
  highlights: "Highlights",
  shadows: "Shadows",
  saturation: "Saturation",
  vibrance: "Vibrance",
  temperature: "Temperature",
  tint: "Tint",
  blur: "Blur",
  sharpen: "Sharpen",
};

let fallbackLayerId = 0;
const layerId = () =>
  globalThis.crypto?.randomUUID?.() ?? `asset-layer-${fallbackLayerId++}`;

function useImageSource(bytes: Uint8Array, mime: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(
      new Blob([bytes.slice().buffer], { type: mime }),
    );
    const next = new Image();
    let active = true;
    next.onload = () => {
      if (active) setImage(next);
    };
    next.src = url;
    return () => {
      active = false;
      next.src = "";
      URL.revokeObjectURL(url);
      setImage(null);
    };
  }, [bytes, mime]);
  return image;
}

function RasterNumberInput({
  label,
  value,
  minimum,
  maximum,
  step = 1,
  autoFocus,
  onChange,
  onBlur,
  onKeyDown,
}: {
  label: string;
  value: number;
  minimum?: number;
  maximum?: number;
  step?: number;
  autoFocus?: boolean;
  onChange: (value: number) => void;
  onBlur?: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}) {
  const setBounded = (next: number) => {
    const bounded = Math.max(
      minimum ?? -Infinity,
      Math.min(maximum ?? Infinity, next),
    );
    onChange(Math.round(bounded * 1_000_000) / 1_000_000);
  };
  const stepValue = (direction: -1 | 1) => {
    setBounded(value + step * direction);
    if (onBlur) window.setTimeout(onBlur, 0);
  };
  return (
    <span className="number-stepper editor-number-stepper asset-raster-number-stepper is-fluid">
      <input
        aria-label={label}
        type="number"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setBounded(Number(event.target.value))}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <NumberStepperButtons
        label={label}
        increaseDisabled={maximum !== undefined && value >= maximum}
        decreaseDisabled={minimum !== undefined && value <= minimum}
        onIncrease={() => stepValue(1)}
        onDecrease={() => stepValue(-1)}
      />
    </span>
  );
}

function RangeField({
  label,
  value,
  minimum,
  maximum,
  step = 1,
  suffix = "",
  resetValue = 0,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step?: number;
  suffix?: string;
  resetValue?: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const setBounded = (next: number) =>
    onChange(Math.max(minimum, Math.min(maximum, next)));
  const finish = () => {
    setEditing(false);
    onCommit?.();
  };
  return (
    <div className="asset-raster-range-field">
      <span>
        <span>{label}</span>
        <span className="asset-raster-range-actions">
          {editing ? (
            <RasterNumberInput
              label={translate("ui.editorWorkspace.asset.editor.fieldValue", {
                field: label,
              })}
              minimum={minimum}
              maximum={maximum}
              step={step}
              value={value}
              autoFocus
              onChange={setBounded}
              onBlur={finish}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setEditing(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="asset-raster-range-value"
              aria-label={translate(
                "ui.editorWorkspace.asset.editor.editFieldValue",
                { field: label },
              )}
              onClick={() => setEditing(true)}
            >
              {value}
              {suffix}
            </button>
          )}
          <button
            type="button"
            className="asset-raster-range-reset"
            aria-label={translate(
              "ui.editorWorkspace.asset.editor.resetField",
              { field: label },
            )}
            title={translate("ui.editorWorkspace.asset.editor.resetField", {
              field: label,
            })}
            disabled={value === resetValue}
            onClick={() => {
              setBounded(resetValue);
              window.setTimeout(() => onCommit?.(), 0);
            }}
          >
            ↺
          </button>
        </span>
      </span>
      <input
        aria-label={label}
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        onChange={(event) => setBounded(Number(event.target.value))}
        onPointerUp={() => onCommit?.()}
        onKeyUp={() => onCommit?.()}
      />
    </div>
  );
}

function LayerNode({
  layer,
  scale,
  selected,
  interactive,
  onSelect,
  onMove,
  onTransform,
}: {
  layer: RasterLayer;
  scale: number;
  selected: boolean;
  interactive: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onTransform: (
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    rotation: number,
  ) => void;
}) {
  const paintBounds = layer.kind === "paint" ? paintLayerBounds(layer) : null;
  const common = {
    id: `asset-layer-node-${layer.id}`,
    opacity: layer.opacity,
    visible: layer.visible,
    listening: interactive && !layer.locked,
    draggable: interactive && !layer.locked && layer.kind !== "paint",
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) =>
      onMove(event.currentTarget.x() / scale, event.currentTarget.y() / scale),
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      const node = event.currentTarget;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scale({ x: 1, y: 1 });
      onTransform(
        node.x() / scale,
        node.y() / scale,
        scaleX,
        scaleY,
        node.rotation(),
      );
    },
    shadowColor: selected && interactive ? "#48a9ff" : undefined,
    shadowBlur: selected && interactive ? 4 : 0,
  };
  if (layer.kind === "text")
    return (
      <Text
        {...common}
        x={layer.x * scale}
        y={layer.y * scale}
        rotation={layer.rotation}
        text={layer.text}
        width={layer.width * scale}
        fontFamily={
          layer.family === "serif"
            ? "serif"
            : layer.family === "mono"
              ? "monospace"
              : "sans-serif"
        }
        fontSize={layer.size * scale}
        fontStyle={layer.weight}
        align={layer.align}
        fill={layer.color}
        onTransform={(event) => {
          const node = event.currentTarget as Konva.Text;
          node.width(Math.max(1, node.width() * node.scaleX()));
          node.scale({ x: 1, y: 1 });
        }}
        onTransformEnd={(event) => {
          const node = event.currentTarget as Konva.Text;
          onTransform(
            node.x() / scale,
            node.y() / scale,
            node.width() / (layer.width * scale),
            1,
            node.rotation(),
          );
        }}
      />
    );
  if (layer.kind === "shape") {
    const shapeCommon = {
      stroke: layer.stroke,
      strokeWidth: layer.strokeWidth * scale,
      fill: layer.fill ?? undefined,
    };
    return (
      <Group
        {...common}
        x={layer.x * scale}
        y={layer.y * scale}
        rotation={layer.rotation}
      >
        {layer.shape === "rectangle" ? (
          <Rect
            {...shapeCommon}
            width={layer.width * scale}
            height={layer.height * scale}
          />
        ) : layer.shape === "ellipse" ? (
          <Ellipse
            {...shapeCommon}
            x={(layer.width * scale) / 2}
            y={(layer.height * scale) / 2}
            radiusX={(Math.abs(layer.width) * scale) / 2}
            radiusY={(Math.abs(layer.height) * scale) / 2}
          />
        ) : layer.shape === "arrow" ? (
          <Arrow
            {...shapeCommon}
            points={[0, 0, layer.width * scale, layer.height * scale]}
            pointerLength={10}
          />
        ) : (
          <Line
            {...shapeCommon}
            points={[0, 0, layer.width * scale, layer.height * scale]}
          />
        )}
      </Group>
    );
  }
  return (
    <Group {...common} x={paintBounds!.x * scale} y={paintBounds!.y * scale}>
      {layer.strokes.map((stroke, index) => (
        <Line
          key={index}
          points={stroke.points.flatMap((point) => [
            (point.x - paintBounds!.x) * scale,
            (point.y - paintBounds!.y) * scale,
          ])}
          stroke={stroke.erase ? "#ffffff" : stroke.color}
          opacity={stroke.opacity}
          strokeWidth={stroke.size * scale}
          lineCap={stroke.hardness < 0.5 ? "round" : "square"}
          lineJoin="round"
          globalCompositeOperation={
            stroke.erase ? "destination-out" : "source-over"
          }
          listening={interactive && !layer.locked}
        />
      ))}
    </Group>
  );
}

function useCorrectedProxyImage(
  image: HTMLImageElement | null,
  document: RasterAssetEditorDocument,
  proxyScale: number,
  showOriginal: boolean,
) {
  const [corrected, setCorrected] = useState<
    HTMLImageElement | HTMLCanvasElement | null
  >(image);

  useEffect(() => {
    if (!image || showOriginal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCorrected(image);
      return;
    }
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const next = renderCorrectedRasterProxy(
        image,
        document.baseWidth * proxyScale,
        document.baseHeight * proxyScale,
        document.corrections,
        proxyScale,
      );
      if (!cancelled) setCorrected(next);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [
    document.baseHeight,
    document.baseWidth,
    document.corrections,
    image,
    proxyScale,
    showOriginal,
  ]);

  return corrected;
}

function ErasureLines({
  strokes,
  visible,
}: {
  strokes: RasterStroke[];
  visible: boolean;
}) {
  return strokes.map((stroke, index) => (
    <Line
      key={index}
      points={stroke.points.flatMap((point) => [point.x, point.y])}
      stroke="#000000"
      strokeWidth={stroke.size}
      opacity={stroke.opacity}
      lineCap={stroke.hardness < 0.5 ? "round" : "square"}
      lineJoin="round"
      globalCompositeOperation="destination-out"
      visible={visible}
      listening={false}
    />
  ));
}

const translateStrokes = (
  strokes: RasterStroke[] | undefined,
  x: number,
  y: number,
) =>
  strokes?.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({
      x: point.x + x,
      y: point.y + y,
    })),
  }));

const transformStrokes = (
  strokes: RasterStroke[] | undefined,
  originX: number,
  originY: number,
  previousRotation: number,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  rotation: number,
) => {
  const previousRadians = (-previousRotation * Math.PI) / 180;
  const previousCosine = Math.cos(previousRadians);
  const previousSine = Math.sin(previousRadians);
  const radians = (rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return strokes?.map((stroke) => ({
    ...stroke,
    size: stroke.size * Math.sqrt(Math.abs(scaleX * scaleY)),
    points: stroke.points.map((point) => {
      const translatedX = point.x - originX;
      const translatedY = point.y - originY;
      const localX = translatedX * previousCosine - translatedY * previousSine;
      const localY = translatedX * previousSine + translatedY * previousCosine;
      const scaledX = localX * scaleX;
      const scaledY = localY * scaleY;
      return {
        x: x + scaledX * cosine - scaledY * sine,
        y: y + scaledX * sine + scaledY * cosine,
      };
    }),
  }));
};

export function RasterSourceEditor({
  path,
  bytes,
  format,
  width,
  height,
  document,
  readOnly,
  keybindings,
  onCommit,
  onStatus,
  onFocusChange,
  onUndo,
  onRedo,
}: {
  path: string;
  bytes: Uint8Array;
  format: "png" | "jpg";
  width: number;
  height: number;
  document?: RasterAssetEditorDocument;
  readOnly: boolean;
  keybindings: Record<KeybindingAction, KeybindingChord>;
  onCommit: (
    bytes: Uint8Array,
    document: RasterAssetEditorDocument,
    historyLabel: string,
  ) => void;
  onStatus: (status: string, invalid: boolean) => void;
  onFocusChange: (focused: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const { openContextMenu, openContextMenuFromKeyboard } = useContextMenu();
  const initialDocument = useMemo(() => {
    if (document) return document;
    const created = createRasterEditorDocument(format, bytes, width, height);
    created.metadata = extractSafeImageMetadata(bytes, format);
    return created;
  }, [bytes, document, format, height, width]);
  const [draft, setDraft] = useState(initialDocument);
  const draftRef = useRef(draft);
  const [tool, setTool] = useState<RasterTool>("select");
  const [zoom, setZoom] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [brushColor, setBrushColor] = useState("#ff4d67");
  const [brushSize, setBrushSize] = useState(16);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [brushHardness, setBrushHardness] = useState(0.75);
  const [shapeStroke, setShapeStroke] = useState("#ff4d67");
  const [shapeFill, setShapeFill] = useState<ShapeFillMode>("none");
  const [shapeWidth, setShapeWidth] = useState(4);
  const [textValue, setTextValue] = useState("Text");
  const [cropRatio, setCropRatio] = useState("free");
  const [aspectLocked, setAspectLocked] = useState(true);
  const [spacePan, setSpacePan] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(true);
  const [livePaint, setLivePaint] = useState<ActivePaintGesture | null>(null);
  const [liveBox, setLiveBox] = useState<ActiveBoxGesture | null>(null);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renamingLayerValue, setRenamingLayerValue] = useState("");
  const [tooltip, setTooltip] = useState<{
    label: string;
    shortcut?: string;
    left: number;
    top: number;
  } | null>(null);
  const renderClient = useRef<RasterRenderClient | null>(null);
  const renderAbort = useRef<AbortController | null>(null);
  const renderGeneration = useRef(0);
  const textTimer = useRef<number | null>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const stage = useRef<Konva.Stage>(null);
  const documentGroup = useRef<Konva.Group>(null);
  const stageHost = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const activePaint = useRef<ActivePaintGesture | null>(null);
  const activeBox = useRef<ActiveBoxGesture | null>(null);
  const activePaintTransform = useRef<ActivePaintTransformGesture | null>(null);
  const panGesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    previousTool: RasterTool;
    temporary: boolean;
  } | null>(null);
  const baseImage = useImageSource(
    draft.baseBytes,
    format === "png" ? "image/png" : "image/jpeg",
  );
  const crop = draft.transform.crop ?? {
    x: 0,
    y: 0,
    width: draft.baseWidth,
    height: draft.baseHeight,
  };
  const rotated =
    draft.transform.rotation === 90 || draft.transform.rotation === 270;
  const transformWidth = Math.max(1, rotated ? crop.height : crop.width);
  const transformHeight = Math.max(1, rotated ? crop.width : crop.height);
  const maxProxy = 2_048;
  const proxyScale = Math.min(
    1,
    maxProxy /
      Math.max(draft.transform.outputWidth, draft.transform.outputHeight),
  );
  const correctedBaseImage = useCorrectedProxyImage(
    baseImage,
    draft,
    proxyScale,
    compare,
  );
  const stageScale = proxyScale * zoom;
  const stageWidth = Math.max(
    1,
    Math.round(draft.transform.outputWidth * stageScale),
  );
  const stageHeight = Math.max(
    1,
    Math.round(draft.transform.outputHeight * stageScale),
  );
  const documentTransform = {
    x: stageWidth / 2,
    y: stageHeight / 2,
    offsetX: crop.x + crop.width / 2,
    offsetY: crop.y + crop.height / 2,
    scaleX: (stageWidth / transformWidth) * (draft.transform.flipX ? -1 : 1),
    scaleY: (stageHeight / transformHeight) * (draft.transform.flipY ? -1 : 1),
    rotation: draft.transform.rotation + draft.transform.straighten,
  };
  const selectedLayer =
    draft.layers.find((layer) => layer.id === draft.selectedLayerId) ?? null;
  const selectedPaintBounds =
    selectedLayer?.kind === "paint" ? paintLayerBounds(selectedLayer) : null;
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    renderClient.current = new RasterRenderClient();
    return () => {
      if (textTimer.current) window.clearTimeout(textTimer.current);
      renderAbort.current?.abort();
      renderClient.current?.dispose();
      renderClient.current = null;
    };
  }, []);

  useEffect(() => {
    // Undo and redo replace the persisted document from outside the component.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initialDocument);
  }, [initialDocument, path]);

  useEffect(() => {
    if (initialDocument.metadata.profileNormalized)
      onStatus(
        translate("ui.editorWorkspace.asset.editor.colorProfileNormalized"),
        false,
      );
  }, [initialDocument.metadata.profileNormalized, onStatus, path]);

  useEffect(() => {
    const selectedDocumentLayer = draft.layers.find(
      (layer) => layer.id === draft.selectedLayerId,
    );
    const selected =
      tool === "select" &&
      selectedDocumentLayer?.visible &&
      !selectedDocumentLayer.locked
        ? stage.current?.findOne(`#asset-layer-node-${draft.selectedLayerId}`)
        : null;
    transformer.current?.nodes(
      selected instanceof Konva.Node ? [selected] : [],
    );
    transformer.current?.getLayer()?.batchDraw();
  }, [draft.selectedLayerId, draft.layers, tool]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (
        event.code === "Space" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !(event.target instanceof HTMLSelectElement)
      ) {
        event.preventDefault();
        setSpacePan(true);
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePan(false);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  const commit = async (
    next: RasterAssetEditorDocument,
    historyLabel: string,
  ) => {
    const renderDocument = { ...next, validationError: undefined };
    setDraft(renderDocument);
    renderAbort.current?.abort();
    const controller = new AbortController();
    renderAbort.current = controller;
    const generation = ++renderGeneration.current;
    setRendering(true);
    setError(null);
    onStatus(
      translate("ui.editorWorkspace.asset.editor.renderingFullResolution"),
      false,
    );
    try {
      const result = await renderClient.current!.render(
        renderDocument,
        controller.signal,
      );
      if (generation !== renderGeneration.current || controller.signal.aborted)
        return;
      onCommit(result.bytes, renderDocument, historyLabel);
      onStatus(
        translate("ui.editorWorkspace.asset.editor.previewUpdated", {
          width: result.width,
          height: result.height,
        }),
        false,
      );
    } catch (nextError) {
      if (controller.signal.aborted) return;
      console.error("Raster rendering failed.", nextError);
      const message = translate(
        "ui.editorWorkspace.asset.editor.renderingFailed",
      );
      setError(message);
      onCommit(
        bytes,
        { ...renderDocument, validationError: message },
        translate("ui.editorWorkspace.asset.editor.keepFailedHistory", {
          action: historyLabel.toLocaleLowerCase(),
        }),
      );
      onStatus(
        translate("ui.editorWorkspace.asset.editor.validImageRetained", {
          message,
        }),
        true,
      );
    } finally {
      if (generation === renderGeneration.current) setRendering(false);
    }
  };

  const updateSelected = (
    update: (layer: RasterLayer) => RasterLayer,
    label: string,
  ) => {
    if (!draft.selectedLayerId) return;
    updateLayer(draft.selectedLayerId, update, label);
  };

  const updateLayer = (
    id: string,
    update: (layer: RasterLayer) => RasterLayer,
    label: string,
  ) => {
    void commit(
      {
        ...draft,
        layers: draft.layers.map((layer) =>
          layer.id === id ? update(layer) : layer,
        ),
        selectedLayerId: id,
      },
      label,
    );
  };

  const selectTool = (nextTool: RasterTool) => {
    setTool(nextTool);
  };

  const paintPointerPosition = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): { x: number; y: number } | null => {
    const container = stage.current?.container();
    const group = documentGroup.current;
    if (!container || !group) return null;
    const bounds = container.getBoundingClientRect();
    return group
      .getAbsoluteTransform()
      .copy()
      .invert()
      .point({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
  };

  const beginPan = (
    event: ReactPointerEvent<HTMLDivElement>,
    temporary: boolean,
  ) => {
    const host = stageHost.current;
    if (!host) return;
    panGesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: host.scrollLeft,
      scrollTop: host.scrollTop,
      previousTool: tool,
      temporary,
    };
    if (temporary) setTool("pan");
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleStagePointerStart = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.currentTarget.focus({ preventScroll: true });
    if (event.button === 1) {
      event.preventDefault();
      beginPan(event, true);
      return;
    }
    if (event.button !== 0 || readOnly) return;
    if (tool === "pan" || spacePan) {
      beginPan(event, false);
      return;
    }
    const point = paintPointerPosition(event);
    if (!point) return;
    if (
      tool === "select" &&
      selectedLayer?.kind === "paint" &&
      selectedLayer.visible &&
      !selectedLayer.locked
    ) {
      const bounds = paintLayerBounds(selectedLayer);
      const hitRadius = 5 / Math.max(stageScale, 0.01);
      const horizontalHandle =
        Math.abs(point.x - bounds.x) <= hitRadius
          ? -1
          : Math.abs(point.x - (bounds.x + bounds.width)) <= hitRadius
            ? 1
            : 0;
      const verticalHandle =
        Math.abs(point.y - bounds.y) <= hitRadius
          ? -1
          : Math.abs(point.y - (bounds.y + bounds.height)) <= hitRadius
            ? 1
            : 0;
      const nearHorizontalEdge =
        point.y >= bounds.y - hitRadius &&
        point.y <= bounds.y + bounds.height + hitRadius;
      const nearVerticalEdge =
        point.x >= bounds.x - hitRadius &&
        point.x <= bounds.x + bounds.width + hitRadius;
      const handleX = nearHorizontalEdge ? horizontalHandle : 0;
      const handleY = nearVerticalEdge ? verticalHandle : 0;
      const insideBounds =
        point.x >= bounds.x - hitRadius &&
        point.x <= bounds.x + bounds.width + hitRadius &&
        point.y >= bounds.y - hitRadius &&
        point.y <= bounds.y + bounds.height + hitRadius;
      if (handleX !== 0 || handleY !== 0 || insideBounds) {
        activePaintTransform.current = {
          pointerId: event.pointerId,
          started: false,
          mode: handleX !== 0 || handleY !== 0 ? "resize" : "move",
          handleX,
          handleY,
          startX: point.x,
          startY: point.y,
          layer: selectedLayer,
          bounds,
          nextDocument: draftRef.current,
        };
      }
    }
    if (tool === "paint" || tool === "eraser") {
      const gesture: ActivePaintGesture = {
        layer: {
          id: layerId(),
          kind: "paint",
          name: tool === "eraser" ? "Eraser" : "Paint",
          visible: true,
          locked: false,
          opacity: 1,
          strokes: [],
        },
        points: [point.x, point.y, point.x, point.y],
        color: brushColor,
        size: brushSize,
        hardness: brushHardness,
        opacity: brushOpacity,
        erase: tool === "eraser",
      };
      activePaint.current = gesture;
      setLivePaint(gesture);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (
      ["crop", "text", "line", "arrow", "rectangle", "ellipse"].includes(tool)
    ) {
      const gesture: ActiveBoxGesture = {
        tool: tool as ActiveBoxGesture["tool"],
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
      };
      activeBox.current = gesture;
      setLiveBox(gesture);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activePan = panGesture.current;
    if (activePan) {
      const host = stageHost.current;
      if (!host) return;
      host.scrollLeft =
        activePan.scrollLeft - (event.clientX - activePan.startX);
      host.scrollTop = activePan.scrollTop - (event.clientY - activePan.startY);
      return;
    }
    const paintTransform = activePaintTransform.current;
    if (paintTransform) {
      const point = paintPointerPosition(event);
      if (!point) return;
      const deltaX = point.x - paintTransform.startX;
      const deltaY = point.y - paintTransform.startY;
      if (!paintTransform.started) {
        if (Math.hypot(deltaX, deltaY) < 2) return;
        paintTransform.started = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      const bounds = { ...paintTransform.bounds };
      if (paintTransform.mode === "move") {
        bounds.x += deltaX;
        bounds.y += deltaY;
      } else {
        if (paintTransform.handleX < 0) {
          bounds.x += deltaX;
          bounds.width -= deltaX;
        } else if (paintTransform.handleX > 0) bounds.width += deltaX;
        if (paintTransform.handleY < 0) {
          bounds.y += deltaY;
          bounds.height -= deltaY;
        } else if (paintTransform.handleY > 0) bounds.height += deltaY;
        if (bounds.width < 1) {
          bounds.x += bounds.width - 1;
          bounds.width = 1;
        }
        if (bounds.height < 1) {
          bounds.y += bounds.height - 1;
          bounds.height = 1;
        }
      }
      const transformed = transformPaintLayerToBounds(
        paintTransform.layer,
        bounds,
      );
      const nextDocument = {
        ...draftRef.current,
        layers: draftRef.current.layers.map((layer) =>
          layer.id === transformed.id ? transformed : layer,
        ),
      };
      paintTransform.nextDocument = nextDocument;
      setDraft(nextDocument);
      return;
    }
    const active = activePaint.current;
    const point = paintPointerPosition(event);
    if (!point) return;
    if (active) {
      const { x, y } = point;
      const previousX = active.points.at(-2);
      const previousY = active.points.at(-1);
      if (previousX === x && previousY === y) return;
      const next = { ...active, points: [...active.points, x, y] };
      activePaint.current = next;
      setLivePaint(next);
      return;
    }
    const box = activeBox.current;
    if (!box) return;
    const { x } = point;
    let { y } = point;
    if (box.tool === "crop" && cropRatio !== "free") {
      const ratio =
        cropRatio === "original"
          ? draft.baseWidth / draft.baseHeight
          : cropRatio === "1:1"
            ? 1
            : cropRatio === "4:3"
              ? 4 / 3
              : cropRatio === "16:9"
                ? 16 / 9
                : null;
      if (ratio) {
        const deltaX = x - box.startX;
        const deltaY = y - box.startY;
        y = box.startY + (Math.sign(deltaY) || 1) * (Math.abs(deltaX) / ratio);
      }
    }
    const next = { ...box, currentX: x, currentY: y };
    activeBox.current = next;
    setLiveBox(next);
  };

  const finishStageGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activePan = panGesture.current;
    if (activePan) {
      panGesture.current = null;
      if (activePan.temporary) setTool(activePan.previousTool);
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    const paintTransform = activePaintTransform.current;
    if (paintTransform) {
      activePaintTransform.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      if (!paintTransform.started) return;
      void commit(
        paintTransform.nextDocument,
        paintTransform.mode === "move"
          ? "Move paint layer"
          : "Resize paint layer",
      );
      return;
    }
    const active = activePaint.current;
    activePaint.current = null;
    setLivePaint(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (active) {
      const points = Array.from(
        { length: active.points.length / 2 },
        (_, index) => ({
          x: active.points[index * 2],
          y: active.points[index * 2 + 1],
        }),
      );
      const current = draftRef.current;
      const stroke: RasterStroke = {
        points,
        color: active.color,
        size: active.size,
        hardness: active.hardness,
        opacity: active.opacity,
        erase: active.erase,
      };
      if (active.erase) {
        const eligible = current.layers.filter(
          (layer) => layer.visible && !layer.locked,
        );
        if (eligible.length === 0) {
          onStatus(
            translate(
              "ui.editorWorkspace.asset.editor.noUnlockedLayersToErase",
            ),
            false,
          );
          return;
        }
        void commit(
          {
            ...current,
            layers: eraseUnlockedLayers(current.layers, stroke),
          },
          "Erase markup",
        );
        return;
      }
      const nextLayer: RasterPaintLayer = {
        ...active.layer,
        strokes: [stroke],
      };
      void commit(
        {
          ...current,
          selectedLayerId: active.layer.id,
          layers: [...current.layers, nextLayer],
        },
        "Paint",
      );
      return;
    }
    const box = activeBox.current;
    activeBox.current = null;
    setLiveBox(null);
    if (!box) return;
    const deltaX = box.currentX - box.startX;
    const deltaY = box.currentY - box.startY;
    const left = Math.max(
      0,
      Math.min(draft.baseWidth - 1, Math.min(box.startX, box.currentX)),
    );
    const top = Math.max(
      0,
      Math.min(draft.baseHeight - 1, Math.min(box.startY, box.currentY)),
    );
    const boxWidth = Math.min(
      draft.baseWidth - left,
      Math.max(1, Math.abs(deltaX)),
    );
    const boxHeight = Math.min(
      draft.baseHeight - top,
      Math.max(1, Math.abs(deltaY)),
    );
    if (box.tool === "crop") {
      if (boxWidth < 2 || boxHeight < 2) return;
      void commit(
        {
          ...draftRef.current,
          transform: {
            ...draftRef.current.transform,
            crop: { x: left, y: top, width: boxWidth, height: boxHeight },
            outputWidth: Math.round(boxWidth),
            outputHeight: Math.round(boxHeight),
          },
        },
        "Crop image",
      );
      return;
    }
    const id = layerId();
    const base = {
      id,
      name:
        box.tool === "text"
          ? "Text"
          : `${box.tool[0].toLocaleUpperCase()}${box.tool.slice(1)}`,
      visible: true,
      locked: false,
      opacity: 1,
    };
    const layer: RasterTextLayer | RasterShapeLayer =
      box.tool === "text"
        ? {
            ...base,
            kind: "text",
            x: left,
            y: top,
            width: boxWidth,
            rotation: 0,
            text: textValue,
            family: "sans",
            size: boxHeight,
            weight: "normal",
            align: "left",
            color: brushColor,
            background: null,
          }
        : {
            ...base,
            kind: "shape",
            shape: box.tool,
            x: box.tool === "line" || box.tool === "arrow" ? box.startX : left,
            y: box.tool === "line" || box.tool === "arrow" ? box.startY : top,
            width:
              box.tool === "line" || box.tool === "arrow" ? deltaX : boxWidth,
            height:
              box.tool === "line" || box.tool === "arrow" ? deltaY : boxHeight,
            rotation: 0,
            stroke: shapeStroke,
            fill:
              shapeFill === "none"
                ? null
                : shapeFill === "current"
                  ? brushColor
                  : shapeFill === "white"
                    ? "#ffffff"
                    : "#000000",
            strokeWidth: shapeWidth,
          };
    void commit(
      {
        ...draftRef.current,
        layers: [...draftRef.current.layers, layer],
        selectedLayerId: id,
      },
      `Add ${box.tool}`,
    );
  };

  const cancelStageGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activePan = panGesture.current;
    if (activePan?.temporary) setTool(activePan.previousTool);
    panGesture.current = null;
    activePaintTransform.current = null;
    activePaint.current = null;
    setLivePaint(null);
    activeBox.current = null;
    setLiveBox(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const showTooltip = (
    target: HTMLButtonElement,
    label: string,
    shortcut?: string,
  ) => {
    const bounds = target.getBoundingClientRect();
    setTooltip({
      label,
      shortcut,
      left: Math.min(bounds.right + 8, window.innerWidth - 180),
      top: bounds.top + bounds.height / 2,
    });
  };

  const tooltipEvents = (label: string, shortcut?: string) => ({
    title: shortcut ? `${label} (${shortcut})` : label,
    onMouseEnter: (event: ReactMouseEvent<HTMLButtonElement>) =>
      showTooltip(event.currentTarget, label, shortcut),
    onMouseLeave: () => setTooltip(null),
    onFocus: (event: ReactFocusEvent<HTMLButtonElement>) =>
      showTooltip(event.currentTarget, label, shortcut),
    onBlur: () => setTooltip(null),
  });

  const resize = (nextWidth: number, nextHeight: number) => {
    void commit(
      {
        ...draft,
        transform: {
          ...draft.transform,
          outputWidth: nextWidth,
          outputHeight: nextHeight,
        },
      },
      "Resize image",
    );
  };

  const nudgeSelected = (x: number, y: number) =>
    updateSelected(
      (layer) =>
        layer.kind === "paint"
          ? {
              ...layer,
              erasures: translateStrokes(layer.erasures, x, y),
              strokes: layer.strokes.map((stroke) => ({
                ...stroke,
                points: stroke.points.map((point) => ({
                  x: point.x + x,
                  y: point.y + y,
                })),
              })),
            }
          : {
              ...layer,
              x: layer.x + x,
              y: layer.y + y,
              erasures: translateStrokes(layer.erasures, x, y),
            },
      "Nudge layer",
    );

  const moveLayerFromCanvas = (id: string, x: number, y: number) =>
    updateLayer(
      id,
      (layer) => {
        if (layer.kind === "paint") {
          const bounds = paintLayerBounds(layer);
          return transformPaintLayerToBounds(layer, { ...bounds, x, y });
        }
        const deltaX = x - layer.x;
        const deltaY = y - layer.y;
        return {
          ...layer,
          x,
          y,
          erasures: translateStrokes(layer.erasures, deltaX, deltaY),
        };
      },
      "Move layer",
    );

  const transformLayerFromCanvas = (
    id: string,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    rotation: number,
  ) =>
    updateLayer(
      id,
      (layer) => {
        if (layer.kind === "shape")
          return {
            ...layer,
            x,
            y,
            width: layer.width * scaleX,
            height: layer.height * scaleY,
            rotation,
            erasures: transformStrokes(
              layer.erasures,
              layer.x,
              layer.y,
              layer.rotation,
              x,
              y,
              scaleX,
              scaleY,
              rotation,
            ),
          };
        if (layer.kind === "text")
          return {
            ...layer,
            x,
            y,
            width: Math.max(1, layer.width * Math.abs(scaleX)),
            rotation,
            erasures: translateStrokes(
              layer.erasures,
              x - layer.x,
              y - layer.y,
            ),
          };
        const bounds = paintLayerBounds(layer);
        return transformPaintLayerToBounds(layer, {
          x,
          y,
          width: Math.max(1, bounds.width * Math.abs(scaleX)),
          height: Math.max(1, bounds.height * Math.abs(scaleY)),
        });
      },
      "Transform layer",
    );

  const finishLayerRename = () => {
    if (!renamingLayerId) return;
    const name = renamingLayerValue.trim();
    const current = draftRef.current;
    setRenamingLayerId(null);
    if (!name) return;
    void commit(
      {
        ...current,
        layers: current.layers.map((layer) =>
          layer.id === renamingLayerId ? { ...layer, name } : layer,
        ),
      },
      "Rename layer",
    );
  };

  const toolButtons: Array<[RasterTool, string, string, KeybindingAction]> = [
    ["select", "↖", "Select", "assetSelectTool"],
    ["pan", "✥", "Pan", "assetPanTool"],
    ["crop", "⌗", "Crop", "assetCropTool"],
    ["paint", "✎", "Paint", "assetPaintTool"],
    ["eraser", "⌫", "Eraser", "assetEraserTool"],
    ["text", "T", "Text", "assetTextTool"],
    ["line", "╱", "Line", "assetLineTool"],
    ["arrow", "→", "Arrow", "assetArrowTool"],
    ["rectangle", "□", "Rectangle", "assetRectangleTool"],
    ["ellipse", "○", "Ellipse", "assetEllipseTool"],
  ];

  return (
    <div
      className="asset-raster-editor"
      aria-busy={rendering || undefined}
      onFocus={() => onFocusChange(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          onFocusChange(false);
      }}
      onKeyDown={(event) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLocaleLowerCase() === "z"
        ) {
          event.preventDefault();
          if (event.shiftKey) onRedo();
          else onUndo();
        } else if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLocaleLowerCase() === "y"
        ) {
          event.preventDefault();
          onRedo();
        } else if (
          event.key === "Delete" &&
          draft.selectedLayerId &&
          !selectedLayer?.locked
        ) {
          event.preventDefault();
          void commit(
            {
              ...draft,
              layers: draft.layers.filter(
                (layer) => layer.id !== draft.selectedLayerId,
              ),
              selectedLayerId: null,
            },
            "Delete layer",
          );
        } else if (
          draft.selectedLayerId &&
          !selectedLayer?.locked &&
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key,
          )
        ) {
          event.preventDefault();
          const amount = event.shiftKey ? 10 : 1;
          nudgeSelected(
            event.key === "ArrowLeft"
              ? -amount
              : event.key === "ArrowRight"
                ? amount
                : 0,
            event.key === "ArrowUp"
              ? -amount
              : event.key === "ArrowDown"
                ? amount
                : 0,
          );
        } else if (
          draft.selectedLayerId &&
          (event.key === "Home" || event.key === "End")
        ) {
          event.preventDefault();
          const index = draft.layers.findIndex(
            (layer) => layer.id === draft.selectedLayerId,
          );
          if (index < 0) return;
          const layers = [...draft.layers];
          const [layer] = layers.splice(index, 1);
          layers.splice(event.key === "Home" ? 0 : layers.length, 0, layer);
          void commit({ ...draft, layers }, "Move layer");
        } else if (
          !(event.target instanceof HTMLInputElement) &&
          !(event.target instanceof HTMLTextAreaElement) &&
          !(event.target instanceof HTMLSelectElement)
        ) {
          const nextTool = toolButtons.find(([, , , action]) =>
            matchesKeybinding(event.nativeEvent, keybindings[action]),
          )?.[0];
          if (nextTool !== undefined) {
            event.preventDefault();
            selectTool(nextTool);
          } else if (event.key === "Escape") setTool("select");
        } else if (event.key === "Escape") setTool("select");
      }}
    >
      <div className="asset-raster-commandbar">
        <button
          type="button"
          onClick={() => {
            const host = stageHost.current;
            if (!host) return;
            setZoom(
              Math.max(
                0.25,
                Math.min(
                  2,
                  Math.min(
                    (host.clientWidth - 32) /
                      (draft.transform.outputWidth * proxyScale),
                    (host.clientHeight - 32) /
                      (draft.transform.outputHeight * proxyScale),
                  ),
                ),
              ),
            );
          }}
        >
          {translate("ui.editorWorkspace.asset.editor.fit")}
        </button>
        {[0.25, 0.5, 1, 2].map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={zoom === value}
            onClick={() => setZoom(value)}
          >
            {value * 100}%
          </button>
        ))}
        <button
          type="button"
          aria-pressed={compare}
          onClick={() => setCompare((current) => !current)}
        >
          {translate("ui.editorWorkspace.asset.editor.holdOriginal")}
        </button>
        <button
          type="button"
          aria-pressed={inspectorOpen}
          onClick={() => setInspectorOpen((current) => !current)}
        >
          {translate("ui.editorWorkspace.asset.editor.inspector")}
        </button>
        <button
          type="button"
          aria-pressed={layersOpen}
          onClick={() => setLayersOpen((current) => !current)}
        >
          {translate("ui.editorWorkspace.asset.editor.layers")}
        </button>
        <span className="asset-raster-command-spacer" />
        <button
          type="button"
          onClick={() => {
            const next = createRasterEditorDocument(
              format,
              draft.baseBytes,
              draft.baseWidth,
              draft.baseHeight,
            );
            void commit(next, "Reset all");
          }}
        >
          {translate("ui.editorWorkspace.asset.editor.resetAll")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              !window.confirm(
                "Flatten corrections and layers into a new immutable base? This action is undoable.",
              )
            )
              return;
            void (async () => {
              const controller = new AbortController();
              const rendered = await renderClient.current!.render(
                draft,
                controller.signal,
              );
              const next = createRasterEditorDocument(
                format,
                rendered.bytes,
                rendered.width,
                rendered.height,
              );
              onCommit(rendered.bytes, next, "Flatten editing document");
              setDraft(next);
            })();
          }}
        >
          {translate("ui.editorWorkspace.asset.editor.flatten")}
        </button>
      </div>

      <div
        className={`asset-raster-body${
          inspectorOpen ? "" : " is-inspector-collapsed"
        }`}
      >
        <div
          className="asset-raster-toolrail"
          role="toolbar"
          aria-label={translate("ui.editorWorkspace.asset.editor.tools")}
        >
          {toolButtons.map(([value, icon, label, action]) => {
            const shortcut = keybindingDisplay(keybindings[action]);
            return (
              <button
                type="button"
                key={value}
                {...tooltipEvents(label, shortcut)}
                aria-label={label}
                aria-pressed={tool === value}
                onClick={() => selectTool(value)}
              >
                <span aria-hidden="true">{icon}</span>
              </button>
            );
          })}
        </div>

        <div
          ref={stageHost}
          className={`asset-raster-stage is-tool-${tool}`}
          data-transformer-active={
            tool === "select" &&
            Boolean(selectedLayer?.visible && !selectedLayer.locked)
              ? "true"
              : "false"
          }
          role="img"
          tabIndex={0}
          aria-label={translate(
            selectedLayer
              ? "ui.editorWorkspace.asset.editor.canvasWithSelection"
              : "ui.editorWorkspace.asset.editor.canvas",
            {
              path,
              count: draft.layers.length,
              zoom: Math.round(zoom * 100),
              layer: selectedLayer?.name,
              visibility: selectedLayer
                ? translate(
                    selectedLayer.visible
                      ? "ui.editorWorkspace.asset.editor.visible"
                      : "ui.editorWorkspace.asset.editor.hidden",
                  )
                : "",
              lock: selectedLayer
                ? translate(
                    selectedLayer.locked
                      ? "ui.editorWorkspace.asset.editor.locked"
                      : "ui.editorWorkspace.asset.editor.editable",
                  )
                : "",
            },
          )}
          aria-keyshortcuts="Control+Z Meta+Z Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y"
          onPointerDown={handleStagePointerStart}
          onPointerMove={handleStagePointerMove}
          onPointerUp={finishStageGesture}
          onPointerCancel={cancelStageGesture}
          onAuxClick={(event) => {
            if (event.button === 1) event.preventDefault();
          }}
        >
          <div className="asset-raster-proxy">
            <Stage
              ref={stage}
              width={stageWidth}
              height={stageHeight}
              draggable={false}
              onWheel={(event) => {
                event.evt.preventDefault();
                setZoom((current) =>
                  Math.max(
                    0.25,
                    Math.min(2, current * (event.evt.deltaY > 0 ? 0.9 : 1.1)),
                  ),
                );
              }}
              onTouchMove={(event) => {
                const touches = event.evt.touches;
                if (touches.length !== 2) return;
                event.evt.preventDefault();
                const distance = Math.hypot(
                  touches[0].clientX - touches[1].clientX,
                  touches[0].clientY - touches[1].clientY,
                );
                if (lastTouchDistance.current)
                  setZoom((current) =>
                    Math.max(
                      0.25,
                      Math.min(
                        2,
                        current * (distance / lastTouchDistance.current!),
                      ),
                    ),
                  );
                lastTouchDistance.current = distance;
              }}
              onTouchEnd={() => {
                lastTouchDistance.current = null;
              }}
            >
              <Layer>
                <Group {...documentTransform}>
                  {correctedBaseImage && (
                    <KonvaImage
                      image={correctedBaseImage}
                      width={draft.baseWidth}
                      height={draft.baseHeight}
                      listening={false}
                    />
                  )}
                </Group>
              </Layer>
              {!compare &&
                draft.layers.map((layer) => {
                  const liveErasure =
                    livePaint?.erase && layer.visible && !layer.locked
                      ? [
                          {
                            points: Array.from(
                              { length: livePaint.points.length / 2 },
                              (_, index) => ({
                                x: livePaint.points[index * 2],
                                y: livePaint.points[index * 2 + 1],
                              }),
                            ),
                            color: "#000000",
                            size: livePaint.size,
                            hardness: livePaint.hardness,
                            opacity: livePaint.opacity,
                            erase: true,
                          } satisfies RasterStroke,
                        ]
                      : [];
                  return (
                    <Layer key={layer.id}>
                      <Group {...documentTransform}>
                        <LayerNode
                          layer={layer}
                          scale={1}
                          selected={draft.selectedLayerId === layer.id}
                          interactive={tool === "select"}
                          onSelect={() =>
                            setDraft((current) => ({
                              ...current,
                              selectedLayerId: layer.id,
                            }))
                          }
                          onMove={(x, y) => moveLayerFromCanvas(layer.id, x, y)}
                          onTransform={(x, y, scaleX, scaleY, rotation) =>
                            transformLayerFromCanvas(
                              layer.id,
                              x,
                              y,
                              scaleX,
                              scaleY,
                              rotation,
                            )
                          }
                        />
                        <ErasureLines
                          strokes={[...(layer.erasures ?? []), ...liveErasure]}
                          visible={layer.visible}
                        />
                      </Group>
                    </Layer>
                  );
                })}
              <Layer>
                <Group ref={documentGroup} {...documentTransform}>
                  {!compare && livePaint && !livePaint.erase && (
                    <Line
                      points={livePaint.points}
                      stroke={livePaint.color}
                      strokeWidth={livePaint.size}
                      opacity={livePaint.opacity}
                      lineCap={livePaint.hardness < 0.5 ? "round" : "square"}
                      lineJoin="round"
                      listening={false}
                    />
                  )}
                  {!compare &&
                    liveBox &&
                    (liveBox.tool === "line" || liveBox.tool === "arrow") &&
                    (liveBox.tool === "arrow" ? (
                      <Arrow
                        points={[
                          liveBox.startX,
                          liveBox.startY,
                          liveBox.currentX,
                          liveBox.currentY,
                        ]}
                        stroke={shapeStroke}
                        strokeWidth={shapeWidth}
                        pointerLength={10}
                        listening={false}
                      />
                    ) : (
                      <Line
                        points={[
                          liveBox.startX,
                          liveBox.startY,
                          liveBox.currentX,
                          liveBox.currentY,
                        ]}
                        stroke={shapeStroke}
                        strokeWidth={shapeWidth}
                        listening={false}
                      />
                    ))}
                  {!compare &&
                    liveBox &&
                    ["rectangle", "ellipse", "text"].includes(liveBox.tool) &&
                    (liveBox.tool === "ellipse" ? (
                      <Ellipse
                        x={(liveBox.startX + liveBox.currentX) / 2}
                        y={(liveBox.startY + liveBox.currentY) / 2}
                        radiusX={
                          Math.abs(liveBox.currentX - liveBox.startX) / 2
                        }
                        radiusY={
                          Math.abs(liveBox.currentY - liveBox.startY) / 2
                        }
                        stroke={shapeStroke}
                        strokeWidth={shapeWidth}
                        listening={false}
                      />
                    ) : (
                      <Rect
                        x={Math.min(liveBox.startX, liveBox.currentX)}
                        y={Math.min(liveBox.startY, liveBox.currentY)}
                        width={Math.abs(liveBox.currentX - liveBox.startX)}
                        height={Math.abs(liveBox.currentY - liveBox.startY)}
                        stroke={
                          liveBox.tool === "text" ? brushColor : shapeStroke
                        }
                        strokeWidth={liveBox.tool === "text" ? 1 : shapeWidth}
                        dash={liveBox.tool === "text" ? [5, 3] : undefined}
                        listening={false}
                      />
                    ))}
                  {tool === "crop" && (
                    <Rect
                      x={
                        liveBox?.tool === "crop"
                          ? Math.min(liveBox.startX, liveBox.currentX)
                          : crop.x
                      }
                      y={
                        liveBox?.tool === "crop"
                          ? Math.min(liveBox.startY, liveBox.currentY)
                          : crop.y
                      }
                      width={
                        liveBox?.tool === "crop"
                          ? Math.abs(liveBox.currentX - liveBox.startX)
                          : crop.width
                      }
                      height={
                        liveBox?.tool === "crop"
                          ? Math.abs(liveBox.currentY - liveBox.startY)
                          : crop.height
                      }
                      fill="rgba(0,0,0,0.08)"
                      stroke="#ffffff"
                      strokeWidth={1}
                      dash={[6, 4]}
                      listening={false}
                    />
                  )}
                  <Transformer
                    ref={transformer}
                    listening={selectedLayer?.kind !== "paint"}
                    rotateEnabled={
                      tool === "select" &&
                      !selectedLayer?.locked &&
                      selectedLayer?.kind !== "paint"
                    }
                    resizeEnabled={tool === "select" && !selectedLayer?.locked}
                    enabledAnchors={
                      selectedLayer?.kind === "text"
                        ? ["middle-left", "middle-right"]
                        : undefined
                    }
                    keepRatio={
                      selectedLayer?.kind !== "text" &&
                      selectedLayer?.kind !== "paint"
                    }
                    flipEnabled={false}
                    boundBoxFunc={(oldBox, nextBox) =>
                      nextBox.width < 8 || nextBox.height < 8 ? oldBox : nextBox
                    }
                  />
                </Group>
              </Layer>
            </Stage>
          </div>
          {tool === "crop" && (
            <span className="asset-raster-crop-hint" role="status">
              {liveBox?.tool === "crop"
                ? translate("ui.editorWorkspace.asset.editor.cropSize", {
                    width: Math.round(
                      Math.abs(liveBox.currentX - liveBox.startX),
                    ),
                    height: Math.round(
                      Math.abs(liveBox.currentY - liveBox.startY),
                    ),
                  })
                : translate("ui.editorWorkspace.asset.editor.cropHint")}
            </span>
          )}
          <span className="sr-only">
            {translate("ui.editorWorkspace.asset.editor.canvasFallback")}
          </span>
        </div>

        {inspectorOpen && (
          <aside
            className="asset-raster-inspector"
            aria-label={translate(
              "ui.editorWorkspace.asset.editor.toolInspector",
            )}
          >
            <details open>
              <summary>
                <h3>
                  {translate("ui.editorWorkspace.asset.editor.corrections")}
                </h3>
              </summary>
              {Object.entries(correctionLabels).map(([name, label]) => (
                <RangeField
                  key={name}
                  label={label}
                  value={draft.corrections[name as RasterCorrectionName]}
                  minimum={-100}
                  maximum={100}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      corrections: {
                        ...current.corrections,
                        [name]: value,
                      },
                    }))
                  }
                  onCommit={() =>
                    void commit(
                      draftRef.current,
                      `Adjust ${label.toLocaleLowerCase()}`,
                    )
                  }
                />
              ))}
              <div className="asset-raster-presets">
                {[
                  ["monochrome", "Monochrome"],
                  ["warm", "Warm"],
                  ["cool", "Cool"],
                  ["vivid", "Vivid"],
                  ["muted", "Muted"],
                  ["contrast", "High contrast"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() =>
                      void commit(
                        {
                          ...draft,
                          corrections: rasterPreset(
                            draft.corrections,
                            value as Parameters<typeof rasterPreset>[1],
                          ),
                        },
                        `Apply ${label} preset`,
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </details>

            <details open>
              <summary>
                <h3>
                  {translate("ui.editorWorkspace.asset.editor.transform")}
                </h3>
              </summary>
              <div className="asset-raster-button-grid">
                <button
                  type="button"
                  onClick={() =>
                    void commit(
                      {
                        ...draft,
                        transform: {
                          ...draft.transform,
                          rotation: ((draft.transform.rotation + 270) % 360) as
                            0 | 90 | 180 | 270,
                          outputWidth: draft.transform.outputHeight,
                          outputHeight: draft.transform.outputWidth,
                        },
                      },
                      "Rotate left",
                    )
                  }
                >
                  ↶ 90°
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void commit(
                      {
                        ...draft,
                        transform: {
                          ...draft.transform,
                          rotation: ((draft.transform.rotation + 90) % 360) as
                            0 | 90 | 180 | 270,
                          outputWidth: draft.transform.outputHeight,
                          outputHeight: draft.transform.outputWidth,
                        },
                      },
                      "Rotate right",
                    )
                  }
                >
                  ↷ 90°
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void commit(
                      {
                        ...draft,
                        transform: {
                          ...draft.transform,
                          flipX: !draft.transform.flipX,
                        },
                      },
                      "Flip horizontal",
                    )
                  }
                >
                  {translate("ui.editorWorkspace.asset.editor.flipHorizontal")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void commit(
                      {
                        ...draft,
                        transform: {
                          ...draft.transform,
                          flipY: !draft.transform.flipY,
                        },
                      },
                      "Flip vertical",
                    )
                  }
                >
                  {translate("ui.editorWorkspace.asset.editor.flipVertical")}
                </button>
              </div>
              <RangeField
                label={translate("ui.editorWorkspace.asset.editor.straighten")}
                value={draft.transform.straighten}
                minimum={-45}
                maximum={45}
                suffix="°"
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    transform: { ...current.transform, straighten: value },
                  }))
                }
                onCommit={() =>
                  void commit(draftRef.current, "Straighten image")
                }
              />
            </details>

            <details open>
              <summary>
                <h3>
                  {translate("ui.editorWorkspace.asset.editor.cropResize")}
                </h3>
              </summary>
              <label>
                {translate("ui.editorWorkspace.asset.editor.ratio")}
                <select
                  value={cropRatio}
                  onChange={(event) => {
                    const ratio = event.target.value;
                    setCropRatio(ratio);
                    const values: Record<string, number> = {
                      original: draft.baseWidth / draft.baseHeight,
                      "1:1": 1,
                      "4:3": 4 / 3,
                      "16:9": 16 / 9,
                    };
                    if (ratio === "free" || ratio === "custom") return;
                    const nextRatio = values[ratio];
                    const cropWidth = draft.baseWidth;
                    const cropHeight = Math.min(
                      draft.baseHeight,
                      cropWidth / nextRatio,
                    );
                    void commit(
                      {
                        ...draft,
                        transform: {
                          ...draft.transform,
                          crop: {
                            x: 0,
                            y: (draft.baseHeight - cropHeight) / 2,
                            width: cropWidth,
                            height: cropHeight,
                          },
                          outputWidth: Math.round(cropWidth),
                          outputHeight: Math.round(cropHeight),
                        },
                      },
                      `Crop ${ratio}`,
                    );
                  }}
                >
                  <option value="free">
                    {translate("ui.editorWorkspace.asset.editor.free")}
                  </option>
                  <option value="original">
                    {translate("ui.editorWorkspace.asset.editor.original")}
                  </option>
                  <option value="1:1">1:1</option>
                  <option value="4:3">4:3</option>
                  <option value="16:9">16:9</option>
                  <option value="custom">
                    {translate("ui.editorWorkspace.asset.editor.custom")}
                  </option>
                </select>
              </label>
              <div className="asset-raster-dimensions">
                {(
                  [
                    ["x", "cropX"],
                    ["y", "cropY"],
                    ["width", "cropWidth"],
                    ["height", "cropHeight"],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field}>
                    {translate(`ui.editorWorkspace.asset.editor.${label}`)}
                    <RasterNumberInput
                      label={translate(
                        `ui.editorWorkspace.asset.editor.${label}`,
                      )}
                      minimum={field === "x" || field === "y" ? 0 : 1}
                      maximum={
                        field === "x" || field === "width"
                          ? draft.baseWidth
                          : draft.baseHeight
                      }
                      value={Math.round(crop[field])}
                      onChange={(value) => {
                        setCropRatio("custom");
                        setDraft((current) => ({
                          ...current,
                          transform: {
                            ...current.transform,
                            crop: { ...crop, [field]: value },
                          },
                        }));
                      }}
                      onBlur={() => {
                        const currentCrop =
                          draftRef.current.transform.crop ?? crop;
                        void commit(
                          {
                            ...draftRef.current,
                            transform: {
                              ...draftRef.current.transform,
                              crop: currentCrop,
                              outputWidth: Math.round(currentCrop.width),
                              outputHeight: Math.round(currentCrop.height),
                            },
                          },
                          "Crop image",
                        );
                      }}
                    />
                  </label>
                ))}
              </div>
              <label>
                <span>
                  {translate("ui.editorWorkspace.asset.editor.aspectLock")}
                  <input
                    type="checkbox"
                    checked={aspectLocked}
                    onChange={(event) => setAspectLocked(event.target.checked)}
                  />
                </span>
              </label>
              <div className="asset-raster-dimensions">
                <label>
                  {translate("ui.editorWorkspace.asset.editor.width")}
                  <RasterNumberInput
                    label={translate("ui.editorWorkspace.asset.editor.width")}
                    minimum={1}
                    maximum={8192}
                    value={draft.transform.outputWidth}
                    onChange={(outputWidth) => {
                      const ratio =
                        draft.transform.outputWidth /
                        draft.transform.outputHeight;
                      setDraft({
                        ...draft,
                        transform: {
                          ...draft.transform,
                          outputWidth,
                          outputHeight: aspectLocked
                            ? Math.max(1, Math.round(outputWidth / ratio))
                            : draft.transform.outputHeight,
                        },
                      });
                    }}
                    onBlur={() =>
                      resize(
                        draft.transform.outputWidth,
                        draft.transform.outputHeight,
                      )
                    }
                  />
                </label>
                <label>
                  {translate("ui.editorWorkspace.asset.editor.height")}
                  <RasterNumberInput
                    label={translate("ui.editorWorkspace.asset.editor.height")}
                    minimum={1}
                    maximum={8192}
                    value={draft.transform.outputHeight}
                    onChange={(outputHeight) => {
                      const ratio =
                        draft.transform.outputWidth /
                        draft.transform.outputHeight;
                      setDraft({
                        ...draft,
                        transform: {
                          ...draft.transform,
                          outputWidth: aspectLocked
                            ? Math.max(1, Math.round(outputHeight * ratio))
                            : draft.transform.outputWidth,
                          outputHeight,
                        },
                      });
                    }}
                    onBlur={() =>
                      resize(
                        draft.transform.outputWidth,
                        draft.transform.outputHeight,
                      )
                    }
                  />
                </label>
              </div>
            </details>

            <details open>
              <summary>
                <h3>{translate("ui.editorWorkspace.asset.editor.markup")}</h3>
              </summary>
              <label>
                {translate("ui.editorWorkspace.asset.editor.color")}
                <input
                  type="color"
                  value={brushColor}
                  onChange={(event) => setBrushColor(event.target.value)}
                />
              </label>
              <label>
                {translate("ui.editorWorkspace.asset.editor.brushSize")}
                <RasterNumberInput
                  label={translate("ui.editorWorkspace.asset.editor.brushSize")}
                  minimum={1}
                  maximum={512}
                  value={brushSize}
                  onChange={setBrushSize}
                />
              </label>
              <RangeField
                label={translate("ui.editorWorkspace.asset.editor.hardness")}
                value={brushHardness}
                minimum={0}
                maximum={1}
                step={0.05}
                resetValue={0.75}
                onChange={setBrushHardness}
              />
              <RangeField
                label={translate("ui.editorWorkspace.asset.editor.opacity")}
                value={brushOpacity}
                minimum={0.05}
                maximum={1}
                step={0.05}
                resetValue={1}
                onChange={setBrushOpacity}
              />
              <label>
                {translate("ui.editorWorkspace.asset.editor.shapeStroke")}
                <input
                  type="color"
                  value={shapeStroke}
                  onChange={(event) => setShapeStroke(event.target.value)}
                />
              </label>
              <label>
                {translate("ui.editorWorkspace.asset.editor.shapeFill")}
                <select
                  value={shapeFill}
                  onChange={(event) =>
                    setShapeFill(event.target.value as ShapeFillMode)
                  }
                >
                  <option value="none">
                    {translate("ui.editorWorkspace.asset.editor.none")}
                  </option>
                  <option value="current">
                    {translate(
                      "ui.editorWorkspace.asset.editor.currentMarkupColor",
                    )}
                  </option>
                  <option value="white">
                    {translate("ui.editorWorkspace.asset.editor.white")}
                  </option>
                  <option value="black">
                    {translate("ui.editorWorkspace.asset.editor.black")}
                  </option>
                </select>
              </label>
              <label>
                {translate("ui.editorWorkspace.asset.editor.strokeWidth")}
                <RasterNumberInput
                  label={translate(
                    "ui.editorWorkspace.asset.editor.strokeWidth",
                  )}
                  minimum={1}
                  maximum={128}
                  value={shapeWidth}
                  onChange={setShapeWidth}
                />
              </label>
              <label>
                {translate("ui.editorWorkspace.asset.editor.newText")}
                <input
                  type="text"
                  value={textValue}
                  onChange={(event) => setTextValue(event.target.value)}
                />
              </label>
            </details>

            {selectedLayer && (
              <details open>
                <summary>
                  <h3>
                    {translate("ui.editorWorkspace.asset.editor.selectedLayer")}
                  </h3>
                </summary>
                <label>
                  {translate("ui.editorWorkspace.asset.editor.name")}
                  <input
                    type="text"
                    value={selectedLayer.name}
                    onChange={(event) => {
                      const name = event.target.value;
                      setDraft((current) => ({
                        ...current,
                        layers: current.layers.map((layer) =>
                          layer.id === selectedLayer.id
                            ? { ...layer, name }
                            : layer,
                        ),
                      }));
                      if (textTimer.current)
                        window.clearTimeout(textTimer.current);
                      textTimer.current = window.setTimeout(
                        () => void commit(draftRef.current, "Rename layer"),
                        400,
                      );
                    }}
                    onBlur={() => void commit(draftRef.current, "Rename layer")}
                  />
                </label>
                <RangeField
                  label={translate("ui.editorWorkspace.asset.editor.opacity")}
                  value={selectedLayer.opacity}
                  minimum={0}
                  maximum={1}
                  step={0.05}
                  resetValue={1}
                  onChange={(opacity) =>
                    setDraft((current) => ({
                      ...current,
                      layers: current.layers.map((layer) =>
                        layer.id === selectedLayer.id
                          ? { ...layer, opacity }
                          : layer,
                      ),
                    }))
                  }
                  onCommit={() =>
                    void commit(draftRef.current, "Change layer opacity")
                  }
                />
                {selectedLayer.kind === "paint" && selectedPaintBounds && (
                  <div className="asset-raster-dimensions">
                    {(
                      [
                        ["x", "paintPositionX"],
                        ["y", "paintPositionY"],
                        ["width", "paintWidth"],
                        ["height", "paintHeight"],
                      ] as const
                    ).map(([field, label]) => (
                      <label key={field}>
                        {translate(`ui.editorWorkspace.asset.editor.${label}`)}
                        <RasterNumberInput
                          label={translate(
                            `ui.editorWorkspace.asset.editor.${label}`,
                          )}
                          minimum={
                            field === "width" || field === "height"
                              ? 1
                              : undefined
                          }
                          value={Math.round(selectedPaintBounds[field])}
                          onChange={(value) => {
                            setDraft((current) => ({
                              ...current,
                              layers: current.layers.map((layer) =>
                                layer.id === selectedLayer.id &&
                                layer.kind === "paint"
                                  ? transformPaintLayerToBounds(layer, {
                                      ...paintLayerBounds(layer),
                                      [field]: value,
                                    })
                                  : layer,
                              ),
                            }));
                          }}
                          onBlur={() =>
                            void commit(
                              draftRef.current,
                              field === "x" || field === "y"
                                ? "Move paint layer"
                                : "Resize paint layer",
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
                {selectedLayer.kind !== "paint" && (
                  <div className="asset-raster-dimensions">
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.positionX")}
                      <RasterNumberInput
                        label={translate(
                          "ui.editorWorkspace.asset.editor.positionX",
                        )}
                        value={Math.round(selectedLayer.x)}
                        onChange={(x) => {
                          setDraft((current) => ({
                            ...current,
                            layers: current.layers.map((layer) =>
                              layer.id === selectedLayer.id &&
                              layer.kind !== "paint"
                                ? { ...layer, x }
                                : layer,
                            ),
                          }));
                        }}
                        onBlur={() =>
                          void commit(draftRef.current, "Move layer")
                        }
                      />
                    </label>
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.positionY")}
                      <RasterNumberInput
                        label={translate(
                          "ui.editorWorkspace.asset.editor.positionY",
                        )}
                        value={Math.round(selectedLayer.y)}
                        onChange={(y) => {
                          setDraft((current) => ({
                            ...current,
                            layers: current.layers.map((layer) =>
                              layer.id === selectedLayer.id &&
                              layer.kind !== "paint"
                                ? { ...layer, y }
                                : layer,
                            ),
                          }));
                        }}
                        onBlur={() =>
                          void commit(draftRef.current, "Move layer")
                        }
                      />
                    </label>
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.rotation")}
                      <RasterNumberInput
                        label={translate(
                          "ui.editorWorkspace.asset.editor.rotation",
                        )}
                        minimum={-360}
                        maximum={360}
                        value={selectedLayer.rotation}
                        onChange={(rotation) => {
                          setDraft((current) => ({
                            ...current,
                            layers: current.layers.map((layer) =>
                              layer.id === selectedLayer.id &&
                              layer.kind !== "paint"
                                ? { ...layer, rotation }
                                : layer,
                            ),
                          }));
                        }}
                        onBlur={() =>
                          void commit(draftRef.current, "Rotate layer")
                        }
                      />
                    </label>
                  </div>
                )}
                {selectedLayer.kind === "text" && (
                  <>
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.text")}
                      <textarea
                        value={selectedLayer.text}
                        onChange={(event) => {
                          const text = event.target.value;
                          setDraft((current) => ({
                            ...current,
                            layers: current.layers.map((layer) =>
                              layer.id === selectedLayer.id &&
                              layer.kind === "text"
                                ? { ...layer, text }
                                : layer,
                            ),
                          }));
                          if (textTimer.current)
                            window.clearTimeout(textTimer.current);
                          textTimer.current = window.setTimeout(
                            () => void commit(draftRef.current, "Edit text"),
                            400,
                          );
                        }}
                        onBlur={() =>
                          void commit(draftRef.current, "Edit text")
                        }
                      />
                    </label>
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.font")}
                      <select
                        value={selectedLayer.family}
                        onChange={(event) =>
                          updateSelected(
                            (layer) =>
                              layer.kind === "text"
                                ? {
                                    ...layer,
                                    family: event.target.value as
                                      "sans" | "serif" | "mono",
                                  }
                                : layer,
                            "Change text font",
                          )
                        }
                      >
                        <option value="sans">
                          {translate("ui.editorWorkspace.asset.editor.sans")}
                        </option>
                        <option value="serif">
                          {translate("ui.editorWorkspace.asset.editor.serif")}
                        </option>
                        <option value="mono">
                          {translate("ui.editorWorkspace.asset.editor.mono")}
                        </option>
                      </select>
                    </label>
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.size")}
                      <RasterNumberInput
                        label={translate(
                          "ui.editorWorkspace.asset.editor.size",
                        )}
                        minimum={1}
                        maximum={2048}
                        value={selectedLayer.size}
                        onChange={(size) =>
                          updateLayer(
                            selectedLayer.id,
                            (layer) =>
                              layer.kind === "text"
                                ? {
                                    ...layer,
                                    size,
                                  }
                                : layer,
                            "Change text size",
                          )
                        }
                      />
                    </label>
                    <label>
                      {translate(
                        "ui.editorWorkspace.asset.editor.textBoxWidth",
                      )}
                      <RasterNumberInput
                        label={translate(
                          "ui.editorWorkspace.asset.editor.textBoxWidth",
                        )}
                        minimum={1}
                        maximum={8192}
                        value={Math.round(selectedLayer.width)}
                        onChange={(width) =>
                          updateLayer(
                            selectedLayer.id,
                            (layer) =>
                              layer.kind === "text"
                                ? {
                                    ...layer,
                                    width,
                                  }
                                : layer,
                            "Change text box width",
                          )
                        }
                      />
                    </label>
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.weight")}
                      <select
                        value={selectedLayer.weight}
                        onChange={(event) =>
                          updateLayer(
                            selectedLayer.id,
                            (layer) =>
                              layer.kind === "text"
                                ? {
                                    ...layer,
                                    weight: event.target.value as
                                      "normal" | "bold",
                                  }
                                : layer,
                            "Change text weight",
                          )
                        }
                      >
                        <option value="normal">
                          {translate("ui.editorWorkspace.asset.editor.normal")}
                        </option>
                        <option value="bold">
                          {translate("ui.editorWorkspace.asset.editor.bold")}
                        </option>
                      </select>
                    </label>
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.alignment")}
                      <select
                        value={selectedLayer.align}
                        onChange={(event) =>
                          updateLayer(
                            selectedLayer.id,
                            (layer) =>
                              layer.kind === "text"
                                ? {
                                    ...layer,
                                    align: event.target.value as
                                      "left" | "center" | "right",
                                  }
                                : layer,
                            "Change text alignment",
                          )
                        }
                      >
                        <option value="left">
                          {translate("ui.editorWorkspace.asset.editor.left")}
                        </option>
                        <option value="center">
                          {translate("ui.editorWorkspace.asset.editor.center")}
                        </option>
                        <option value="right">
                          {translate("ui.editorWorkspace.asset.editor.right")}
                        </option>
                      </select>
                    </label>
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.textColor")}
                      <input
                        type="color"
                        value={selectedLayer.color}
                        onChange={(event) =>
                          updateLayer(
                            selectedLayer.id,
                            (layer) =>
                              layer.kind === "text"
                                ? { ...layer, color: event.target.value }
                                : layer,
                            "Change text color",
                          )
                        }
                      />
                    </label>
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.background")}
                      <select
                        value={selectedLayer.background ?? "none"}
                        onChange={(event) =>
                          updateLayer(
                            selectedLayer.id,
                            (layer) =>
                              layer.kind === "text"
                                ? {
                                    ...layer,
                                    background:
                                      event.target.value === "none"
                                        ? null
                                        : event.target.value,
                                  }
                                : layer,
                            "Change text background",
                          )
                        }
                      >
                        <option value="none">
                          {translate("ui.editorWorkspace.asset.editor.none")}
                        </option>
                        <option value="#ffffff">
                          {translate("ui.editorWorkspace.asset.editor.white")}
                        </option>
                        <option value="#000000">
                          {translate("ui.editorWorkspace.asset.editor.black")}
                        </option>
                      </select>
                    </label>
                  </>
                )}
                {selectedLayer.kind === "shape" && (
                  <>
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.shapeStroke")}
                      <input
                        type="color"
                        value={selectedLayer.stroke}
                        onChange={(event) =>
                          updateLayer(
                            selectedLayer.id,
                            (layer) =>
                              layer.kind === "shape"
                                ? { ...layer, stroke: event.target.value }
                                : layer,
                            "Change shape stroke",
                          )
                        }
                      />
                    </label>
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.shapeFill")}
                      <select
                        value={selectedLayer.fill ?? "none"}
                        onChange={(event) =>
                          updateLayer(
                            selectedLayer.id,
                            (layer) =>
                              layer.kind === "shape"
                                ? {
                                    ...layer,
                                    fill:
                                      event.target.value === "none"
                                        ? null
                                        : event.target.value,
                                  }
                                : layer,
                            "Change shape fill",
                          )
                        }
                      >
                        <option value="none">
                          {translate("ui.editorWorkspace.asset.editor.none")}
                        </option>
                        <option value="#ffffff">
                          {translate("ui.editorWorkspace.asset.editor.white")}
                        </option>
                        <option value="#000000">
                          {translate("ui.editorWorkspace.asset.editor.black")}
                        </option>
                        <option value={brushColor}>
                          {translate(
                            "ui.editorWorkspace.asset.editor.currentMarkupColor",
                          )}
                        </option>
                      </select>
                    </label>
                    <label>
                      {translate("ui.editorWorkspace.asset.editor.strokeWidth")}
                      <RasterNumberInput
                        label={translate(
                          "ui.editorWorkspace.asset.editor.strokeWidth",
                        )}
                        minimum={1}
                        maximum={2048}
                        value={selectedLayer.strokeWidth}
                        onChange={(strokeWidth) =>
                          updateLayer(
                            selectedLayer.id,
                            (layer) =>
                              layer.kind === "shape"
                                ? {
                                    ...layer,
                                    strokeWidth,
                                  }
                                : layer,
                            "Change shape stroke width",
                          )
                        }
                      />
                    </label>
                  </>
                )}
              </details>
            )}

            <details className="asset-raster-encoding" open>
              <summary>
                <h3>{translate("ui.editorWorkspace.asset.editor.encoding")}</h3>
              </summary>
              {format === "jpg" && (
                <>
                  <label>
                    {translate("ui.editorWorkspace.asset.editor.jpegQuality")}
                    <RasterNumberInput
                      label={translate(
                        "ui.editorWorkspace.asset.editor.jpegQuality",
                      )}
                      minimum={60}
                      maximum={100}
                      value={draft.encoding.quality}
                      onChange={(quality) =>
                        setDraft({
                          ...draft,
                          encoding: {
                            ...draft.encoding,
                            quality,
                          },
                        })
                      }
                      onBlur={() =>
                        void commit(draftRef.current, "Change JPEG quality")
                      }
                    />
                  </label>
                  <label>
                    {translate(
                      "ui.editorWorkspace.asset.editor.transparencyBackground",
                    )}
                    <input
                      type="color"
                      value={draft.encoding.background}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          encoding: {
                            ...draft.encoding,
                            background: event.target.value,
                          },
                        })
                      }
                      onBlur={() =>
                        void commit(draftRef.current, "Change JPEG background")
                      }
                    />
                  </label>
                </>
              )}
              <p>
                {format === "png"
                  ? translate(
                      "ui.editorWorkspace.asset.editor.pngEncodingDescription",
                    )
                  : translate(
                      "ui.editorWorkspace.asset.editor.jpegEncodingDescription",
                    )}
              </p>
            </details>
          </aside>
        )}
      </div>

      {layersOpen && (
        <section
          className="asset-raster-layers"
          aria-label={translate("ui.editorWorkspace.asset.editor.layers")}
        >
          <header>
            <h3>{translate("ui.editorWorkspace.asset.editor.layers")}</h3>
            <span>{draft.layers.length}</span>
          </header>
          <ol>
            {[...draft.layers].reverse().map((layer, reversedIndex) => {
              const index = draft.layers.length - reversedIndex - 1;
              const select = () =>
                setDraft({ ...draft, selectedLayerId: layer.id });
              const rename = () => {
                setRenamingLayerId(layer.id);
                setRenamingLayerValue(layer.name);
              };
              const toggleVisibility = () =>
                updateLayer(
                  layer.id,
                  (selected) => ({
                    ...selected,
                    visible: !selected.visible,
                  }),
                  "Toggle layer visibility",
                );
              const toggleLock = () =>
                updateLayer(
                  layer.id,
                  (selected) => ({
                    ...selected,
                    locked: !selected.locked,
                  }),
                  "Toggle layer lock",
                );
              const move = (direction: 1 | -1) => {
                const layers = [...draft.layers];
                [layers[index], layers[index + direction]] = [
                  layers[index + direction],
                  layers[index],
                ];
                void commit(
                  { ...draft, layers, selectedLayerId: layer.id },
                  "Reorder layer",
                );
              };
              const duplicate = () => {
                const copy = structuredClone(layer);
                copy.id = layerId();
                copy.name = `${layer.name} copy`;
                void commit(
                  {
                    ...draft,
                    layers: [
                      ...draft.layers.slice(0, index + 1),
                      copy,
                      ...draft.layers.slice(index + 1),
                    ],
                    selectedLayerId: copy.id,
                  },
                  "Duplicate layer",
                );
              };
              const remove = () => {
                setTooltip(null);
                void commit(
                  {
                    ...draft,
                    layers: draft.layers.filter(
                      (candidate) => candidate.id !== layer.id,
                    ),
                    selectedLayerId:
                      draft.selectedLayerId === layer.id
                        ? null
                        : draft.selectedLayerId,
                  },
                  "Delete layer",
                );
              };
              const menu = {
                label: translate(
                  "ui.editorWorkspace.asset.editor.layerActions",
                  { layer: layer.name },
                ),
                actions: [
                  {
                    id: "select",
                    label: translate("common.select"),
                    onAction: select,
                  },
                  {
                    id: "rename",
                    label: translate("common.renameEllipsis"),
                    onAction: rename,
                  },
                  {
                    id: "visibility",
                    label: translate(
                      layer.visible ? "common.hide" : "common.show",
                    ),
                    onAction: toggleVisibility,
                  },
                  {
                    id: "lock",
                    label: translate(
                      layer.locked ? "common.unlock" : "common.lock",
                    ),
                    onAction: toggleLock,
                  },
                  {
                    id: "up",
                    label: translate("common.moveUp"),
                    disabled: index === draft.layers.length - 1,
                    onAction: () => move(1),
                  },
                  {
                    id: "down",
                    label: translate("common.moveDown"),
                    disabled: index === 0,
                    onAction: () => move(-1),
                  },
                  {
                    id: "duplicate",
                    label: translate("common.duplicate"),
                    onAction: duplicate,
                  },
                  {
                    id: "delete",
                    label: translate("common.delete"),
                    danger: true,
                    separatorBefore: true,
                    onAction: remove,
                  },
                ],
              };
              return (
                <li
                  key={layer.id}
                  className={
                    layer.id === draft.selectedLayerId
                      ? "is-selected"
                      : undefined
                  }
                  onContextMenu={(event) => openContextMenu(event, menu)}
                >
                  {renamingLayerId === layer.id ? (
                    <input
                      className="asset-raster-layer-name-input"
                      aria-label={translate(
                        "ui.editorWorkspace.asset.editor.renameLayer",
                        { layer: layer.name },
                      )}
                      value={renamingLayerValue}
                      autoFocus
                      onChange={(event) =>
                        setRenamingLayerValue(event.target.value)
                      }
                      onBlur={finishLayerRename}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          finishLayerRename();
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          setRenamingLayerId(null);
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      aria-haspopup="menu"
                      onKeyDown={(event) =>
                        openContextMenuFromKeyboard(event, menu)
                      }
                      onClick={select}
                      onDoubleClick={rename}
                    >
                      <span>{layer.name}</span>
                      <small>{layer.kind}</small>
                    </button>
                  )}
                  <button
                    type="button"
                    {...tooltipEvents(
                      translate(
                        layer.visible
                          ? "ui.editorWorkspace.asset.editor.hideLayer"
                          : "ui.editorWorkspace.asset.editor.showLayer",
                        { layer: layer.name },
                      ),
                    )}
                    aria-label={translate(
                      layer.visible
                        ? "ui.editorWorkspace.asset.editor.hideLayer"
                        : "ui.editorWorkspace.asset.editor.showLayer",
                      { layer: layer.name },
                    )}
                    onClick={toggleVisibility}
                  >
                    {layer.visible ? "◉" : "○"}
                  </button>
                  <button
                    type="button"
                    {...tooltipEvents(
                      translate(
                        layer.locked
                          ? "ui.editorWorkspace.asset.editor.unlockLayer"
                          : "ui.editorWorkspace.asset.editor.lockLayer",
                        { layer: layer.name },
                      ),
                    )}
                    aria-label={translate(
                      layer.locked
                        ? "ui.editorWorkspace.asset.editor.unlockLayer"
                        : "ui.editorWorkspace.asset.editor.lockLayer",
                      { layer: layer.name },
                    )}
                    onClick={toggleLock}
                  >
                    {layer.locked ? "▣" : "▢"}
                  </button>
                  <button
                    type="button"
                    {...tooltipEvents(
                      translate("ui.editorWorkspace.asset.editor.moveLayerUp", {
                        layer: layer.name,
                      }),
                    )}
                    aria-label={translate(
                      "ui.editorWorkspace.asset.editor.moveLayerUp",
                      { layer: layer.name },
                    )}
                    disabled={index === draft.layers.length - 1}
                    onClick={() => move(1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    {...tooltipEvents(
                      translate(
                        "ui.editorWorkspace.asset.editor.moveLayerDown",
                        { layer: layer.name },
                      ),
                    )}
                    aria-label={translate(
                      "ui.editorWorkspace.asset.editor.moveLayerDown",
                      { layer: layer.name },
                    )}
                    disabled={index === 0}
                    onClick={() => move(-1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    {...tooltipEvents(
                      translate(
                        "ui.editorWorkspace.asset.editor.duplicateLayer",
                        { layer: layer.name },
                      ),
                    )}
                    aria-label={translate(
                      "ui.editorWorkspace.asset.editor.duplicateLayer",
                      { layer: layer.name },
                    )}
                    onClick={duplicate}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    {...tooltipEvents(
                      translate("ui.editorWorkspace.asset.editor.deleteLayer", {
                        layer: layer.name,
                      }),
                    )}
                    aria-label={translate(
                      "ui.editorWorkspace.asset.editor.deleteLayer",
                      { layer: layer.name },
                    )}
                    onClick={remove}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      <div
        className={`asset-raster-status${error ? " is-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {rendering
          ? translate("ui.editorWorkspace.asset.editor.renderingFullResolution")
          : error
            ? error
            : translate("ui.editorWorkspace.asset.editor.renderStatus", {
                width: draft.transform.outputWidth,
                height: draft.transform.outputHeight,
                count: draft.layers.length,
              })}
      </div>
      {tooltip && (
        <div
          className="asset-raster-hover-tooltip"
          role="tooltip"
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          <span>{tooltip.label}</span>
          {tooltip.shortcut && <kbd>{tooltip.shortcut}</kbd>}
        </div>
      )}
    </div>
  );
}
