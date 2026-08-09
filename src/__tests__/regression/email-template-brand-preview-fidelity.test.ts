/**
 * Melhoria — Template (marca): fidelidade do preview (Fase 14 da auditoria
 * de agosto/2026).
 *
 * 1) Seletor "Simular com evento real" também nesta aba (antes só existia
 *    no Editor + Preview) — usa o mesmo estado compartilhado
 *    (selectedRealEventId/realEvents) vindo de useEmailPreview, então
 *    simular um evento em qualquer uma das duas abas afeta as duas.
 * 2) Toggle mobile/desktop no preview (antes fixo em largura de desktop).
 * 3) Aviso de contraste insuficiente (WCAG) ao escolher cores da marca,
 *    usando src/lib/colorContrast.ts (testado isoladamente em
 *    src/__tests__/lib/colorContrast.test.ts).
 *
 * Teste estático (sem render): garante que as três peças continuam
 * presentes e conectadas.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Melhoria — "Simular com evento real" também na aba Template (marca)', () => {
  it('TemplateBrandTab.tsx recebe e usa selectedRealEventId/realEvents', () => {
    const src = read('src/components/admin/emailConfig/TemplateBrandTab.tsx');
    expect(src).toMatch(/selectedRealEventId/);
    // A partir da Fase 15, o Select em si foi extraído pro componente
    // compartilhado RealEventSelect (ver email-editor-block-friction.test.ts)
    // — aqui só garantimos que os dados continuam sendo repassados pra ele.
    expect(src).toMatch(/<RealEventSelect/);
    expect(src).toMatch(/events=\{realEvents\}/);
  });

  it('EmailConfig.tsx passa o mesmo estado compartilhado (não uma cópia própria)', () => {
    const src = read('src/pages/admin/EmailConfig.tsx');
    const templateBrandTabBlock = src.slice(
      src.indexOf('<TemplateBrandTab'),
      src.indexOf('/>', src.indexOf('<TemplateBrandTab'))
    );
    expect(templateBrandTabBlock).toMatch(/selectedRealEventId=\{selectedRealEventId\}/);
    expect(templateBrandTabBlock).toMatch(/realEvents=\{realEvents\}/);
  });
});

describe('Melhoria — toggle mobile/desktop no preview de Template (marca)', () => {
  it('TemplateBrandTab.tsx alterna a largura do iframe entre mobile e desktop', () => {
    const src = read('src/components/admin/emailConfig/TemplateBrandTab.tsx');
    expect(src).toMatch(/viewport === 'mobile' \? 'max-w-\[390px\]' : 'max-w-\[640px\]'/);
  });
});

describe('Melhoria — aviso de contraste insuficiente nas cores da marca', () => {
  it('TemplateBrandTab.tsx calcula o contraste de cada cor contra o fundo e avisa se baixo', () => {
    const src = read('src/components/admin/emailConfig/TemplateBrandTab.tsx');
    expect(src).toMatch(/from '@\/lib\/colorContrast'/);
    expect(src).toMatch(/MIN_CONTRAST_AGAINST_BACKGROUND = 3/);
    expect(src).toMatch(/lowContrast &&/);
  });
});
