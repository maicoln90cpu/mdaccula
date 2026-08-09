/**
 * Melhoria — Editor + Preview: fricção do dia a dia (Fase 15 da auditoria
 * de agosto/2026).
 *
 * 1) Bloco recém-adicionado é selecionado automaticamente (antes o admin
 *    precisava procurar na lista à esquerda pra editar).
 * 2) Undo/redo (Ctrl+Z / Ctrl+Shift+Z + botões) pra mudanças estruturais
 *    na lista de blocos (adicionar/remover/duplicar/reordenar/desfazer
 *    vínculo) — antes remover ou duplicar por engano não tinha volta.
 * 3) Campo de busca no seletor "Simular com evento real" (até 500 eventos
 *    carregados sem filtro antes) — extraído pro componente compartilhado
 *    RealEventSelect, usado tanto no Editor quanto na aba Template (marca).
 *
 * Teste estático (sem render): garante que as três peças continuam
 * presentes.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Melhoria — bloco recém-adicionado é auto-selecionado', () => {
  it('addBlock() chama setSelectedBlockId com o id do bloco criado', () => {
    const src = read('src/components/admin/EmailTemplateEditor.tsx');
    const fnBlock = src.slice(src.indexOf('const addBlock ='), src.indexOf('const removeBlock ='));
    expect(fnBlock).toMatch(/setSelectedBlockId\(created\.id\)/);
  });
});

describe('Melhoria — undo/redo de mudanças estruturais no editor de blocos', () => {
  it('EmailTemplateEditor.tsx tem applyBlocksChange/undoBlocks/redoBlocks conectados às operações estruturais', () => {
    const src = read('src/components/admin/EmailTemplateEditor.tsx');
    expect(src).toMatch(/const applyBlocksChange/);
    expect(src).toMatch(/const undoBlocks/);
    expect(src).toMatch(/const redoBlocks/);
    // addBlock, removeBlock, duplicateBlock e replaceBlock usam applyBlocksChange
    expect((src.match(/applyBlocksChange\(/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('atalho de teclado Ctrl/Cmd+Z não intercepta foco em input/textarea', () => {
    const src = read('src/components/admin/EmailTemplateEditor.tsx');
    expect(src).toMatch(/tag === 'INPUT' \|\| tag === 'TEXTAREA' \|\| target\?\.isContentEditable/);
  });

  it('BlockListPanel.tsx recebe canUndo/canRedo/onUndo/onRedo e renderiza os botões', () => {
    const src = read('src/components/admin/emailTemplateEditor/BlockListPanel.tsx');
    expect(src).toMatch(/canUndo/);
    expect(src).toMatch(/canRedo/);
    expect(src).toMatch(/Undo2/);
    expect(src).toMatch(/Redo2/);
  });
});

describe('Melhoria — busca no seletor "Simular com evento real"', () => {
  it('RealEventSelect.tsx filtra os eventos por título quando há busca', () => {
    const src = read('src/components/admin/emailConfig/RealEventSelect.tsx');
    expect(src).toMatch(/events\.filter\(\(e\) => norm\(e\.title\)\.includes\(q\)\)/);
  });

  it('TemplateEditorTab.tsx e TemplateBrandTab.tsx usam o mesmo RealEventSelect (não duplicam a lógica)', () => {
    const editorSrc = read('src/components/admin/emailConfig/TemplateEditorTab.tsx');
    const brandSrc = read('src/components/admin/emailConfig/TemplateBrandTab.tsx');
    expect(editorSrc).toMatch(/<RealEventSelect/);
    expect(brandSrc).toMatch(/<RealEventSelect/);
  });
});
