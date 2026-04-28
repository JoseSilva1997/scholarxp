// Verifies profile image cropping handles canvas export, MIME fallback, and cleanup paths.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cropImageToSquare } from '@/utils/cropImageToSquare';

describe('cropImageToSquare', () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalCreateImageBitmap) {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    } else {
      delete (globalThis as Partial<typeof globalThis>).createImageBitmap;
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('center-crops the shortest side and exports using supported source MIME types', async () => {
    const close = vi.fn();
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({
      width: 800,
      height: 600,
      close,
    });
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: BlobCallback, mime: string, quality?: number) => {
      callback(new Blob(['cropped'], { type: mime }));
      expect(quality).toBe(0.92);
    });
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage }),
          toBlob,
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });

    const blob = await cropImageToSquare(new File(['avatar'], 'avatar.webp', { type: 'image/webp' }));

    expect(blob.type).toBe('image/webp');
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(Object),
      100,
      0,
      600,
      600,
      0,
      0,
      512,
      512,
    );
    expect(close).toHaveBeenCalledTimes(1);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.92);
  });

  it('falls back to PNG when the source MIME is unsupported', async () => {
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({ width: 200, height: 400 });
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (callback: BlobCallback, mime: string) => {
            callback(new Blob(['cropped'], { type: mime }));
          },
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });

    const blob = await cropImageToSquare(new File(['avatar'], 'avatar.gif', { type: 'image/gif' }));

    expect(blob.type).toBe('image/png');
  });

  it('throws when a canvas context cannot be created', async () => {
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({ width: 200, height: 200 });
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => null,
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });

    await expect(
      cropImageToSquare(new File(['avatar'], 'avatar.png', { type: 'image/png' })),
    ).rejects.toThrow('Unable to get 2d canvas context');
  });

  it('loads images through the Safari object URL fallback', async () => {
    delete (globalThis as Partial<typeof globalThis>).createImageBitmap;
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    class TestImage {
      width = 300;
      height = 200;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal('Image', TestImage);
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (callback: BlobCallback, mime: string) => {
            callback(new Blob(['cropped'], { type: mime }));
          },
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });

    const blob = await cropImageToSquare(new File(['avatar'], 'avatar.jpeg', { type: 'image/jpeg' }));

    expect(blob.type).toBe('image/jpeg');
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('rejects when canvas export returns null', async () => {
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({ width: 200, height: 200 });
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (callback: BlobCallback) => {
            callback(null);
          },
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });

    await expect(
      cropImageToSquare(new File(['avatar'], 'avatar.png', { type: 'image/png' })),
    ).rejects.toThrow('Canvas export returned null');
  });
});
