import type {
  RasterAssetEditorDocument,
  RasterLayer,
} from "./assetEditorModel";

export function updateRasterLayer(
  document: RasterAssetEditorDocument,
  id: string,
  update: (layer: RasterLayer) => RasterLayer,
) {
  return {
    ...document,
    layers: document.layers.map((layer) =>
      layer.id === id ? update(layer) : layer,
    ),
    selectedLayerId: id,
  };
}

export function renameRasterLayer(
  document: RasterAssetEditorDocument,
  id: string,
  name: string,
) {
  return {
    ...document,
    layers: document.layers.map((layer) =>
      layer.id === id ? { ...layer, name } : layer,
    ),
  };
}

export function reorderRasterLayer(
  document: RasterAssetEditorDocument,
  id: string,
  direction: -1 | 1,
) {
  const index = document.layers.findIndex((layer) => layer.id === id);
  const layers = [...document.layers];
  [layers[index], layers[index + direction]] = [
    layers[index + direction],
    layers[index],
  ];
  return { ...document, layers, selectedLayerId: id };
}

export function duplicateRasterLayer(
  document: RasterAssetEditorDocument,
  id: string,
  copyId: string,
) {
  const index = document.layers.findIndex((layer) => layer.id === id);
  const copy = structuredClone(document.layers[index]);
  copy.id = copyId;
  copy.name = `${copy.name} copy`;
  return {
    ...document,
    layers: [
      ...document.layers.slice(0, index + 1),
      copy,
      ...document.layers.slice(index + 1),
    ],
    selectedLayerId: copy.id,
  };
}

export function removeRasterLayer(
  document: RasterAssetEditorDocument,
  id: string,
) {
  return {
    ...document,
    layers: document.layers.filter((layer) => layer.id !== id),
    selectedLayerId:
      document.selectedLayerId === id ? null : document.selectedLayerId,
  };
}
