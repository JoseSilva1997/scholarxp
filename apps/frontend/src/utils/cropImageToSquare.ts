// Client-side square crop + resize for profile pictures so we upload tightly bounded blobs and avoid
// pushing source-resolution images straight to storage.
const TARGET_SIZE = 512;
const OUTPUT_QUALITY = 0.92;

// Produces a centered square image blob suitable for profile-picture upload.
export async function cropImageToSquare(file: File): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  try {
    // Centre-cropping preserves the most likely subject area while enforcing the avatar aspect ratio.
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = Math.floor((bitmap.width - side) / 2);
    const sy = Math.floor((bitmap.height - side) / 2);
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to get 2d canvas context');
    }
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);
    return await canvasToBlob(canvas, file.type);
  } finally {
    // ImageBitmap instances hold browser resources that should be released after the canvas draw.
    if ('close' in bitmap) {
      (bitmap as ImageBitmap).close();
    }
  }
}

// Loads an image into a drawable browser object, using the native decoder when available.
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(file);
  }
  // Safari fallback path: hydrate via object URL.
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Converts the processed canvas into the storage payload consumed by the profile upload flow.
function canvasToBlob(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  // Re-emit as the source MIME when supported so JPEG stays JPEG (smaller) and PNG stays PNG (lossless).
  const outputMime =
    mime === 'image/jpeg' || mime === 'image/webp' ? mime : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas export returned null'));
          return;
        }
        resolve(blob);
      },
      outputMime,
      OUTPUT_QUALITY,
    );
  });
}
