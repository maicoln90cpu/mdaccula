/**
 * Monta o request de envio de e-mail via Resend direto (api.resend.com),
 * mesmo padrão usado com sucesso em send-test-email/daily-metrics-email.
 * Extraído pra ser testável sem precisar mockar Deno.serve: os 3 disparos
 * de egress_alerts (28/07, 07/08, 09/08/2026) falharam sempre com 401
 * "Credential not found" porque o código anterior chamava
 * connector-gateway.lovable.dev/resend/emails com um LOVABLE_API_KEY extra
 * que nunca teve credencial associada — endpoint que nenhuma outra função
 * do projeto usa.
 */
export interface ResendEmailRequest {
  url: string;
  headers: Record<string, string>;
  body: { from: string; to: string[]; subject: string; html: string };
}

export function buildResendEmailRequest(params: {
  resendApiKey: string;
  toEmail: string;
  subject: string;
  html: string;
}): ResendEmailRequest {
  return {
    url: "https://api.resend.com/emails",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.resendApiKey}`,
    },
    body: {
      from: "MDACCULA Alertas <onboarding@resend.dev>",
      to: [params.toEmail],
      subject: params.subject,
      html: params.html,
    },
  };
}
