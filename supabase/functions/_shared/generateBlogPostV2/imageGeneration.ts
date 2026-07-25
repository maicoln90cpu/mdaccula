import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import type { createClient } from "npm:@supabase/supabase-js@2";
import { pickRandomStyle } from "./imageStyles.ts";
import { fetchWithTimeout } from "./http.ts";

export interface BackgroundImageOpts {
  postId: string;
  imageTitle: string;
  imageSummary: string;
  imageCategory: string;
  imageKeywords: string;
  imageMood: string;
  imageVisualElements: string;
  customImagePrompt: string;
  lovableApiKey: string;
}

export async function generateAndAttachImage(
  supabase: ReturnType<typeof createClient>,
  opts: BackgroundImageOpts
): Promise<void> {
  const bgStart = Date.now();
  const MAX_IMAGE_ATTEMPTS = 2;
  const IMAGE_BUDGET_MS = 90000; // 90s budget total para o background

  try {
    for (let attempt = 1; attempt <= MAX_IMAGE_ATTEMPTS; attempt++) {
      if (Date.now() - bgStart > IMAGE_BUDGET_MS) {
        console.warn(`[bg-image] Budget esgotado antes da tentativa ${attempt}`);
        break;
      }

      try {
        console.log(`[bg-image] 🎨 Tentativa ${attempt}/${MAX_IMAGE_ATTEMPTS} para post ${opts.postId}`);

        let selectedPromptTemplate: string;
        if (opts.customImagePrompt) {
          selectedPromptTemplate = opts.customImagePrompt;
        } else {
          const style = await pickRandomStyle(supabase);
          selectedPromptTemplate = style.prompt;
          console.log(`[bg-image] Estilo variado #${style.index}`);
        }

        const imagePrompt = selectedPromptTemplate
          .replace(/\{\{title\}\}/g, opts.imageTitle)
          .replace(/\{\{summary\}\}/g, opts.imageSummary)
          .replace(/\{\{category\}\}/g, opts.imageCategory)
          .replace(/\{\{keywords\}\}/g, opts.imageKeywords)
          .replace(/\{\{mood\}\}/g, opts.imageMood)
          .replace(/\{\{visualElements\}\}/g, opts.imageVisualElements);

        const imageTimeout = 45000;
        const imageResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${opts.lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image',
            messages: [{ role: 'user', content: imagePrompt }],
            modalities: ['image', 'text']
          })
        }, imageTimeout);

        if (!imageResponse.ok) {
          console.error(`[bg-image] Tentativa ${attempt}: status ${imageResponse.status}`);
          continue;
        }

        const imageData = await imageResponse.json();
        const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        const imageTokensUsed = imageData.usage?.total_tokens || 0;

        if (!base64Image) {
          console.error(`[bg-image] Tentativa ${attempt}: sem base64`);
          continue;
        }

        const base64Data = base64Image.split(',')[1];
        if (!base64Data || base64Data.length < 1024) {
          console.error(`[bg-image] Tentativa ${attempt}: base64 muito pequeno`);
          continue;
        }

        const pngBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        if (pngBuffer.length < 1024) {
          console.error(`[bg-image] Tentativa ${attempt}: buffer pequeno`);
          continue;
        }

        let finalBuffer: Uint8Array;
        let fileExt = 'png';
        let contentType = 'image/png';
        try {
          const image = await Image.decode(pngBuffer);
          const maxDimension = 1024;
          if (image.width > maxDimension || image.height > maxDimension) {
            const scale = maxDimension / Math.max(image.width, image.height);
            image.resize(Math.round(image.width * scale), Math.round(image.height * scale));
          }
          finalBuffer = await image.encodeWEBP(85);
          fileExt = 'webp';
          contentType = 'image/webp';
        } catch (conversionError) {
          console.error('[bg-image] Falha WebP, usando PNG:', conversionError);
          finalBuffer = pngBuffer;
        }

        const fileName = `ai-generated-${Date.now()}.${fileExt}`;
        const BUNNY_STORAGE_API_KEY = Deno.env.get('BUNNY_STORAGE_API_KEY')?.trim()?.replace(/^["']|["']$/g, '')?.replace(/[^\x20-\x7E]/g, '');

        if (!BUNNY_STORAGE_API_KEY) {
          console.error('[bg-image] BUNNY_STORAGE_API_KEY ausente');
          break;
        }

        const bunnyHostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
        const bunnyUploadUrl = `https://${bunnyHostname}/mdaccula/event-images/${fileName}`;
        const uploadResp = await fetch(bunnyUploadUrl, {
          method: 'PUT',
          headers: { AccessKey: BUNNY_STORAGE_API_KEY, 'Content-Type': contentType },
          body: finalBuffer,
        });

        if (!uploadResp.ok) {
          const errText = await uploadResp.text();
          console.error(`[bg-image] Upload Bunny falhou (${uploadResp.status}):`, errText);
          continue;
        }

        const generatedImageUrl = `https://mdaccula.b-cdn.net/event-images/${fileName}`;
        console.log(`[bg-image] ✅ Upload OK: ${generatedImageUrl}`);

        const { error: updateErr } = await supabase
          .from('blog_posts')
          .update({ image_url: generatedImageUrl })
          .eq('id', opts.postId);

        if (updateErr) {
          console.error('[bg-image] Erro ao atualizar blog_posts.image_url:', updateErr);
        } else {
          console.log(`[bg-image] ✅ Post ${opts.postId} atualizado com capa em ${Date.now() - bgStart}ms`);
        }

        if (imageTokensUsed > 0) {
          await supabase
            .from('ai_generated_posts')
            .update({ image_tokens: imageTokensUsed })
            .eq('blog_post_id', opts.postId)
            .then(() => {})
            .catch(() => {});
        }

        return; // sucesso, sair
      } catch (innerErr) {
        console.error(`[bg-image] Erro tentativa ${attempt}:`, innerErr);
      }
    }
    console.warn(`[bg-image] ⚠️ Todas as tentativas falharam para post ${opts.postId}`);
  } catch (outerErr) {
    console.error('[bg-image] Erro fatal no background:', outerErr);
  }
}
