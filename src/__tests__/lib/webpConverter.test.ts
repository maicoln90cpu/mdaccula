import { describe, it, expect, vi } from "vitest";

// Mock browser-image-compression antes de importar webpConverter
vi.mock("browser-image-compression", () => ({
  default: vi.fn(async (file: File) => {
    // Devolve um blob "comprimido" pequeno
    return new Blob([new Uint8Array(100)], { type: "image/webp" });
  }),
}));

import imageCompression from "browser-image-compression";
import { convertToWebP, convertToWebPWithPreview, convertToWebPWithThumb } from "@/lib/webpConverter";

const makeFile = (sizeMB: number) =>
  new File([new Uint8Array(sizeMB * 1024 * 1024)], "in.png", {
    type: "image/png",
  });

describe("webpConverter", () => {
  it("converte para WebP retornando File", async () => {
    const out = await convertToWebP(makeFile(1));
    expect(out.type).toBe("image/webp");
    expect(out.name).toMatch(/\.webp$/);
  });

  it("rejeita arquivos > 5MB", async () => {
    await expect(convertToWebP(makeFile(6))).rejects.toThrow(/muito grande/i);
  });

  it("convertToWebPWithPreview retorna metadata de economia", async () => {
    const result = await convertToWebPWithPreview(makeFile(1));
    expect(result.compressedSize).toBeLessThan(result.originalSize);
    expect(result.savedPercent).toBeGreaterThan(0);
  });

  it("convertToWebPWithThumb retorna full e thumb, cada um com seu próprio alvo de tamanho", async () => {
    vi.mocked(imageCompression).mockClear();

    const { full, thumb } = await convertToWebPWithThumb(makeFile(1));

    expect(full.type).toBe("image/webp");
    expect(thumb.type).toBe("image/webp");

    const calls = vi.mocked(imageCompression).mock.calls;
    expect(calls).toHaveLength(2);
    const maxDims = calls.map((c) => (c[1] as { maxWidthOrHeight: number }).maxWidthOrHeight);
    expect(maxDims).toContain(1920); // full default
    expect(maxDims).toContain(400); // thumb default
    expect(Math.min(...maxDims)).toBeLessThan(Math.max(...maxDims));
  });

  it("convertToWebPWithThumb aceita overrides de tamanho pra full e thumb", async () => {
    vi.mocked(imageCompression).mockClear();

    await convertToWebPWithThumb(
      makeFile(1),
      { maxDimension: 1200 },
      { maxDimension: 320 }
    );

    const calls = vi.mocked(imageCompression).mock.calls;
    const maxDims = calls.map((c) => (c[1] as { maxWidthOrHeight: number }).maxWidthOrHeight);
    expect(maxDims).toContain(1200);
    expect(maxDims).toContain(320);
  });
});
