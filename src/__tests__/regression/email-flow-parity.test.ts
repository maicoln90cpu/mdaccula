import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

// Normaliza CRLF -> LF: checkouts Windows (core.autocrlf) devolvem \r\n, e as
// asserções abaixo usam \n literal — sem isso, toContain nunca bate no Windows.
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8").replace(/\r\n/g, "\n");

describe("regressao - fidelidade entre preview, teste, rascunho e envio", () => {
  it("o disparo de evento carrega todos os dados dinamicos dos blocos", () => {
    const source = read("src/lib/emailTemplates/dispatchEventDraft.ts");
    for (const field of ["lineup", "vip_link", "latitude", "longitude", "venue_lat", "venue_lng", "blog_post_id"]) {
      expect(source, `Campo ausente no disparo: ${field}`).toContain(field);
    }
    expect(source).toContain("composeEmail({");
  });

  it("o snapshot exibido no envio manual segue sem remontagem ate a E-goi", () => {
    const page = read("src/pages/admin/EmailConfig.tsx");
    const dispatch = read("src/lib/emailTemplates/dispatchEventDraft.ts");
    const edge = read("supabase/functions/create-event-email-campaign/index.ts");

    expect(page).toContain("preparedComposition:");
    expect(page).toContain("html: manualComposition.html");
    expect(dispatch).toContain("const finalComposition = opts.preparedComposition ?? composition");
    expect(dispatch).toContain("html: finalComposition.html");
    expect(edge).toContain("body: html");
  });

  it("o teste envia o HTML recebido sem sanitizar ou remontar", () => {
    const edge = read("supabase/functions/send-test-email/index.ts");
    expect(edge).toContain("html,");
    expect(edge).not.toMatch(/sanitize.*html|renderBlockedTemplate\s*\(/i);
  });

  it("cada preview de automacao chama sua propria funcao", () => {
    const source = read("src/pages/admin/EmailConfig.tsx");
    expect(source).toContain('src === "weekend"\n        ? "weekend-agenda-draft"');
    expect(source).toContain('src === "blog"\n        ? "blog-digest-draft"');
    expect(source).toContain(': "weekly-digest-draft"');
  });

  it("alteracoes nao salvas bloqueiam o teste do editor", () => {
    const source = read("src/pages/admin/EmailConfig.tsx");
    expect(source).toContain("disabled={sendingTest || editorDirty");
    expect(source).toContain("Somente a versão salva pode ser enviada");
  });
});
