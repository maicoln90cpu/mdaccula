import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib';
import { convertToWebP, convertToWebPWithThumb } from '@/lib/webpConverter';

export interface UploadImageOpts {
  /** Nome-base compartilhado entre variantes da mesma imagem (ex: full + thumb) */
  baseName?: string;
  /** Sufixo da variante (ex: 'thumb', 'medium'). Ignorado sem baseName. */
  variant?: string;
}

/**
 * Faz upload de uma imagem para o Bunny Storage via edge function.
 *
 * @param file - Arquivo de imagem (preferencialmente já convertido para WebP)
 * @param bucket - "Pasta" dentro da storage zone (ex: 'event-images', 'link-thumbnails', 'team-images')
 * @param opts - baseName/variant opcionais para gerar variantes de tamanho (ver convertToWebPWithThumb)
 * @returns URL pública no CDN do Bunny (mdaccula.b-cdn.net)
 */
export async function uploadImageToBunny(
  file: File,
  bucket: string = 'event-images',
  opts?: UploadImageOpts
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Usuário não autenticado');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('bucket', bucket);
  if (opts?.baseName) {
    formData.append('baseName', opts.baseName);
    if (opts.variant) formData.append('variant', opts.variant);
  }

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const response = await fetch(`https://${projectId}.supabase.co/functions/v1/upload-to-bunny`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Erro ao fazer upload para Bunny Storage');
  }

  const result = await response.json();
  return result.url;
}

export interface UploadWithThumbOpts {
  fullOpts?: { maxSizeMB?: number; maxDimension?: number };
  thumbOpts?: { maxSizeMB?: number; maxDimension?: number };
  /** Também gera e sobe uma variante 'medium' (~800px), best-effort, pra heroes responsivos */
  medium?: boolean | { maxSizeMB?: number; maxDimension?: number };
}

/**
 * Converte um arquivo pra WebP (full + thumb) e envia as duas variantes
 * pro Bunny com o mesmo nome-base, pra reduzir banda de entrega em
 * contextos pequenos (cards, ícones). Só a URL full é retornada — a URL
 * do thumb é derivada em tempo de exibição via getThumbnailUrl().
 *
 * O upload do thumb é best-effort: se falhar, a exibição cai pro full
 * automaticamente (ver handleThumbImageFallback), então não bloqueia
 * nem falha a operação principal.
 */
export async function uploadImageWithThumb(
  file: File | Blob,
  bucket: string = 'event-images',
  opts: UploadWithThumbOpts = {}
): Promise<string> {
  const { full, thumb } = await convertToWebPWithThumb(file, opts.fullOpts, opts.thumbOpts);
  const baseName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const fullUrl = await uploadImageToBunny(full, bucket, { baseName });

  uploadImageToBunny(thumb, bucket, { baseName, variant: 'thumb' }).catch((err) => {
    logger.warn('Falha ao enviar variante thumb (não bloqueia, exibição cai pro full)', {
      component: 'bunnyUploader',
      error: err instanceof Error ? err.message : String(err),
    });
  });

  if (opts.medium) {
    const mediumOpts = typeof opts.medium === 'object' ? opts.medium : {};
    convertToWebP(file, mediumOpts.maxSizeMB ?? 0.25, mediumOpts.maxDimension ?? 800)
      .then((mediumFile) => uploadImageToBunny(mediumFile, bucket, { baseName, variant: 'medium' }))
      .catch((err) => {
        logger.warn('Falha ao enviar variante medium (não bloqueia, exibição cai pro full)', {
          component: 'bunnyUploader',
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  return fullUrl;
}
