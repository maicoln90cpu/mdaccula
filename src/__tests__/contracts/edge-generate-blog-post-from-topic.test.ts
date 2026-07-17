/**
 * Contract test — Edge Function `generate-blog-post-from-topic`.
 * Pula automaticamente se VITE_SUPABASE_URL não estiver setado.
 */
import { describe, it, expect } from "vitest";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? (import.meta as any).env?.VITE_SUPABASE_URL ?? "";
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/generate-blog-post-from-topic` : "";

describe.skipIf(!SUPABASE_URL)("Contract: generate-blog-post-from-topic", () => {
  it("OPTIONS retorna CORS preflight válido", async () => {
    const res = await fetch(FN_URL, { method: "OPTIONS" });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
  });

  it("query vazio → 400 com JSON de erro", async () => {
    if (!ANON_KEY) return;
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ query: "" }),
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("query ausente do body → 400 com JSON de erro", async () => {
    if (!ANON_KEY) return;
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
  });
});
