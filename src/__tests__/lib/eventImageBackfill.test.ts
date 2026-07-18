import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

const convertToWebPMock = vi.fn(async (_file: unknown, _maxSizeMB: number, maxDimension: number) =>
  new File([new Uint8Array(10)], `v-${maxDimension}.webp`, { type: "image/webp" })
);
vi.mock("@/lib/webpConverter", () => ({
  convertToWebP: (...args: Parameters<typeof convertToWebPMock>) => convertToWebPMock(...args),
}));

const uploadImageToBunnyMock = vi.fn(async () => "https://mdaccula.b-cdn.net/event-images/abc123-thumb.webp");
vi.mock("@/lib/bunnyUploader", () => ({
  uploadImageToBunny: (...args: Parameters<typeof uploadImageToBunnyMock>) => uploadImageToBunnyMock(...args),
}));

import {
  getActiveEventImageUrls,
  backfillVariantsForUrl,
  runEventImageBackfill,
} from "@/lib/eventImageBackfill";

function mockFromForTables(eventsData: { image_url: string | null }[], configsData: { image_url: string | null }[]) {
  fromMock.mockImplementation((table: string) => {
    if (table === "events") {
      return {
        select: () => ({
          not: () => ({
            or: () => Promise.resolve({ data: eventsData, error: null }),
          }),
        }),
      };
    }
    if (table === "recurring_event_configs") {
      return {
        select: () => ({
          not: () => Promise.resolve({ data: configsData, error: null }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
}

describe("getActiveEventImageUrls", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("junta e deduplica URLs de eventos futuros e configs recorrentes", async () => {
    mockFromForTables(
      [
        { image_url: "https://mdaccula.b-cdn.net/event-images/a.webp" },
        { image_url: "https://mdaccula.b-cdn.net/event-images/b.webp" },
      ],
      [{ image_url: "https://mdaccula.b-cdn.net/event-images/a.webp" }] // mesma do evento -> não duplica
    );

    const urls = await getActiveEventImageUrls();
    expect(urls.sort()).toEqual([
      "https://mdaccula.b-cdn.net/event-images/a.webp",
      "https://mdaccula.b-cdn.net/event-images/b.webp",
    ]);
  });

  it("propaga erro do Supabase", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "events") {
        return { select: () => ({ not: () => ({ or: () => Promise.resolve({ data: null, error: new Error("boom") }) }) }) };
      }
      return { select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) };
    });
    await expect(getActiveEventImageUrls()).rejects.toThrow("boom");
  });
});

describe("backfillVariantsForUrl", () => {
  const url = "https://mdaccula.b-cdn.net/event-images/foo.webp";

  beforeEach(() => {
    convertToWebPMock.mockClear();
    uploadImageToBunnyMock.mockClear();
  });

  it("URL fora do padrão Bunny retorna 'unsupported' sem chamar fetch", async () => {
    global.fetch = vi.fn();
    const result = await backfillVariantsForUrl("https://example.com/x.png");
    expect(result.status).toBe("unsupported");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("quando as duas variantes já existem, retorna 'skipped' e não baixa nem sobe nada", async () => {
    global.fetch = vi.fn(async () => ({ ok: true }) as Response);

    const result = await backfillVariantsForUrl(url);

    expect(result.status).toBe("skipped");
    expect(uploadImageToBunnyMock).not.toHaveBeenCalled();
  });

  it("quando nenhuma variante existe, baixa a original e sobe thumb+medium", async () => {
    global.fetch = vi.fn(async (_url: string, opts?: RequestInit) => {
      if (opts?.method === "HEAD") return { ok: false } as Response;
      return { ok: true, blob: async () => new Blob([new Uint8Array(10)]) } as unknown as Response;
    });

    const result = await backfillVariantsForUrl(url);

    expect(result.status).toBe("uploaded");
    expect(uploadImageToBunnyMock).toHaveBeenCalledTimes(2);
    const variants = uploadImageToBunnyMock.mock.calls.map((c) => (c[2] as { variant: string }).variant).sort();
    expect(variants).toEqual(["medium", "thumb"]);
    // baseName consistente entre as duas variantes, extraído da URL original
    const baseNames = uploadImageToBunnyMock.mock.calls.map((c) => (c[2] as { baseName: string }).baseName);
    expect(new Set(baseNames).size).toBe(1);
    expect(baseNames[0]).toBe("foo");
  });

  it("sobe só a variante faltante quando uma já existe", async () => {
    global.fetch = vi.fn(async (u: string, opts?: RequestInit) => {
      if (opts?.method === "HEAD") {
        return { ok: u.includes("-thumb.") } as Response; // thumb existe, medium não
      }
      return { ok: true, blob: async () => new Blob([new Uint8Array(10)]) } as unknown as Response;
    });

    const result = await backfillVariantsForUrl(url);

    expect(result.status).toBe("uploaded");
    expect(uploadImageToBunnyMock).toHaveBeenCalledTimes(1);
    expect((uploadImageToBunnyMock.mock.calls[0][2] as { variant: string }).variant).toBe("medium");
  });

  it("retorna 'error' quando o download da imagem original falha", async () => {
    global.fetch = vi.fn(async (_url: string, opts?: RequestInit) => {
      if (opts?.method === "HEAD") return { ok: false } as Response;
      return { ok: false, status: 404 } as Response;
    });

    const result = await backfillVariantsForUrl(url);
    expect(result.status).toBe("error");
    expect(result.detail).toMatch(/404/);
  });
});

describe("runEventImageBackfill", () => {
  beforeEach(() => {
    fromMock.mockReset();
    convertToWebPMock.mockClear();
    uploadImageToBunnyMock.mockClear();
  });

  it("processa cada URL candidata e reporta progresso", async () => {
    mockFromForTables(
      [{ image_url: "https://mdaccula.b-cdn.net/event-images/a.webp" }],
      [{ image_url: "https://mdaccula.b-cdn.net/event-images/b.webp" }]
    );
    global.fetch = vi.fn(async () => ({ ok: true }) as Response); // variantes já existem -> skipped pros dois

    const progressCalls: Array<[number, number]> = [];
    const results = await runEventImageBackfill((done, total) => progressCalls.push([done, total]));

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === "skipped")).toBe(true);
    expect(progressCalls).toEqual([[1, 2], [2, 2]]);
  });
});
