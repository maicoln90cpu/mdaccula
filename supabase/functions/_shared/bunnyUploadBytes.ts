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

export async function bunnyFileExists(path: string): Promise<boolean> {
  const apiKey = getBunnyStorageApiKey();
  const url = `${getBunnyStorageHost()}/${BUNNY_STORAGE_ZONE}/${path}`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { AccessKey: apiKey },
    });
    return res.ok;
  } catch {
    return false;
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
