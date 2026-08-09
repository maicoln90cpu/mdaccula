/**
 * Regressão — Editor de e-mail perdia edição não salva ao trocar de aba do
 * admin (não só ao fechar o navegador).
 *
 * Bug original (auditoria de agosto/2026):
 *   `EmailTemplateEditor.tsx` já protegia contra perda de dados ao trocar de
 *   template, trocar o filtro de tipo, ou fechar/recarregar a aba do
 *   navegador (`beforeunload`) — mas `EmailConfig.tsx` trocava de aba do
 *   admin via `<Tabs onValueChange={setActiveTab}>` direto, sem checar
 *   `editorDirty`. Como o Radix `TabsContent` desmonta o conteúdo inativo,
 *   editar um bloco sem salvar e clicar em "Dashboard" (ou qualquer outra
 *   aba) apagava a edição silenciosamente ao voltar para "Editor + Preview".
 *
 * Correção:
 *   `EmailConfig.tsx` passou a usar um `handleTabChange` que confirma antes
 *   de sair da aba "editor" quando `editorDirty` é true, reaproveitando o
 *   mesmo padrão de `confirm()` já usado dentro do próprio editor.
 *
 * Este teste é estático (sem render): lê o código-fonte e garante que a
 * troca de aba do admin continua guardada por `editorDirty`.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — Editor de e-mail não perde mais edição ao trocar de aba do admin', () => {
  it('Tabs não usa mais setActiveTab direto no onValueChange', () => {
    const src = read('src/pages/admin/EmailConfig.tsx');
    expect(
      src,
      'onValueChange voltou a chamar setActiveTab diretamente — isso REINTRODUZ a perda ' +
        'silenciosa de edição não salva no Editor ao trocar de aba do admin.'
    ).not.toMatch(/onValueChange=\{setActiveTab\}/);
    expect(src).toMatch(/onValueChange=\{handleTabChange\}/);
  });

  it('handleTabChange checa editorDirty e confirma antes de sair da aba editor', () => {
    const src = read('src/pages/admin/EmailConfig.tsx');
    const fnBlock = src.slice(
      src.indexOf('const handleTabChange'),
      src.indexOf('setActiveTab(nextTab);')
    );
    expect(fnBlock).toMatch(/editorDirty/);
    expect(fnBlock).toMatch(/confirm\(/);
    expect(fnBlock).toMatch(/activeTab === 'editor'/);
  });
});
