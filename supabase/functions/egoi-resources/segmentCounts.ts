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
 * (ContactCollection) — uma chamada por segmento, com limit=1 pra não
 * baixar a lista de contatos inteira. O SDK javascript oficial documenta o
 * campo como `totalItems` (camelCase, artefato do gerador de código a
 * partir do OpenAPI), mas a resposta HTTP real usa `total_items`
 * (snake_case, confirmado ao vivo em produção em 2026-08-09) — igual a
 * todo o resto da API E-goi.
 */

export type SegmentRaw = { segment_id: number | string | undefined; name: string };
export type SegmentWithCount = SegmentRaw & { total_contacts: number | null };

export async function mapSegmentsWithCounts(
  segments: SegmentRaw[],
  fetchContactCount: (segmentId: number | string) => Promise<{ total_items?: number } | undefined>,
): Promise<SegmentWithCount[]> {
  return Promise.all(
    segments.map(async (s) => {
      if (!s.segment_id) return { ...s, total_contacts: null };
      const body = await fetchContactCount(s.segment_id);
      const total_contacts = typeof body?.total_items === 'number' ? body.total_items : null;
      return { ...s, total_contacts };
    }),
  );
}
