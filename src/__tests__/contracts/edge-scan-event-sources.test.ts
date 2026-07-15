/**
 * Contract test — Edge Function `scan-event-sources`.
 * Pula automaticamente se VITE_SUPABASE_URL não estiver setado.
 */
import { describe, it, expect } from "vitest";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? (import.meta as any).env?.VITE_SUPABASE_URL ?? "";
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/scan-event-sources` : "";

describe.skipIf(!SUPABASE_URL)("Contract: scan-event-sources", () => {
  it("OPTIONS retorna CORS preflight válido", async () => {
    const res = await fetch(FN_URL, { method: "OPTIONS" });
    await res.text();
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
    const allowedHeaders = res.headers.get("access-control-allow-headers") ?? "";
    expect(allowedHeaders.toLowerCase()).toContain("x-cron-secret");
  });

  it("Sem auth e sem cron-secret → 401 com JSON de erro", async () => {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("Anon-key (não-admin) → guard rejeita (401 ou 403)", async () => {
    if (!ANON_KEY) return;
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: "{}",
    });
    const body = await res.json().catch(() => ({}));
    expect([401, 403]).toContain(res.status);
    expect(body).toHaveProperty("error");
  });

  it("x-cron-secret inválido → não bypassa auth", async () => {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": "obviously-invalid-secret-xyz",
        "x-cron-job": "scan-event-sources-cron",
      },
      body: "{}",
    });
    await res.text();
    expect(res.status).toBe(401);
  });
});
