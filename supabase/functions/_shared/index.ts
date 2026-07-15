import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-cron-job",
};

export function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

export function jsonSuccess(
  data: Record<string, unknown> = { success: true },
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function badRequestResponse(message: string): Response {
  return jsonError(message, 400);
}

export function rateLimitResponse(): Response {
  return jsonError("Muitas requisições. Tente novamente em instantes.", 429);
}

export function handleError(error: unknown, functionName: string): Response {
  console.error(`Error in ${functionName}:`, error);
  const message = error instanceof Error ? error.message : "Unknown error";
  return jsonError(message, 500);
}

export async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  label = "operation",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

const rateLimitBuckets = new Map<string, number[]>();

export function isRateLimited(
  key: string,
  scope: string,
  limit = 20,
  windowMs = 60_000,
): boolean {
  const bucketKey = `${scope}:${key}`;
  const now = Date.now();
  const timestamps = (rateLimitBuckets.get(bucketKey) ?? []).filter(
    (t) => now - t < windowMs,
  );
  if (timestamps.length >= limit) {
    rateLimitBuckets.set(bucketKey, timestamps);
    return true;
  }
  timestamps.push(now);
  rateLimitBuckets.set(bucketKey, timestamps);
  return false;
}

export async function scrapeWithFirecrawl(
  url: string,
  apiKey: string,
  timeoutMs = 10000,
): Promise<{ success: boolean; markdown?: string; error?: string }> {
  try {
    const response = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: 1500,
        }),
      },
      timeoutMs,
    );

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    if (data.success && data.data?.markdown) {
      return { success: true, markdown: data.data.markdown };
    }
    return { success: false, error: "No markdown content returned" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "Timeout" };
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function authorizeAdminOrCron(
  req: Request,
  admin: SupabaseClient,
  opts: { anonKey: string; cronSecretRowName: string; cronJobHeaderValue: string },
): Promise<{ authorized: boolean; status: number; message?: string }> {
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const cronJobHeader = req.headers.get("x-cron-job");

  if (cronSecretHeader && cronJobHeader === opts.cronJobHeaderValue) {
    const { data: row } = await admin
      .from("internal_cron_secrets")
      .select("secret")
      .eq("name", opts.cronSecretRowName)
      .maybeSingle();
    if (row?.secret && row.secret === cronSecretHeader) {
      return { authorized: true, status: 200 };
    }
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { authorized: false, status: 401, message: "Não autenticado" };

  const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, opts.anonKey);
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData.user) return { authorized: false, status: 401, message: "Token inválido" };

  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!isAdmin) return { authorized: false, status: 403, message: "Apenas admins" };

  return { authorized: true, status: 200 };
}
