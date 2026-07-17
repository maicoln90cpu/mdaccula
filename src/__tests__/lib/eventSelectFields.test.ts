import { describe, it, expect } from 'vitest';
import { EVENT_PUBLIC_FIELDS, EVENT_REQUIRED_FIELDS } from '@/lib/eventSelectFields';

/**
 * Teste de regressão do bug "descrição salva mas não aparece no modal/slug".
 *
 * Causa raiz original: SELECTs no frontend esqueceram a coluna `description`.
 * Esta proteção garante que ninguém remova campos críticos da fonte única.
 */
describe('EVENT_PUBLIC_FIELDS — fonte única de campos do SELECT de events', () => {
  const fields = EVENT_PUBLIC_FIELDS.split(',').map(f => f.trim());

  it('contém todos os campos obrigatórios para renderização pública', () => {
    for (const required of EVENT_REQUIRED_FIELDS) {
      expect(fields, `campo "${required}" faltando em EVENT_PUBLIC_FIELDS`).toContain(required);
    }
  });

  it('inclui description (regressão: bug do modal/slug vazio)', () => {
    expect(fields).toContain('description');
  });

  it('inclui subtitle (regressão: subtítulo somia em /eventos/:slug)', () => {
    expect(fields).toContain('subtitle');
  });

  it('inclui schedule e end_date (festivais multi-dia)', () => {
    expect(fields).toContain('schedule');
    expect(fields).toContain('end_date');
  });

  it('inclui flags pix_button_enabled e tickets_per_day', () => {
    expect(fields).toContain('pix_button_enabled');
    expect(fields).toContain('tickets_per_day');
  });

  it('inclui cta_type (regressão: botão do evento não configurável)', () => {
    expect(fields).toContain('cta_type');
  });

  it('não tem campos duplicados', () => {
    const unique = new Set(fields);
    expect(unique.size).toBe(fields.length);
  });

  it('não inclui colunas internas/sensíveis', () => {
    expect(fields).not.toContain('created_by');
    expect(fields).not.toContain('merged_into_id');
    expect(fields).not.toContain('merged_at');
  });
});
