/**
 * Helper interno para fazer upload de bytes brutos para o Bunny Storage.
 * Não exige FormData, JWT ou autenticação de admin — destina-se a ser
 * chamado por outras Edge Functions com service role.
 */

const BUNNY_STORAGE_ZONE = "mdaccula";
const BUNNY_CDN_HOST = "https://mdaccula.b-cdn.net";

function getBunnyStorageHost(): string {
  const hostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME");
  return hostname ? `https://${hostname}` : "https://storage.bunnycdn.com";
}

export type BunnyCheckResult = "exists" | "not-found" | "error";

/**
 * Checa a existência de um arquivo no Bunny CDN via HEAD, distinguindo
 * "confirmado ausente" (404) de "indeterminado" (timeout/erro de rede/outro
 * status). Colapsar os dois em `false` fazia o chamador re-gerar a imagem
 * (rechamando a API do Google) sempre que o Bunny tinha um hiccup, mesmo com
 * o arquivo já existindo — daí o tri-state.
 */
export async function checkBunnyFile(path: string): Promise<BunnyCheckResult> {
  // Verifica pelo CDN público (pull zone), não pelo storage origin: a API de
  // Storage do Bunny responde 401 em HEAD nesta zona mesmo com a AccessKey
  // correta (upload via PUT funciona normalmente), então a checagem sempre
  // dava falso negativo e o arquivo era baixado/reenviado a cada envio.
  const url = `${BUNNY_CDN_HOST}/${path}`;
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) return "exists";
    if (res.status === 404) return "not-found";
    console.warn(`[checkBunnyFile] HEAD ${url} -> ${res.status}`);
    return "error";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[checkBunnyFile] HEAD ${url} threw: ${msg}`);
    return "error";
  }
}

export async function uploadBytesToBunny(
  buffer: ArrayBuffer,
  path: string,
  contentType: string,
): Promise<{ url: string; path: string }> {
  const apiKey = getBunnyStorageApiKey();
  if (!apiKey) {
    throw new Error("BUNNY_STORAGE_API_KEY not configured");
  }

  const url = `${getBunnyStorageHost()}/${BUNNY_STORAGE_ZONE}/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: apiKey,
      "Content-Type": contentType,
    },
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Bunny upload failed (${res.status}): ${text}`);
  }

  return { url: `${BUNNY_CDN_HOST}/${path}`, path };
}

function getBunnyStorageApiKey(): string {
  const raw = Deno.env.get("BUNNY_STORAGE_API_KEY") || "";
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}
