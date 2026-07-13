import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf-8");

describe("Contract: automações de e-mail respeitam template selecionado", () => {
  it("frontend envia template_id nos testes e rascunhos manuais dos 3 cards", () => {
    const content = read("src/pages/admin/EmailConfig.tsx");

    expect(content).toContain("body.template_id = weeklyEffectiveTemplateId");
    expect(content).toContain("body.template_id = weekendEffectiveTemplateId");
    expect(content).toContain("body.template_id = blogEffectiveTemplateId");
    expect(content).toContain('sendAutomationTest("weekly-digest-draft", "Digest semanal", setTestingWeekly, weeklyEffectiveTemplateId)');
    expect(content).toContain('sendAutomationTest("weekend-agenda-draft", "Agenda FDS", setTestingWeekend, weekendEffectiveTemplateId)');
    expect(content).toContain('sendAutomationTest("blog-digest-draft", "Blog news", setTestingBlog, blogEffectiveTemplateId)');
  });

  it("weekly-digest-draft prioriza override, configuração salva e só depois default", () => {
    const content = read("supabase/functions/weekly-digest-draft/index.ts");

    expect(content).toContain("overrideTemplateId");
    expect(content).toContain("weekly_digest_template_id");
    expect(content).toContain("activeTplQuery = activeTplQuery.eq('id', cfgTplId)");
    expect(content).toContain("Template de Digest semanal precisa conter bloco de agenda ou blog dinâmico.");
  });

  it("weekend e blog bloqueiam templates sem bloco dinâmico próprio", () => {
    const weekend = read("supabase/functions/weekend-agenda-draft/index.ts");
    const blog = read("supabase/functions/blog-digest-draft/index.ts");

    expect(weekend).toContain("weekend_agenda_template_id");
    expect(weekend).toContain("Template de Agenda FDS precisa conter bloco de agenda dinâmica.");
    expect(blog).toContain("blog_digest_template_id");
    expect(blog).toContain("Template de Blog news precisa conter bloco de matérias do blog.");
  });
});