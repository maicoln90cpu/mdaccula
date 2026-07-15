
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
