/**
 * 15/08/2026 — depois de rotacionar os segredos de cron (repositório ficou
 * público), o mesmo tipo de rotação foi aplicada à chave do Google Maps.
 * `render-static-map` e `geocode-event` chamavam o Google via
 * `connector-gateway.lovable.dev/google_maps` (usando `LOVABLE_API_KEY` +
 * `GOOGLE_MAPS_API_KEY` como um par de credenciais reconhecido internamente
 * pelo Lovable) — trocar só o `GOOGLE_MAPS_API_KEY` por uma chave nova do
 * Google Cloud quebrou essa chamada em produção (`401 Credential not found`,
 * confirmado ao vivo), porque o gateway espera uma referência de credencial
 * própria dele, não uma chave crua do Google repassada por cima.
 *
 * Corrigido chamando a API do Google diretamente (`maps.googleapis.com`) com
 * a chave própria, sem depender do gateway do Lovable nem do `LOVABLE_API_KEY`
 * — testado direto contra o Google antes do deploy (Static Maps e Geocoding,
 * ambas 200/OK) e confirmado com a restrição de app da chave em "Nenhuma"
 * (a Geocoding API rejeita chave com restrição de referrer).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — render-static-map e geocode-event chamam o Google direto, sem o gateway do Lovable', () => {
  it('render-static-map: não depende mais do gateway nem de LOVABLE_API_KEY como credencial (só pode citar isso em comentário histórico)', () => {
    const src = read('supabase/functions/render-static-map/index.ts');
    expect(src).not.toMatch(/const GATEWAY_URL/);
    expect(src).not.toMatch(/X-Connection-Api-Key/);
    expect(src).not.toMatch(/Deno\.env\.get\(['"]LOVABLE_API_KEY['"]\)/);
    expect(src).toMatch(/maps\.googleapis\.com\/maps\/api\/staticmap/);
  });

  it('render-static-map: passa a chave via query param "key" e tem timeout explícito no fetch pro Google', () => {
    const src = read('supabase/functions/render-static-map/index.ts');
    expect(src).toMatch(/searchParams\.set\(['"]key['"],\s*GOOGLE_MAPS_API_KEY\)/);
    expect(
      src,
      'Sem timeout, um fetch pendurado no Google trava a function inteira sem lançar exceção — mesma lição do R-057.'
    ).toMatch(/AbortSignal\.timeout\(GOOGLE_MAPS_REQUEST_TIMEOUT_MS\)/);
  });

  it('geocode-event: não depende mais do gateway nem de LOVABLE_API_KEY como credencial (só pode citar isso em comentário histórico)', () => {
    const src = read('supabase/functions/geocode-event/index.ts');
    expect(src).not.toMatch(/const GATEWAY_URL/);
    expect(src).not.toMatch(/X-Connection-Api-Key/);
    expect(src).not.toMatch(/Deno\.env\.get\(['"]LOVABLE_API_KEY['"]\)/);
    expect(src).toMatch(/maps\.googleapis\.com\/maps\/api\/geocode\/json/);
  });

  it('geocode-event: passa a chave via query param "key" e tem timeout explícito no fetch pro Google', () => {
    const src = read('supabase/functions/geocode-event/index.ts');
    expect(src).toMatch(/searchParams\.set\(['"]key['"],\s*GOOGLE_MAPS_API_KEY\)/);
    expect(src).toMatch(/AbortSignal\.timeout\(GOOGLE_MAPS_REQUEST_TIMEOUT_MS\)/);
  });
});
