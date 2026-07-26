/**
 * Geração de IDs únicos para blocos do editor de e-mail.
 * Extraído em Onda 26 para permitir reutilização entre `blocks.ts` e
 * `presetBuilders.ts` sem dependência circular.
 */
let blockCounter = Date.now();
export const newBlockId = () => `b${++blockCounter}`;
