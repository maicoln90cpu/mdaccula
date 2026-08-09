/**
 * Regressão — Segurança e copy (grupo de 2, Fase 9 da auditoria de agosto/2026).
 *
 * 1) Upload de logo (TemplateBrandTab/useEmailConfigState) validado só no
 *    client (tamanho/tipo do <input>) — nada impedia um cliente HTTP
 *    customizado (com token de admin válido) de subir um arquivo arbitrário
 *    pro bucket "link-thumbnails", que fica publicamente acessível pela
 *    URL. Agora o bucket tem file_size_limit e allowed_mime_types no
 *    Storage (migration 20260809101500_link_thumbnails_bucket_limits.sql).
 *
 * 2) A copy sobre sanitização de HTML customizado ("Scripts, styles e
 *    handlers on* são removidos automaticamente por segurança") prometia
 *    mais proteção do que a implementação real garante (o sanitizador é
 *    baseado em regex e tem brechas conhecidas — handlers sem aspas,
 *    `<svg onload>` etc.). Ajustada para não prometer blindagem total.
 *
 * Este teste é estático (sem render/rede): lê a migration e o código-fonte
 * e garante que as duas correções continuam presentes.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — bucket link-thumbnails tem limites de tamanho/tipo no Storage', () => {
  it('migration define file_size_limit e allowed_mime_types', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260809101500_link_thumbnails_bucket_limits.sql'
    );
    expect(fs.existsSync(migrationPath), 'Migration dos limites do bucket não encontrada').toBe(
      true
    );
    const sql = read('supabase/migrations/20260809101500_link_thumbnails_bucket_limits.sql');
    expect(sql).toMatch(/file_size_limit\s*=\s*3145728/);
    expect(sql).toMatch(/allowed_mime_types/);
    expect(sql).toMatch(/WHERE id = 'link-thumbnails'/);
  });
});

describe('Regressão — copy de sanitização de HTML não promete blindagem total', () => {
  it('TemplateBrandTab.tsx não afirma mais que a limpeza é uma garantia de segurança completa', () => {
    const src = read('src/components/admin/emailConfig/TemplateBrandTab.tsx');
    expect(
      src,
      'A copy voltou a prometer "removidos automaticamente por segurança" sem ressalva — isso é ' +
        'mais forte do que o sanitizador baseado em regex realmente garante.'
    ).not.toMatch(/removidos automaticamente por segurança\./);
    expect(src).toMatch(/não é uma sanitização completa/);
  });
});
