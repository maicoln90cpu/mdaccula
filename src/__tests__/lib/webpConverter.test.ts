import { describe, it, expect, vi } from "vitest";

// Mock browser-image-compression antes de importar webpConverter
vi.mock("browser-image-compression", () => ({
  default: vi.fn(async (file: File) => {
    // Devolve um blob "comprimido" pequeno
    return new Blob([new Uint8Array(100)], { type: "image/webp" });
  }),
}));

import { convertToWebP, convertToWebPWithPreview } from "@/lib/webpConverter";

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
});
