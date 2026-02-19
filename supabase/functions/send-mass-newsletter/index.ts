import { Resend } from "npm:resend@2.0.0";

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

function jsonSuccess(data: Record<string, unknown> = { success: true }, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number = 500): Response {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function handleError(error: unknown, functionName: string): Response {
  console.error(`Error in ${functionName}:`, error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  return jsonError(message, 500);
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const FUNCTION_TIMEOUT_MS = 25000; // 25 seconds timeout
const EMAIL_TIMEOUT_MS = 5000; // 5 seconds per email

interface MassEmailRequest {
  subject: string;
  body: string;
  recipients: string[];
}

// Send email with timeout
async function sendEmailWithTimeout(
  email: string,
  subject: string,
  body: string,
  timeoutMs: number
): Promise<{ success: boolean; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const emailResponse = await resend.emails.send({
      from: "MDAccula <onboarding@resend.dev>",
      to: [email],
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">MDAccula Newsletter</h2>
          <div style="line-height: 1.6; color: #666;">
            ${body.replace(/\n/g, '<br>')}
          </div>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">
            Você está recebendo este email porque se inscreveu na newsletter do MDAccula.
            <br>
            Para cancelar sua inscrição, <a href="https://mdaccula.com.br/unsubscribe">clique aqui</a>.
          </p>
        </div>
      `,
    });
    
    clearTimeout(timeoutId);
    console.log(`Email sent successfully to ${email}:`, emailResponse);
    return { success: true };
  } catch (error) {
    clearTimeout(timeoutId);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error sending email to ${email}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const startTime = Date.now();

  try {
    const { subject, body, recipients }: MassEmailRequest = await req.json();

    console.log(`Sending mass email to ${recipients.length} recipients`);

    // Send emails in batches to avoid rate limits
    const batchSize = 50;
    const batches: string[][] = [];
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const batch of batches) {
      // Check if we're running out of time
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > FUNCTION_TIMEOUT_MS - 3000) {
        console.log(`⚠️ Tempo esgotando após ${elapsedMs}ms, pulando ${recipients.length - successCount - errorCount} emails restantes`);
        skippedCount = recipients.length - successCount - errorCount;
        break;
      }

      try {
        const results = await Promise.all(
          batch.map(async (email) => sendEmailWithTimeout(email, subject, body, EMAIL_TIMEOUT_MS))
        );
        
        results.forEach(result => {
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        });
        
        // Wait a bit between batches to respect rate limits
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
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
    return handleError(error, 'send-mass-newsletter');
  }
});
