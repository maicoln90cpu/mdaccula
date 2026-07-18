// ============================================
// Edge Function: send-podcast-notification
// Envia emails de confirmação para artistas e notificação para a agência
// ============================================

import { Resend } from "npm:resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

// ============= CORS =============
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= TYPES =============
interface PodcastSubmissionData {
  id: string;
  full_name: string;
  city: string;
  phone: string;
  project_name: string;
  project_age: string;
  genre: string;
  has_original_track: boolean;
  original_track_link?: string;
  instagram?: string;
  spotify?: string;
  soundcloud?: string;
  tiktok?: string;
  email: string;
  project_description: string;
}

// ============= HELPER FUNCTIONS =============
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}

function generateArtistConfirmationEmail(data: PodcastSubmissionData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inscrição Recebida - MDAccula Radio</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #ec4899 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🎧 MDAccula Radio</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Gravação de Set Exclusivo</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #ffffff; font-size: 24px;">
                Olá, ${escapeHtml(data.full_name)}! 🎉
              </h2>
              
              <p style="margin: 0 0 20px; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                Recebemos sua inscrição para gravar um set exclusivo no <strong style="color: #a855f7;">MDAccula Radio</strong>!
              </p>
              
              <div style="background: rgba(139, 92, 246, 0.1); border-left: 4px solid #8b5cf6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #ffffff; font-size: 16px;">
                  <strong>Projeto:</strong> ${escapeHtml(data.project_name)}<br>
                  <strong>Gênero:</strong> ${escapeHtml(data.genre)}<br>
                  <strong>Cidade:</strong> ${escapeHtml(data.city)}
                </p>
              </div>
              
              <p style="margin: 20px 0; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                Nossa equipe irá analisar seu perfil e entraremos em contato em breve com mais informações sobre os próximos passos.
              </p>
              
              <div style="background: rgba(236, 72, 153, 0.1); border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px; color: #ec4899; font-size: 18px;">📋 Próximos Passos</h3>
                <ul style="margin: 0; padding-left: 20px; color: #a0a0a0; line-height: 1.8;">
                  <li>Análise do seu perfil pela nossa equipe</li>
                  <li>Contato via WhatsApp para agendar a gravação</li>
                  <li>Confirmação de data e horário</li>
                  <li>Gravação na Methodus School</li>
                </ul>
              </div>
              
              <p style="margin: 20px 0 0; color: #a0a0a0; font-size: 14px; line-height: 1.6;">
                União, apoio e conexão. Estes são os pilares que fazem parte da essência da MDAccula! 💜
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: rgba(0,0,0,0.3); text-align: center;">
              <p style="margin: 0 0 10px; color: #666666; font-size: 14px;">
                Siga-nos nas redes sociais
              </p>
              <p style="margin: 0; color: #8b5cf6; font-size: 14px;">
                @mdaccula
              </p>
              <p style="margin: 20px 0 0; color: #444444; font-size: 12px;">
                © ${new Date().getFullYear()} MDAccula. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generateAgencyNotificationEmail(data: PodcastSubmissionData): string {
  const socialLinks = [
    data.instagram ? `<strong>Instagram:</strong> ${escapeHtml(data.instagram)}` : null,
    data.spotify ? `<strong>Spotify:</strong> <a href="${escapeHtml(data.spotify)}" style="color: #1db954;">${escapeHtml(data.spotify)}</a>` : null,
    data.soundcloud ? `<strong>SoundCloud:</strong> <a href="${escapeHtml(data.soundcloud)}" style="color: #ff5500;">${escapeHtml(data.soundcloud)}</a>` : null,
    data.tiktok ? `<strong>TikTok:</strong> ${escapeHtml(data.tiktok)}` : null,
  ].filter(Boolean).join('<br>');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nova Inscrição - MDAccula Radio</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">🎙️ Nova Inscrição - Podcast</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px; color: #333333; font-size: 20px; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px;">
                Dados do Artista
              </h2>
              
              <table width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 8px 0; color: #666666; width: 40%;"><strong>Nome:</strong></td>
                  <td style="padding: 8px 0; color: #333333;">${escapeHtml(data.full_name)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666;"><strong>Email:</strong></td>
                  <td style="padding: 8px 0; color: #333333;"><a href="mailto:${escapeHtml(data.email)}" style="color: #8b5cf6;">${escapeHtml(data.email)}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666;"><strong>Telefone:</strong></td>
                  <td style="padding: 8px 0; color: #333333;"><a href="tel:${escapeHtml(data.phone)}" style="color: #8b5cf6;">${escapeHtml(data.phone)}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666;"><strong>Cidade:</strong></td>
                  <td style="padding: 8px 0; color: #333333;">${escapeHtml(data.city)}</td>
                </tr>
              </table>
              
              <h2 style="margin: 20px 0 20px; color: #333333; font-size: 20px; border-bottom: 2px solid #ec4899; padding-bottom: 10px;">
                Dados do Projeto
              </h2>
              
              <table width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 8px 0; color: #666666; width: 40%;"><strong>Projeto:</strong></td>
                  <td style="padding: 8px 0; color: #333333; font-weight: bold;">${escapeHtml(data.project_name)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666;"><strong>Tempo de existência:</strong></td>
                  <td style="padding: 8px 0; color: #333333;">${escapeHtml(data.project_age)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666;"><strong>Gênero/Vertente:</strong></td>
                  <td style="padding: 8px 0; color: #333333;">${escapeHtml(data.genre)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666;"><strong>Track autoral:</strong></td>
                  <td style="padding: 8px 0; color: #333333;">
                    ${data.has_original_track ? '✅ Sim' : '❌ Não'}
                    ${data.original_track_link ? `<br><a href="${escapeHtml(data.original_track_link)}" style="color: #8b5cf6;">Ouvir track</a>` : ''}
                  </td>
                </tr>
              </table>
              
              ${socialLinks ? `
              <h3 style="margin: 20px 0 10px; color: #333333; font-size: 16px;">Redes Sociais</h3>
              <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; color: #333333; line-height: 1.8;">
                ${socialLinks}
              </div>
              ` : ''}
              
              <h3 style="margin: 20px 0 10px; color: #333333; font-size: 16px;">Sobre o Projeto</h3>
              <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; color: #333333; line-height: 1.6;">
                ${escapeHtml(data.project_description)}
              </div>
              
              <div style="margin-top: 30px; text-align: center;">
                <a href="https://mdaccula.lovable.app/admin/podcast" 
                   style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Ver no Dashboard
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background: #f8f8f8; text-align: center;">
              <p style="margin: 0; color: #666666; font-size: 12px;">
                ID da inscrição: ${data.id}<br>
                Recebida em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// ============= MAIN HANDLER =============
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const data: PodcastSubmissionData = await req.json();

    // Validar dados obrigatórios
    if (!data.id || !data.email || !data.full_name || !data.project_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      artistEmail: null as any,
      agencyEmail: null as any,
      errors: [] as string[],
    };

    // 1. Enviar email de confirmação para o artista
    try {
      const artistEmailResult = await resend.emails.send({
        from: "MDAccula Radio <onboarding@resend.dev>",
        to: [data.email],
        subject: `🎧 Inscrição Recebida - ${data.project_name} | MDAccula Radio`,
        html: generateArtistConfirmationEmail(data),
      });
      results.artistEmail = artistEmailResult;
      console.log("Artist confirmation email sent:", artistEmailResult);
    } catch (error) {
      console.error("Error sending artist email:", error);
      results.errors.push(`Artist email error: ${error.message}`);
    }

    // 2. Enviar notificação para a agência
    try {
      const agencyEmailResult = await resend.emails.send({
        from: "MDAccula System <onboarding@resend.dev>",
        to: ["contato@mdaccula.com"],
        subject: `🎙️ Nova Inscrição Podcast: ${data.project_name} - ${data.full_name}`,
        html: generateAgencyNotificationEmail(data),
      });
      results.agencyEmail = agencyEmailResult;
      console.log("Agency notification email sent:", agencyEmailResult);
    } catch (error) {
      console.error("Error sending agency email:", error);
      results.errors.push(`Agency email error: ${error.message}`);
    }

    // 3. Atualizar flag notification_sent no banco
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from("podcast_submissions")
        .update({ notification_sent: true })
        .eq("id", data.id);
        
      console.log("Updated notification_sent flag for:", data.id);
    } catch (error) {
      console.error("Error updating notification flag:", error);
      results.errors.push(`Database update error: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        results,
      }),
      {
        status: results.errors.length === 0 ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-podcast-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});