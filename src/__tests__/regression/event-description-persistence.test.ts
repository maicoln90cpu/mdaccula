/**
 * Regressão R-001 — "Descrição do evento some no modal e no slug"
 *
 * Bug original (junho/2026):
 *   Ao editar/criar um evento com descrição, o dado era salvo no banco
 *   corretamente, mas sumia ao abrir o EventModal em /eventos e a página
 *   /eventos/:slug não mostrava nada no bloco "Sobre o evento".
 *
 * Causa raiz:
 *   `useEvents.ts` e `EventDetail.tsx` faziam `.select("...colunas...")`
 *   com string literal e esqueceram colunas (description, subtitle,
 *   schedule, end_date, pix_button_enabled, tickets_per_day).
 *
 * Correção definitiva:
 *   - src/lib/eventSelectFields.ts (fonte única) com EVENT_PUBLIC_FIELDS.
 *   - useEvents.ts e EventDetail.tsx passam a usar a constante.
 *
 * Proteção em camadas (este teste é a 3ª camada):
 *   1. src/__tests__/lib/eventSelectFields.test.ts
 *      → garante que a constante contém todos os campos obrigatórios.
 *   2. src/__tests__/architecture/event-select-fields.test.ts
 *      → guard estático: proíbe string literal em `.from("events").select(...)`.
 *   3. ESTE arquivo
 *      → resumo executivo + lista canônica de "campos do bug original".
 *        Se um deles sair da constante, o erro vermelho cita o nome do
 *        bug e o caminho do arquivo de origem.
 *
 * Como age:
 *   Falha cedo, com mensagem que aponta diretamente para a regressão R-001
 *   no docs/TESTING.md. Sem rede, sem flake.
 */
import { describe, it, expect } from 'vitest';
import { EVENT_PUBLIC_FIELDS } from '@/lib/eventSelectFields';

// Campos cuja AUSÊNCIA reproduz o bug original. Lista CONGELADA — só cresce.
const FIELDS_THAT_TRIGGERED_THE_BUG = [
  'description',
  'subtitle',
  'schedule',
  'end_date',
  'pix_button_enabled',
  'tickets_per_day',
] as const;

describe('Regressão R-001 — descrição/subtitle do evento não somem da UI', () => {
  for (const field of FIELDS_THAT_TRIGGERED_THE_BUG) {
    it(`EVENT_PUBLIC_FIELDS contém "${field}" (bug original sumia daqui)`, () => {
      expect(
        EVENT_PUBLIC_FIELDS.includes(field),
        `O campo "${field}" foi removido de EVENT_PUBLIC_FIELDS. ` +
          `Isso REINTRODUZ a regressão R-001 (descrição/subtitle/horário some no modal e no slug). ` +
          `Veja docs/TESTING.md → seção "Regressões cobertas".`
      ).toBe(true);
    });
  }
});
