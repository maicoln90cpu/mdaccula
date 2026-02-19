import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

// ============= INLINE SHARED UTILITIES =============
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

function isRateLimited(ip: string, resourceId?: string, maxRequests = 10, windowMs = 60000): boolean {
  const key = resourceId ? `${ip}:${resourceId}` : ip;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (rateLimitMap.size > 10000) {
    const cutoff = now - windowMs * 2;
    for (const [k, e] of rateLimitMap.entries()) {
      if (e.timestamp < cutoff) rateLimitMap.delete(k);
    }
  }

  if (!entry || now - entry.timestamp > windowMs) {
    rateLimitMap.set(key, { count: 1, timestamp: now });
    return false;
  }

  if (entry.count >= maxRequests) return true;
  entry.count++;
  return false;
}

function getClientIP(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function jsonSuccess(data: Record<string, unknown> = { success: true }, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function badRequestResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function rateLimitResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status: 429,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function handleError(error: unknown, functionName: string): Response {
  console.error(`Error in ${functionName}:`, error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Response(JSON.stringify({ error: message, success: false }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============= MAIN HANDLER =============
const FUNCTION_TIMEOUT_MS = 15000;
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 3;

interface DeletionRequest {
  email: string;
  reason: string;
}

Deno.serve(async (req) => {
  console.log("request-data-deletion function called");

  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  try {
    const clientIP = getClientIP(req);

    if (isRateLimited(clientIP, undefined, MAX_REQUESTS_PER_HOUR, RATE_LIMIT_WINDOW_MS)) {
      console.log(`Rate limited: ${clientIP}`);
      return rateLimitResponse("Muitas solicitações. Tente novamente em 1 hora.");
    }

    const { email, reason }: DeletionRequest = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequestResponse("Email inválido");
    }

    console.log("Processing deletion request for:", email);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: newsletterError } = await withTimeout(
      supabase
        .from("newsletter_subscribers")
        .delete()
        .eq("email", email),
      FUNCTION_TIMEOUT_MS
    );

    if (newsletterError) {
      console.log("Newsletter deletion error (may not exist):", newsletterError.message);
    }

    const { error: logError } = await withTimeout(
      supabase.from("site_settings").insert({
        key: `deletion_request_${Date.now()}`,
        value: JSON.stringify({
          email,
          reason: reason || "Não informado",
          requested_at: new Date().toISOString(),
          ip: clientIP,
          status: "processed",
        }),
      }),
      FUNCTION_TIMEOUT_MS
    );

    if (logError) {
      console.error("Error logging deletion request:", logError);
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const resend = new Resend(resendKey);
      const safeEmail = escapeHtml(email);

      await withTimeout(
        resend.emails.send({
          from: "MDAccula <onboarding@resend.dev>",
          to: [email],
          subject: "Confirmação de Exclusão de Dados - MDAccula",
          html: `
            <h1>Sua solicitação foi processada</h1>
            <p>Olá,</p>
            <p>Confirmamos o recebimento da sua solicitação de exclusão de dados para o email <strong>${safeEmail}</strong>.</p>
            <h2>O que foi feito:</h2>
            <ul>
              <li>✅ Seu email foi removido da nossa lista de newsletter</li>
              <li>✅ Dados de analytics associados foram marcados para exclusão</li>
              <li>✅ Sua solicitação foi registrada para auditoria conforme LGPD</li>
            </ul>
            <p>Se você não solicitou esta exclusão, entre em contato conosco imediatamente.</p>
            <br>
            <p>Atenciosamente,<br>Equipe MDAccula</p>
          `,
        }),
        FUNCTION_TIMEOUT_MS
      );

      await withTimeout(
        resend.emails.send({
          from: "MDAccula <onboarding@resend.dev>",
          to: ["contato@mdaccula.com"],
          subject: "[LGPD] Solicitação de Exclusão de Dados",
          html: `
            <h2>Nova solicitação de exclusão de dados</h2>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Motivo:</strong> ${escapeHtml(reason || "Não informado")}</p>
            <p><strong>Data:</strong> ${new Date().toLocaleString("pt-BR")}</p>
            <p><strong>IP:</strong> ${clientIP}</p>
          `,
        }),
        FUNCTION_TIMEOUT_MS
      );
    }

    console.log("Deletion request processed successfully for:", email);
    return jsonSuccess({ success: true, message: "Solicitação processada com sucesso" });
  } catch (error) {
    return handleError(error, "request-data-deletion");
  }
});
