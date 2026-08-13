/**
 * Regressão R-061 — Logo do e-mail e arte de "virada de lote" bypassavam o
 * Bunny CDN (causa confirmada de parte do pico de Cached Egress de 11/08/2026).
 *
 * `uploadLogo` (useEmailConfigState.ts) e `uploadBatchArtwork` (useManualBatch.ts)
 * subiam o arquivo direto pro bucket `link-thumbnails` do Supabase Storage e
 * usavam `getPublicUrl()` cru. `logo_url` vai no header de TODO e-mail
 * disparado pelo sistema; `batchArtworkUrl` vira o flyer de disparos manuais
 * de "virada de lote". Como nenhuma das duas URLs passava pelo Bunny, cada
 * abertura/scan de e-mail (por destinatário, por provedor — Gmail, Outlook,
 * antivírus corporativo) puxava a imagem direto da origem do Supabase, sem
 * nenhuma camada de cache na frente — confirmado nos storage_logs de
 * 11/08/2026 (vários bots de e-mail distintos batendo no mesmo objeto
 * `link-thumbnails/email-template/batch-*.jpeg` no mesmo dia do pico).
 *
 * Fix: as duas usam `uploadImageToBunny()` (`src/lib/bunnyUploader.ts`),
 * mesmo helper já usado por todo o resto do app (event-images, blog,
 * team-images etc.), que sobe pro Bunny primeiro e faz backup no Supabase
 * Storage — nunca o caminho inverso.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-061 — logo e arte de e-mail vão pro Bunny CDN, não direto pro Supabase Storage', () => {
  it('useEmailConfigState.ts (uploadLogo) usa uploadImageToBunny, não supabase.storage.from(...).upload', () => {
    const src = read('src/components/admin/emailConfig/useEmailConfigState.ts');
    expect(src).toMatch(/from '@\/lib\/bunnyUploader'/);
    expect(
      src,
      'uploadLogo voltou a subir o arquivo direto pro Supabase Storage (bypassa o Bunny CDN).'
    ).not.toMatch(/supabase\.storage\s*\n?\s*\.from\(['"]link-thumbnails['"]\)\s*\n?\s*\.upload/);
    const uploadLogoBlock = src.slice(src.indexOf('const uploadLogo ='), src.indexOf('const uploadLogo =') + 900);
    expect(uploadLogoBlock).toMatch(/uploadImageToBunny\(/);
  });

  it('useManualBatch.ts (uploadBatchArtwork) usa uploadImageToBunny, não supabase.storage.from(...).upload', () => {
    const src = read('src/components/admin/emailConfig/useManualBatch.ts');
    expect(src).toMatch(/from '@\/lib\/bunnyUploader'/);
    expect(
      src,
      'uploadBatchArtwork voltou a subir o arquivo direto pro Supabase Storage (bypassa o Bunny CDN).'
    ).not.toMatch(/supabase\.storage\s*\n?\s*\.from\(['"]link-thumbnails['"]\)\s*\n?\s*\.upload/);
    const uploadBatchBlock = src.slice(
      src.indexOf('const uploadBatchArtwork ='),
      src.indexOf('const uploadBatchArtwork =') + 900
    );
    expect(uploadBatchBlock).toMatch(/uploadImageToBunny\(/);
  });
});
