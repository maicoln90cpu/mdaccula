/**
 * Trava genérica contra loaders de admin em loop infinito. Segunda camada de
 * defesa além dos testes de regressão que travam causas específicas já
 * corrigidas (ex.: email-automation-hydrate-callbacks-stable-identity) —
 * essa pega qualquer causa futura do mesmo sintoma: um loader disparando
 * repetidamente em vez de uma vez por mount, martelando egress real (páginas
 * /admin bypassam o cache do service worker por design).
 */
import { logger } from './logger';

export function createLoadGuard(label: string, opts: { maxCalls?: number; windowMs?: number } = {}) {
  const maxCalls = opts.maxCalls ?? 20;
  const windowMs = opts.windowMs ?? 10_000;
  const calls: number[] = [];

  return function guard(): void {
    const now = Date.now();
    while (calls.length > 0 && now - calls[0] > windowMs) {
      calls.shift();
    }
    calls.push(now);
    if (calls.length > maxCalls) {
      const msg = `[adminLoadGuard] "${label}" chamado ${calls.length}x em ${windowMs}ms — provável loop infinito, abortando.`;
      logger.error(msg);
      throw new Error(msg);
    }
  };
}
