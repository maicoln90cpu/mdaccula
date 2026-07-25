import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const listTypeScriptFiles = (dir: string): string[] =>
  fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${dir}/${entry.name}`;
    return entry.isDirectory()
      ? listTypeScriptFiles(relative)
      : /\.(ts|tsx)$/.test(entry.name)
        ? [relative]
        : [];
  });

describe('guard arquitetural do compositor de e-mail', () => {
  it('codigo de producao nao chama renderizadores de HTML fora do compositor canonico', () => {
    const files = [...listTypeScriptFiles('src'), ...listTypeScriptFiles('supabase/functions')]
      .filter((file) => !file.includes('__tests__'))
      .filter((file) => !file.endsWith('_test.ts'));

    const allowed = new Set([
      'supabase/functions/_shared/emailComposer.ts',
      'supabase/functions/_shared/emailBlocks.ts',
      // Após Onda 5, o barrel `emailBlocks.ts` reexporta dos módulos abaixo.
      // A chamada `renderBlockedTemplate(` legítima passou a viver aqui.
      'supabase/functions/_shared/emailBlocks/renderBlockedTemplate.ts',
      // Definicao mantida temporariamente para compatibilidade de imports antigos;
      // nenhum fluxo de producao pode chama-la.
      'src/lib/emailTemplates/eventAnnouncement.ts',
    ]);

    const violations = files.filter((file) => {
      if (allowed.has(file)) return false;
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      return /\b(?:renderBlockedTemplate|renderEventAnnouncementEmail)\s*\(/.test(source);
    });

    expect(violations, `Chamadas diretas encontradas:\n${violations.join('\n')}`).toEqual([]);
  });
});
