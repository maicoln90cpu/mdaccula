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
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const FUNCTION_TIMEOUT_MS = 15000;
const MAX_REQUESTS_PER_MINUTE = 3;

interface ContactEmailRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

Deno.serve(async (req) => {
  console.log("send-contact-email function called");

  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  try {
    const clientIP = getClientIP(req);

    if (isRateLimited(clientIP, undefined, MAX_REQUESTS_PER_MINUTE)) {
      console.log(`Rate limited: ${clientIP}`);
      return new Response(JSON.stringify({ error: 'Muitas requisições. Tente novamente em 1 minuto.', success: false }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { name, email, subject, message }: ContactEmailRequest = await req.json();
    console.log("Sending contact email from:", email);

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    const adminEmailResponse = await withTimeout(
      resend.emails.send({
        from: "MDAccula <onboarding@resend.dev>",
        to: ["contato@mdaccula.com"],
        replyTo: email,
        subject: `[Contato MDAccula] ${safeSubject}`,
        html: `
          <h2>Nova mensagem de contato</h2>
          <p><strong>Nome:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Assunto:</strong> ${safeSubject}</p>
          <p><strong>Mensagem:</strong></p>
          <p>${safeMessage.replace(/\n/g, '<br>')}</p>
        `,
      }),
      FUNCTION_TIMEOUT_MS
    );

    console.log("Admin email sent:", adminEmailResponse);

    const userEmailResponse = await withTimeout(
      resend.emails.send({
        from: "MDAccula <onboarding@resend.dev>",
        to: [email],
        subject: "Recebemos sua mensagem! - MDAccula",
        html: `
          <h1>Obrigado por entrar em contato, ${safeName}!</h1>
          <p>Recebemos sua mensagem e entraremos em contato em breve.</p>
          <p><strong>Resumo da sua mensagem:</strong></p>
          <p><strong>Assunto:</strong> ${safeSubject}</p>
          <p><strong>Mensagem:</strong></p>
          <p>${safeMessage.replace(/\n/g, '<br>')}</p>
          <br>
          <p>Atenciosamente,<br>Equipe MDAccula</p>
        `,
      }),
      FUNCTION_TIMEOUT_MS
    );

    console.log("User confirmation email sent:", userEmailResponse);

    return jsonSuccess({
      success: true,
      adminEmailId: adminEmailResponse.id || null,
      userEmailId: userEmailResponse.id || null,
    });
  } catch (error) {
    return handleError(error, 'send-contact-email');
  }
});
