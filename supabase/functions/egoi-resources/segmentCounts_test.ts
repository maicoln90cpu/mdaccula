// Regressão: "Alcance estimado" ficava sempre em "—" ao escolher um
// segmento específico, porque o código tentava adivinhar o campo de
// contagem na resposta de GET /lists/{id}/segments (total_contacts,
// contacts_count, contacts, total) — mas o objeto "Segment" da E-goi
// nunca tem contagem nenhuma (confirmado no SDK oficial). O total real só
// existe em GET /lists/{id}/contacts/segment/{segmentId} (campo totalItems).
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { mapSegmentsWithCounts } from './segmentCounts.ts';

Deno.test('mapSegmentsWithCounts usa totalItems da resposta de contatos por segmento', async () => {
  const segments = [
    { segment_id: 10, name: 'VIP' },
    { segment_id: 20, name: 'Novos contatos' },
  ];
  const result = await mapSegmentsWithCounts(segments, async (segmentId) => {
    if (segmentId === 10) return { totalItems: 342 };
    if (segmentId === 20) return { totalItems: 15 };
    return undefined;
  });
  assertEquals(result, [
    { segment_id: 10, name: 'VIP', total_contacts: 342 },
    { segment_id: 20, name: 'Novos contatos', total_contacts: 15 },
  ]);
});

Deno.test('mapSegmentsWithCounts retorna null quando a chamada de contagem falha/vem vazia', async () => {
  const segments = [{ segment_id: 30, name: 'Sem dados' }];
  const result = await mapSegmentsWithCounts(segments, async () => undefined);
  assertEquals(result[0].total_contacts, null);
});

Deno.test('mapSegmentsWithCounts não chama fetchContactCount pra segmento sem id', async () => {
  const segments = [{ segment_id: undefined, name: 'Inválido' }];
  let called = false;
  const result = await mapSegmentsWithCounts(segments, async () => {
    called = true;
    return { totalItems: 1 };
  });
  assertEquals(called, false);
  assertEquals(result[0].total_contacts, null);
});
