// supabase/functions/compose-event-image/index.ts
//
// Aplica a marca MDAccula (barra de título + logo) sobre uma imagem de evento já
// hospedada (Bunny ou qualquer URL pública), devolvendo uma nova imagem composta
// também hospedada no Bunny. Usado tanto pelo fluxo de raspagem de sites quanto
// pelo fluxo de Instagram (Fase B do Event Watcher).
//
// Design deliberado: single-file, sem import de ../_shared/ e sem
// EdgeRuntime.waitUntil — evita por construção o bug de deploy documentado em
// scan-event-sources/index.ts (BOOT_ERROR em payload multi-arquivo + waitUntil real).
//
// Qualquer falha em qualquer etapa cai no fallback: devolve a imagem original sem
// alteração (composed:false) — nunca lança erro, nunca bloqueia quem chamou.
import { Image, TextLayout } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return null;
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const IMAGE_FETCH_TIMEOUT_MS = 10000;
const FONT_FETCH_TIMEOUT_MS = 8000;
const MAX_DIMENSION = 1600;

// Fonte de marca (Space Grotesk, ver src/index.css / tailwind.config.ts). O Google
// Fonts hoje só distribui essa família como TTF variável — Image.renderText aceita
// o buffer normalmente, só não escolhe um eixo de peso específico (vai renderizar
// no peso padrão da fonte variável, não necessariamente Bold).
const FONT_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf";

// Logo atual: JPEG de placeholder, sem canal alfa (composite vai colar como
// retângulo opaco, não como marca-d'água transparente) — aceito como limitação
// temporária até o PNG oficial em alta resolução chegar. Trocar o logo depois é só
// mudar esta URL (e a extensão, se vier a ser .png).
const LOGO_URL = "https://mdaccula.com/logo-mdaccula.jpeg";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function composeImage(imageUrl: string, title: string): Promise<string> {
  const imgResp = await fetchWithTimeout(imageUrl, {}, IMAGE_FETCH_TIMEOUT_MS);
  if (!imgResp.ok) throw new Error(`Falha ao baixar imagem base: HTTP ${imgResp.status}`);

  const rawBuffer = new Uint8Array(await imgResp.arrayBuffer());
  if (rawBuffer.length < 2048) throw new Error("Imagem base pequena demais (provável ícone/pixel)");

  const image = await Image.decode(rawBuffer);
  if (image.width > MAX_DIMENSION || image.height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(image.width, image.height);
    image.resize(Math.round(image.width * scale), Math.round(image.height * scale));
  }

  const barHeight = clamp(Math.round(image.height * 0.16), 90, 180);
  const barY = image.height - barHeight;
  const barPadding = Math.round(barHeight * 0.12);
  const logoSize = barHeight - 2 * barPadding;
  const logoX = image.width - barPadding - logoSize;
  const logoY = barY + barPadding;
  const titleMaxWidth = logoX - 2 * barPadding;

  // Barra semi-transparente preta — o fundo quase preto do logo atual funde bem
  // com essa barra, e continua correto quando o PNG transparente chegar.
  image.drawBox(0, barY, image.width, barHeight, Image.rgbaToColor(0, 0, 0, 178));

  // Texto do título (best-effort — se a fonte não carregar, segue só com
  // barra+logo, branding parcial é melhor que nenhum).
  try {
    const fontResp = await fetchWithTimeout(FONT_URL, {}, FONT_FETCH_TIMEOUT_MS);
    if (fontResp.ok) {
      const fontBytes = new Uint8Array(await fontResp.arrayBuffer());
      const scale = Math.round(barHeight * 0.2);
      const textImage = await Image.renderText(
        fontBytes,
        scale,
        title,
        Image.rgbaToColor(255, 255, 255, 255),
        new TextLayout({
          maxWidth: titleMaxWidth,
          maxHeight: barHeight - 2 * barPadding,
          wrapStyle: "word",
          verticalAlign: "left",
          horizontalAlign: "top",
        }),
      );
      image.composite(textImage, barPadding, barY + barPadding);
    }
  } catch (textError) {
    console.error("[compose-event-image] Renderização de texto falhou (seguindo sem título):", textError);
  }

  // Logo — best-effort, mesmo raciocínio: se falhar, segue só com barra+texto.
  try {
    const logoResp = await fetchWithTimeout(LOGO_URL, {}, IMAGE_FETCH_TIMEOUT_MS);
    if (logoResp.ok) {
      const logoBuffer = new Uint8Array(await logoResp.arrayBuffer());
      const logoImage = await Image.decode(logoBuffer);
      logoImage.resize(logoSize, logoSize);
      image.composite(logoImage, logoX, logoY);
    }
  } catch (logoError) {
    console.error("[compose-event-image] Composição do logo falhou (seguindo sem logo):", logoError);
  }

  // NOTA: imagescript@1.3.0/1.4.0 (a única versão publicada) NÃO tem suporte a
  // WebP nenhum — nem decode nem encode (confirmado lendo o bundle: só
  // png/jpeg/tiff/gif). `encodeWEBP` NÃO existe na classe Image dessa lib —
  // usar JPEG aqui de propósito. (Acharia o mesmo problema em
  // scan-event-sources/rehostImageToBunny e generate-blog-post-v2, que chamam
  // encodeWEBP e por isso provavelmente sempre falham silenciosamente — fora do
  // escopo desta function, mas vale investigar separadamente.)
  const finalBuffer = await image.encodeJPEG(85);

  const bunnyKey = Deno.env
    .get("BUNNY_STORAGE_API_KEY")
    ?.trim()
    ?.replace(/^["']|["']$/g, "")
    ?.replace(/[^\x20-\x7E]/g, "");
  if (!bunnyKey) throw new Error("BUNNY_STORAGE_API_KEY não configurada");

  const fileName = `event-composed-${Date.now()}.jpg`;
  const bunnyHostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
  const uploadResp = await fetch(`https://${bunnyHostname}/mdaccula/event-images/${fileName}`, {
    method: "PUT",
    headers: { AccessKey: bunnyKey, "Content-Type": "image/jpeg" },
    body: finalBuffer,
  });
  if (!uploadResp.ok) throw new Error(`Falha ao subir imagem composta: HTTP ${uploadResp.status}`);

  return `https://mdaccula.b-cdn.net/event-images/${fileName}`;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  let body: { imageUrl?: unknown; title?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body inválido", success: false }, 400);
  }

  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (!/^https?:\/\//.test(imageUrl)) {
    return jsonResponse({ error: "imageUrl inválido — informe uma URL http(s)", success: false }, 400);
  }
  if (!title) {
    return jsonResponse({ error: "title é obrigatório", success: false }, 400);
  }

  try {
    const composedUrl = await composeImage(imageUrl, title);
    return jsonResponse({ success: true, imageUrl: composedUrl, composed: true });
  } catch (error) {
    console.error("[compose-event-image] Falhou, devolvendo imagem original sem alteração:", error);
    return jsonResponse({ success: true, imageUrl, composed: false });
  }
});
