import type { RasterAssetEditorDocument } from "./assetEditorModel";

type RasterCorrections = RasterAssetEditorDocument["corrections"];

const clampByte = (value: number) => Math.max(0, Math.min(255, value));

export function applyRasterCorrections(
  pixels: Uint8ClampedArray,
  corrections: RasterCorrections,
) {
  const exposure = 2 ** (corrections.exposure / 100);
  const contrast =
    (259 * (corrections.contrast + 255)) / (255 * (259 - corrections.contrast));
  const saturation = 1 + corrections.saturation / 100;
  const vibrance = corrections.vibrance / 100;
  const warmth = corrections.temperature * 0.45;
  const tint = corrections.tint * 0.3;
  for (let index = 0; index < pixels.length; index += 4) {
    let red = pixels[index] * exposure;
    let green = pixels[index + 1] * exposure;
    let blue = pixels[index + 2] * exposure;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const tone =
      luminance < 128
        ? corrections.shadows * (1 - luminance / 128) * 0.65
        : corrections.highlights * ((luminance - 128) / 127) * 0.65;
    red += tone;
    green += tone;
    blue += tone;
    red = contrast * (red - 128) + 128;
    green = contrast * (green - 128) + 128;
    blue = contrast * (blue - 128) + 128;
    const average = (red + green + blue) / 3;
    const maximum = Math.max(red, green, blue);
    const adaptiveSaturation =
      saturation + vibrance * (1 - (maximum - average) / 255);
    red = average + (red - average) * adaptiveSaturation + warmth + tint;
    green = average + (green - average) * adaptiveSaturation - tint;
    blue = average + (blue - average) * adaptiveSaturation - warmth + tint;
    pixels[index] = clampByte(red);
    pixels[index + 1] = clampByte(green);
    pixels[index + 2] = clampByte(blue);
  }
  return pixels;
}

export function applyRasterSharpen(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  sharpen: number,
) {
  if (sharpen <= 0 || width < 3 || height < 3) return pixels;
  const source = new Uint8ClampedArray(pixels);
  const amount = (sharpen / 100) * 1.5;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        let neighbors = 0;
        for (let deltaY = -1; deltaY <= 1; deltaY += 1)
          for (let deltaX = -1; deltaX <= 1; deltaX += 1)
            neighbors +=
              source[((y + deltaY) * width + x + deltaX) * 4 + channel];
        const average = neighbors / 9;
        pixels[offset + channel] = clampByte(
          source[offset + channel] +
            (source[offset + channel] - average) * amount,
        );
      }
    }
  }
  return pixels;
}

export function renderCorrectedRasterProxy(
  image: CanvasImageSource,
  width: number,
  height: number,
  corrections: RasterCorrections,
  blurScale: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });
  if (!context) throw new Error("Canvas 2D rendering is unavailable.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  applyRasterCorrections(imageData.data, corrections);
  context.putImageData(imageData, 0, 0);

  if (corrections.blur > 0) {
    const blurred = document.createElement("canvas");
    blurred.width = canvas.width;
    blurred.height = canvas.height;
    const blurredContext = blurred.getContext("2d");
    if (!blurredContext) throw new Error("Canvas 2D rendering is unavailable.");
    blurredContext.filter = `blur(${(corrections.blur / 100) * 8 * blurScale}px)`;
    blurredContext.drawImage(canvas, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(blurred, 0, 0);
  }

  if (corrections.sharpen > 0) {
    const sharpened = context.getImageData(0, 0, canvas.width, canvas.height);
    applyRasterSharpen(
      sharpened.data,
      canvas.width,
      canvas.height,
      corrections.sharpen,
    );
    context.putImageData(sharpened, 0, 0);
  }
  return canvas;
}
