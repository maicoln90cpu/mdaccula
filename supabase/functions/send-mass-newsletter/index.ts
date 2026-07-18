// supabase/functions/send-mass-newsletter/index.ts
import { Resend } from "npm:resend@2.0.0";
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
function handleCorsPreFlight(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}
function jsonSuccess(data = { success: true }, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
function handleError(error, functionName) {
  console.error(`Error in ${functionName}:`, error);
  const message = error instanceof Error ? error.message : "Unknown error";
  return jsonError(message, 500);
}
var resend = new Resend(Deno.env.get("RESEND_API_KEY"));
var FUNCTION_TIMEOUT_MS = 25e3;
var EMAIL_TIMEOUT_MS = 5e3;
async function sendEmailWithTimeout(email, subject, body, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const emailResponse = await resend.emails.send({
      from: "MDAccula <onboarding@resend.dev>",
      to: [email],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">MDAccula Newsletter</h2>
          <div style="line-height: 1.6; color: #666;">
            ${body.replace(/\n/g, "<br>")}
          </div>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">
            Voc\xEA est\xE1 recebendo este email porque se inscreveu na newsletter do MDAccula.
            <br>
            Para cancelar sua inscri\xE7\xE3o, <a href="https://mdaccula.com.br/unsubscribe">clique aqui</a>.
          </p>
        </div>
      `
    });
    clearTimeout(timeoutId);
    console.log(`Email sent successfully to ${email}:`, emailResponse);
    return { success: true };
  } catch (error) {
    clearTimeout(timeoutId);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error sending email to ${email}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}
Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;
  const startTime = Date.now();
  try {
    const { subject, body, recipients } = await req.json();
    console.log(`Sending mass email to ${recipients.length} recipients`);
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    for (const batch of batches) {
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > FUNCTION_TIMEOUT_MS - 3e3) {
        console.log(`\u26A0\uFE0F Tempo esgotando ap\xF3s ${elapsedMs}ms, pulando ${recipients.length - successCount - errorCount} emails restantes`);
        skippedCount = recipients.length - successCount - errorCount;
        break;
      }
      try {
        const results = await Promise.all(
          batch.map(async (email) => sendEmailWithTimeout(email, subject, body, EMAIL_TIMEOUT_MS))
        );
        results.forEach((result) => {
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        });
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1e3));
        }
      } catch (error) {
        console.error("Error processing batch:", error);
      }
    }
    const totalTime = Date.now() - startTime;
    console.log(`Mass email completed in ${totalTime}ms: ${successCount} sent, ${errorCount} failed, ${skippedCount} skipped`);
    return jsonSuccess({
      success: true,
      sent: successCount,
      failed: errorCount,
      skipped: skippedCount,
      processingTimeMs: totalTime
    });
  } catch (error) {
    return handleError(error, "send-mass-newsletter");
  }
});
