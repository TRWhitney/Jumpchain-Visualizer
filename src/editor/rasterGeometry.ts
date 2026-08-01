import type { RasterStroke } from "./assetEditorModel";

export const translateStrokes = (
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

export const transformStrokes = (
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
