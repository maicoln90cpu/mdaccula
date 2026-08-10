/**
 * Item #3 (reorganização dos controles de publicação, 10/08/2026): aviso por
 * e-mail toda vez que um artigo vai ao ar SEM revisão humana. Só faz
 * sentido pros 2 caminhos 100% desacompanhados (auto-article-cron e Event
 * Watcher) — não pros manuais, onde o próprio admin clicou "Gerar" e já
 * está vendo o resultado na hora.
 *
 * Nunca pode quebrar a geração em si: qualquer falha (RESEND_API_KEY
 * ausente, e-mail não configurado, erro de rede) só loga e segue.
 */
import { buildResendEmailRequest } from "./resendEmail.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

export interface AutoPublishAlertParams {
  postId: string;
  title: string;
  source: "auto_cron" | "event_watcher";
  sourceName?: string | null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SOURCE_LABELS: Record<string, string> = {
  auto_cron: "Automático (cron)",
  event_watcher: "Event Watcher",
};

/** Nunca lança — falha de e-mail não pode derrubar a geração que a disparou. */
export async function notifyAutoPublish(supabase: Supabase, params: AutoPublishAlertParams): Promise<void> {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.warn("[autoPublishAlert] RESEND_API_KEY ausente — aviso de publicação automática não enviado.");
      return;
    }

    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "auto_publish_alert_email")
      .maybeSingle();
    const toEmail = (data?.value || "").trim();
    if (!toEmail) return;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const siteUrl = supabaseUrl ? "https://mdaccula.com" : "";
    const editUrl = siteUrl ? `${siteUrl}/admin/blog?edit=${params.postId}` : "";

    const html = `
      <div style="font-family: sans-serif; background:#0a0a0a; color:#e5e5e5; padding:24px;">
        <h2 style="color:#a78bfa;">Artigo publicado automaticamente, sem revisão</h2>
        <p><strong>${escapeHtml(params.title)}</strong></p>
        <p>Origem: ${SOURCE_LABELS[params.source] ?? params.source}${params.sourceName ? ` — ${escapeHtml(params.sourceName)}` : ""}</p>
        ${editUrl ? `<p><a href="${editUrl}" style="color:#a78bfa;">Ver/editar o post</a></p>` : ""}
        <p style="color:#888; font-size:12px;">Pra parar de publicar sozinho, desligue o toggle correspondente na aba "Automático" de Conteúdo IA.</p>
      </div>
    `.trim();

    const request = buildResendEmailRequest({
      resendApiKey,
      toEmail,
      subject: `[MDACCULA] Publicado sem revisão: ${params.title}`,
      html,
    });

    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
    });

    if (!response.ok) {
      console.error(`[autoPublishAlert] Falha ao enviar (HTTP ${response.status}):`, await response.text());
    }
  } catch (error) {
    console.error("[autoPublishAlert] Erro inesperado (não afeta a geração):", error);
  }
}
