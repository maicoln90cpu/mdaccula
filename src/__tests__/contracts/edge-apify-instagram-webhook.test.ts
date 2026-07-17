/**
 * Contract test — Edge Function `apify-instagram-webhook`.
 * Pula automaticamente se VITE_SUPABASE_URL não estiver setado.
 */
import { describe, it, expect } from "vitest";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? (import.meta as any).env?.VITE_SUPABASE_URL ?? "";
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/apify-instagram-webhook` : "";

describe.skipIf(!SUPABASE_URL)("Contract: apify-instagram-webhook", () => {
  it("OPTIONS retorna CORS preflight válido", async () => {
    const res = await fetch(FN_URL, { method: "OPTIONS" });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
  });

  it("sem secret na query string → 401 com JSON de erro", async () => {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("secret inválido → 401, mesmo com source_id presente", async () => {
    const res = await fetch(
      `${FN_URL}?source_id=00000000-0000-0000-0000-000000000000&secret=obviamente-invalido`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );
    const body = await res.json().catch(() => ({}));
    expect(res.status).toBe(401);
    expect(body).toHaveProperty("error");
  });
});
