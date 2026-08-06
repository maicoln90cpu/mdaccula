/**
 * Regressão — mapa estático não atualiza quando o endereço do evento muda.
 *
 * Bug original (agosto/2026):
 *   `events.latitude/longitude` (colunas usadas pela chave de cache do mapa
 *   estático de e-mail) só eram preenchidas uma vez, na primeira geocodificação
 *   reativa. Editar `venue`/`location_city`/`location_state` no admin não
 *   disparava nenhuma re-geocodificação — o mapa continuava mostrando o
 *   endereço antigo indefinidamente, mesmo depois de o admin corrigir o local
 *   do evento.
 *
 * Correção:
 *   `useEventFormSubmit` detecta mudança de endereço no branch de edição e
 *   chama `geocode-event` com `force: true` (fire-and-forget) logo após o
 *   update — isso sobrescreve latitude/longitude, o que muda a chave de cache
 *   do mapa (`buildMapPath`) e força a geração de uma imagem nova na próxima
 *   renderização.
 *
 * Este teste é estático (sem rede): garante que a chamada de re-geocode
 * continua presente, condicionada à mudança de endereço, e usa force: true.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — re-geocode automático quando o endereço do evento muda', () => {
  it('useEventFormSubmit detecta mudança de venue/location_city/location_state e força re-geocode', () => {
    const src = read('src/components/events/eventForm/useEventFormSubmit.tsx');

    const addressChangedIndex = src.indexOf('addressChanged');
    expect(
      addressChangedIndex,
      'Não encontrei a detecção de mudança de endereço (addressChanged) em useEventFormSubmit.tsx. ' +
        'Sem isso, editar o endereço do evento não atualiza o mapa estático de e-mail. ' +
        'Veja docs/TESTING.md → Regressões cobertas.'
    ).toBeGreaterThan(-1);

    expect(src).toMatch(/addressChanged[\s\S]*?venue[\s\S]*?location_city[\s\S]*?location_state/);

    const geocodeCallIndex = src.indexOf("invoke('geocode-event'");
    expect(
      geocodeCallIndex,
      'Não encontrei a chamada a geocode-event em useEventFormSubmit.tsx.'
    ).toBeGreaterThan(-1);
    expect(geocodeCallIndex).toBeGreaterThan(addressChangedIndex);

    // Precisa ser force:true — sem isso, geocode-event é idempotente e não
    // re-geocodifica um evento que já tinha coordenadas.
    const callSnippet = src.slice(geocodeCallIndex, geocodeCallIndex + 200);
    expect(callSnippet).toMatch(/force:\s*true/);
  });
});
