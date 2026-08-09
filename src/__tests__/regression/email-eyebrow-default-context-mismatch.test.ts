/**
 * Regressão R-038 (auditoria de templates, agosto/2026) — bloco "eyebrow"
 * (etiqueta pequena acima do título) nascia com texto fixo "Novo evento" em
 * QUALQUER template, incluindo "Virada de lote" e "Cortesia". Um admin que
 * adicionasse esse bloco manualmente num template de outro tipo herdava
 * copy do contexto errado sem perceber.
 *
 * Além disso, mesmo corrigindo o default do editor pra vazio, o renderer
 * de backend (`emailBlocks/renderBlock/basic.ts`) tinha o MESMO fallback
 * fixo "Novo evento" pra quando `block.text` estava vazio — então um
 * template salvo com o eyebrow em branco continuava mostrando "Novo evento"
 * no e-mail de verdade, só que agora silenciosamente (o campo aparecia
 * vazio no editor, mas o envio real preenchia sozinho com texto errado).
 *
 * Correção:
 *   - `blockDefaults.ts`: novo bloco eyebrow nasce com `text: ''`.
 *   - `textProps.tsx`: campo ganhou `placeholder` visual, já que não tem
 *     mais um valor default pra guiar o admin.
 *   - `renderBlock/basic.ts`: eyebrow sem texto (ou só espaços) não
 *     renderiza mais nada, em vez de cair no fallback "Novo evento".
 *
 * Teste estático (sem render): garante que os 3 arquivos não voltam ao
 * comportamento antigo.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-038 — bloco eyebrow não herda mais copy fixa de "Novo evento"', () => {
  it('blockDefaults.ts: novo bloco eyebrow nasce com text vazio (não mais "Novo evento")', () => {
    const src = read('src/components/admin/emailTemplateEditor/blockDefaults.ts');
    expect(src).toMatch(/case 'eyebrow':\s*\n\s*return \{ id, kind, text: '', align: 'left' \}/);
  });

  it('textProps.tsx: campo de texto do eyebrow tem um placeholder visual', () => {
    const src = read('src/components/admin/emailTemplateEditor/blockPropsPanel/textProps.tsx');
    expect(src).toMatch(/placeholder="Digite o texto/);
  });

  it('renderBlock/basic.ts: eyebrow sem texto não cai mais no fallback fixo "Novo evento"', () => {
    const src = read('supabase/functions/_shared/emailBlocks/renderBlock/basic.ts');
    expect(src).not.toMatch(/block\.text \|\| "Novo evento"/);
    expect(src).toMatch(/if \(!block\.text\?\.trim\(\)\) return "";/);
  });
});
