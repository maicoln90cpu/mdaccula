import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { notifyAutoPublish } from "./autoPublishAlert.ts";

Deno.test("notifyAutoPublish não lança e não envia nada quando RESEND_API_KEY está ausente", async () => {
  Deno.env.delete("RESEND_API_KEY");
  const supabase = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
    // deno-lint-ignore no-explicit-any
  } as any;
  await notifyAutoPublish(supabase, { postId: "1", title: "Teste", source: "auto_cron" });
});

Deno.test("notifyAutoPublish não envia quando auto_publish_alert_email está vazio", async () => {
  Deno.env.set("RESEND_API_KEY", "fake-key");
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    fetchCalled = true;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
  }) as typeof fetch;
  // deno-lint-ignore no-explicit-any
  const supabase: any = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: "" } }) }) }) }),
  };
  await notifyAutoPublish(supabase, { postId: "1", title: "Teste", source: "auto_cron" });
  globalThis.fetch = originalFetch;
  assertEquals(fetchCalled, false);
});

Deno.test("notifyAutoPublish envia via api.resend.com quando tudo configurado", async () => {
  Deno.env.set("RESEND_API_KEY", "fake-key");
  let requestedUrl: string | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((url: string | URL) => {
    requestedUrl = url.toString();
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "abc" }) } as Response);
  }) as typeof fetch;
  // deno-lint-ignore no-explicit-any
  const supabase: any = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: "contato@mdaccula.com" } }) }) }),
    }),
  };
  await notifyAutoPublish(supabase, { postId: "abc-123", title: "Artigo real", source: "event_watcher" });
  globalThis.fetch = originalFetch;
  assertEquals(requestedUrl, "https://api.resend.com/emails");
});

Deno.test("notifyAutoPublish nunca lança mesmo se o fetch falhar", async () => {
  Deno.env.set("RESEND_API_KEY", "fake-key");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error("network down"))) as typeof fetch;
  // deno-lint-ignore no-explicit-any
  const supabase: any = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { value: "contato@mdaccula.com" } }) }) }),
    }),
  };
  await notifyAutoPublish(supabase, { postId: "1", title: "Teste", source: "auto_cron" });
  globalThis.fetch = originalFetch;
});
