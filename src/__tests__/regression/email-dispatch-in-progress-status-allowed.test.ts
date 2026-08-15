/**
 * R-062 — o novo estado intermediário 'in_progress' de event_email_campaigns
 * (gravado ANTES de qualquer chamada à E-goi, ver _shared/emailDispatchHistory.ts)
 * só funciona se o banco de fato aceitar esse valor na coluna `status`. Sem a
 * migration correspondente, o INSERT/UPDATE da Fase 1 falharia com violação de
 * CHECK constraint em toda produção — silenciosamente reproduzindo o próprio
 * sintoma que essa correção existe para eliminar.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

function readAllMigrations(): string {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  return files.map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8')).join('\n');
}

describe("Regressão R-062 — status 'in_progress' aceito pela constraint de event_email_campaigns", () => {
  it('existe uma migration que adiciona "in_progress" à CHECK constraint de status', () => {
    const combined = readAllMigrations();
    expect(
      combined,
      'Nenhuma migration referencia event_email_campaigns_status_check junto com "in_progress" — ' +
        'sem isso, gravar status: "in_progress" falha com violação de CHECK constraint em produção.'
    ).toMatch(/event_email_campaigns_status_check[\s\S]{0,400}in_progress/);
  });

  it('a definição original da tabela em docs/tabelas.md também reflete o novo valor permitido', () => {
    const tabelas = fs.readFileSync(path.join(process.cwd(), 'docs', 'tabelas.md'), 'utf-8');
    const idx = tabelas.indexOf('CREATE TABLE public.event_email_campaigns');
    expect(idx, 'Não encontrei o DDL de event_email_campaigns em docs/tabelas.md.').toBeGreaterThan(-1);
    const block = tabelas.slice(idx, idx + 1200);
    expect(
      block,
      'docs/tabelas.md precisa refletir "in_progress" na CHECK de status, senão a documentação fica ' +
        'desatualizada em relação ao schema real (regra do CLAUDE.md).'
    ).toMatch(/status TEXT NOT NULL DEFAULT 'draft' CHECK \(status IN \([^)]*in_progress/);
  });
});
