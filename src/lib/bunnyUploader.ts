import { supabase } from '@/integrations/supabase/client';

/**
 * Faz upload de uma imagem para o Bunny Storage via edge function.
 * 
 * @param file - Arquivo de imagem (preferencialmente já convertido para WebP)
 * @param bucket - "Pasta" dentro da storage zone (ex: 'event-images', 'link-thumbnails', 'team-images')
 * @returns URL pública no CDN do Bunny (mdaccula.b-cdn.net)
 */
export async function uploadImageToBunny(
  file: File,
  bucket: string = 'event-images'
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Usuário não autenticado');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('bucket', bucket);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/upload-to-bunny`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Erro ao fazer upload para Bunny Storage');
  }

  const result = await response.json();
  return result.url;
}
