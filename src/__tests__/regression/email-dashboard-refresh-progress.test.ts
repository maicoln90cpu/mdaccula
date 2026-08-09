/**
 * Melhoria — contador de progresso no botão "Atualizar métricas do
 * período" (Fase 12 da auditoria de agosto/2026).
 *
 * Antes o botão só mostrava um spinner genérico enquanto refreshAll()
 * processava campanha por campanha (com um soft rate-limit de 400ms entre
 * chamadas) — em períodos longos, com muitas campanhas, isso podia levar
 * minutos sem qualquer indicação de progresso. Agora o botão mostra
 * "Atualizando... X/Y".
 *
 * Teste estático (sem render): garante que o estado de progresso é
 * incrementado a cada campanha processada e refletido no label do botão.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Melhoria — Dashboard mostra progresso X/Y ao atualizar métricas', () => {
  it('refreshAll incrementa refreshProgress.done a cada campanha processada', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    expect(src).toMatch(/setRefreshProgress\(\{ done: 0, total: targets\.length \}\)/);
    expect(src).toMatch(/setRefreshProgress\(\(prev\) => \(prev \? \{ \.\.\.prev, done: prev\.done \+ 1 \} : prev\)\)/);
  });

  it('o label do botão mostra "Atualizando... X/Y" durante o refresh', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    expect(src).toMatch(/Atualizando\.\.\. \$\{refreshProgress\?\.done/);
  });
});
