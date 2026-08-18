/**
 * Regressão — a mesclagem de eventos (status='merged_inactive'/
 * is_merge_shell) NUNCA deve vazar pra consulta pública de /links. Decisão
 * de design (confirmada pelo usuário em 17/08/2026): /links continua
 * mostrando cada evento normalmente, mesclado ou não — ver
 * docs/superpowers/specs/2026-08-17-event-merge-nondestructive-redesign-design.md,
 * decisão #8.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('useLinks — consulta pública não filtra por status/is_merge_shell', () => {
  it('a query de link_groups/custom_links não referencia status nem is_merge_shell', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useLinks.ts'), 'utf-8');
    expect(src).not.toMatch(/is_merge_shell/);
    expect(src.split('fetchLinksData')[1]).not.toMatch(/\.eq\(\s*['"]status['"]/);
  });
});
