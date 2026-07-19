import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(`${process.cwd()}/${path}`, 'utf-8');

describe('Contract: automações de e-mail respeitam template selecionado', () => {
  it('frontend envia template_id nos testes e rascunhos manuais dos 3 cards', () => {
    const content = read('src/pages/admin/EmailConfig.tsx');

    // Helper único que injeta template_id no body (refatorado em 2024/2025).
    expect(content).toContain('body.template_id = tplId');
    // Os 3 cards continuam disparando testes com o template efetivo próprio.
    expect(content).toMatch(
      /sendAutomationTest\(\s*'weekly-digest-draft',\s*'Digest semanal',\s*setTestingWeekly,\s*weeklyEffectiveTemplateId/
    );
    expect(content).toMatch(
      /sendAutomationTest\(\s*'weekend-agenda-draft',\s*'Agenda FDS',\s*setTestingWeekend,\s*weekendEffectiveTemplateId/
    );
    expect(content).toMatch(
      /sendAutomationTest\(\s*'blog-digest-draft',\s*'Blog news',\s*setTestingBlog,\s*blogEffectiveTemplateId/
    );
  });

  it('weekly-digest-draft prioriza override, configuração salva e só depois default', () => {
    const content = read('supabase/functions/weekly-digest-draft/index.ts');

    expect(content).toContain('overrideTemplateId');
    expect(content).toContain('weekly_digest_template_id');
    expect(content).toContain("activeTplQuery = activeTplQuery.eq('id', cfgTplId)");
    expect(content).toContain(
      'Template de Digest semanal precisa conter bloco de agenda ou blog dinâmico.'
    );
  });

  it('weekend e blog bloqueiam templates sem bloco dinâmico próprio', () => {
    const weekend = read('supabase/functions/weekend-agenda-draft/index.ts');
    const blog = read('supabase/functions/blog-digest-draft/index.ts');

    expect(weekend).toContain('weekend_agenda_template_id');
    expect(weekend).toContain('Template de Agenda FDS precisa conter bloco de agenda dinâmica.');
    expect(blog).toContain('blog_digest_template_id');
    expect(blog).toContain('Template de Blog news precisa conter bloco de matérias do blog.');
  });
});
