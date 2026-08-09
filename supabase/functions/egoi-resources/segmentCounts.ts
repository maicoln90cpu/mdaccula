/**
 * Resolve a contagem real de contatos de cada segmento de uma lista E-goi.
 *
 * O objeto "Segment" retornado por GET /lists/{id}/segments NUNCA inclui uma
 * contagem de contatos — confirmado contra o SDK oficial
 * (github.com/E-goi/sdk-javascript, docs/Segment.md: só type, segmentId,
 * name, created, updated, segmentFilter). Antes disso, o código tentava
 * adivinhar 4 nomes de campo diferentes na resposta de /segments e sempre
 * caía em `null` — por isso "Alcance estimado" nunca mostrava um número
 * pra segmento nenhum.
 *
 * O total real vem de GET /lists/{id}/contacts/segment/{segmentId}
 * (ContactCollection, campo totalItems) — uma chamada por segmento, com
 * limit=1 pra não baixar a lista de contatos inteira.
 */

export type SegmentRaw = { segment_id: number | string | undefined; name: string };
export type SegmentWithCount = SegmentRaw & { total_contacts: number | null };

export async function mapSegmentsWithCounts(
  segments: SegmentRaw[],
  fetchContactCount: (segmentId: number | string) => Promise<{ totalItems?: number } | undefined>,
): Promise<SegmentWithCount[]> {
  return Promise.all(
    segments.map(async (s) => {
      if (!s.segment_id) return { ...s, total_contacts: null };
      const body = await fetchContactCount(s.segment_id);
      const total_contacts = typeof body?.totalItems === 'number' ? body.totalItems : null;
      return { ...s, total_contacts };
    }),
  );
}
