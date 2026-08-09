/**
 * Melhoria — Envio manual: clareza no disparo (Fase 16 da auditoria de
 * agosto/2026).
 *
 * 1) Badge grande e visível do segmento/contagem de destinatários perto do
 *    botão "Enviar agora" (antes era só um texto pequeno dentro de
 *    "Revisão final").
 * 2) Contador de caracteres no campo "Assunto desta virada" (assuntos
 *    longos cortam em apps de e-mail).
 * 3) Terminologia padronizada entre abas: "Criar rascunho na E-goi" (antes
 *    "Gerar rascunho agora" no card de automação, para a MESMA ação de
 *    criar um rascunho de campanha na E-goi).
 *
 * Teste estático (sem render): garante que as três peças continuam
 * presentes.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Melhoria — badge de segmento/contagem visível perto do envio', () => {
  it('ManualSendTab.tsx mostra "Enviando para" com o segmento resolvido antes dos botões', () => {
    const src = read('src/components/admin/emailConfig/ManualSendTab.tsx');
    expect(src).toMatch(/Enviando para:/);
    expect(src).toMatch(/\{resolvedSegmentLabel\}/);
  });
});

describe('Melhoria — contador de caracteres no assunto da virada', () => {
  it('ManualSendTab.tsx mostra a contagem e avisa acima de 60 caracteres', () => {
    const src = read('src/components/admin/emailConfig/ManualSendTab.tsx');
    expect(src).toMatch(/\{batchSubject\.length\} caracteres/);
    expect(src).toMatch(/batchSubject\.length > 60/);
  });
});

describe('Melhoria — terminologia padronizada entre Envio manual e Automações', () => {
  it('AutomationCard.tsx usa "Criar rascunho na E-goi" (mesma ação que o Envio manual)', () => {
    const src = read('src/components/admin/emailConfig/automations/AutomationCard.tsx');
    expect(
      src,
      'AutomationCard.tsx voltou a usar "Gerar rascunho agora" para a mesma ação que o Envio ' +
        'manual chama de "Criar rascunho na E-goi" — isso REINTRODUZ a inconsistência de copy ' +
        'entre abas para a mesma operação.'
    ).not.toMatch(/Gerar rascunho agora/);
    expect(src).toMatch(/Criar rascunho na E-goi/);
  });

  it('ManualSendTab.tsx continua usando o mesmo rótulo', () => {
    const src = read('src/components/admin/emailConfig/ManualSendTab.tsx');
    expect(src).toMatch(/Criar rascunho na E-goi/);
  });
});
