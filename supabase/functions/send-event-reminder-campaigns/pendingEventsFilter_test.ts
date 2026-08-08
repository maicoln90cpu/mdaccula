import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { filterPendingReminderEvents, MAX_EVENT_REMINDER_ATTEMPTS } from './pendingEventsFilter.ts';

Deno.test('filterPendingReminderEvents: sem histórico, todos os candidatos ficam pendentes', () => {
  const candidates = [{ id: 'e1' }, { id: 'e2' }];
  const result = filterPendingReminderEvents(candidates, []);
  assertEquals(result, candidates);
});

Deno.test('filterPendingReminderEvents: evento com linha "sent" é excluído', () => {
  const candidates = [{ id: 'e1' }, { id: 'e2' }];
  const result = filterPendingReminderEvents(candidates, [{ event_id: 'e1', status: 'sent' }]);
  assertEquals(result, [{ id: 'e2' }]);
});

Deno.test('filterPendingReminderEvents: evento com linha "draft" é excluído (já processado, mesmo sem enviar)', () => {
  const candidates = [{ id: 'e1' }];
  const result = filterPendingReminderEvents(candidates, [{ event_id: 'e1', status: 'draft' }]);
  assertEquals(result, []);
});

Deno.test('filterPendingReminderEvents: 1 falha ainda deixa o evento pendente pra retry', () => {
  const candidates = [{ id: 'e1' }];
  const result = filterPendingReminderEvents(candidates, [{ event_id: 'e1', status: 'failed' }]);
  assertEquals(result, candidates);
});

Deno.test(
  `filterPendingReminderEvents: ${MAX_EVENT_REMINDER_ATTEMPTS} falhas esgotam as tentativas (regressão: attempts nunca era incrementado, então sem contar linhas o retry era infinito)`,
  () => {
    const candidates = [{ id: 'e1' }];
    const existingRows = Array.from({ length: MAX_EVENT_REMINDER_ATTEMPTS }, () => ({
      event_id: 'e1',
      status: 'failed',
    }));
    const result = filterPendingReminderEvents(candidates, existingRows);
    assertEquals(result, []);
  },
);

Deno.test('filterPendingReminderEvents: maxAttempts custom é respeitado', () => {
  const candidates = [{ id: 'e1' }];
  const existingRows = [
    { event_id: 'e1', status: 'failed' },
    { event_id: 'e1', status: 'failed' },
  ];
  assertEquals(filterPendingReminderEvents(candidates, existingRows, 2), []);
  assertEquals(filterPendingReminderEvents(candidates, existingRows, 3), candidates);
});

Deno.test('filterPendingReminderEvents: eventos diferentes têm históricos independentes', () => {
  const candidates = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];
  const existingRows = [
    { event_id: 'e1', status: 'sent' },
    { event_id: 'e2', status: 'failed' },
    { event_id: 'e2', status: 'failed' },
    { event_id: 'e2', status: 'failed' },
  ];
  const result = filterPendingReminderEvents(candidates, existingRows);
  assertEquals(result, [{ id: 'e3' }]);
});
