/**
 * Fallback de Supabase Storage para as imagens de mapa estático de evento.
 * Usado quando o Bunny CDN não confirma a existência do arquivo (timeout,
 * erro de rede, etc.) — evita re-chamar a API do Google Maps só porque o
 * Bunny teve um hiccup. Espelha o padrão de "upload no Bunny + backup no
 * Supabase Storage" já usado em supabase/functions/upload-to-bunny/index.ts.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const MAP_IMAGES_BUCKET = "event-map-images";

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function storageGetFile(
  path: string,
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const { data, error } = await getServiceClient().storage
      .from(MAP_IMAGES_BUCKET)
      .download(path);
    if (error || !data) return null;
    return {
      bytes: await data.arrayBuffer(),
      contentType: data.type || "image/png",
    };
  } catch (err) {
    console.warn(`[mapImageStorage] download ${path} failed:`, err);
    return null;
  }
}

export async function storageUploadFile(
  bytes: ArrayBuffer,
  path: string,
  contentType: string,
): Promise<void> {
  try {
    const { error } = await getServiceClient().storage
      .from(MAP_IMAGES_BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (error) {
      console.warn(`[mapImageStorage] upload ${path} failed:`, error.message);
    }
  } catch (err) {
    console.warn(`[mapImageStorage] upload ${path} threw:`, err);
  }
}

export function getStoragePublicUrl(path: string): string {
  const { data } = getServiceClient().storage.from(MAP_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
