/**
 * Decide se o scraping de contexto adicional (Firecrawl) deve rodar antes
 * da geração do artigo.
 *
 * Histórico: até jul/2026 essa checagem também exigia `!generateImage`,
 * resquício de quando a geração de imagem bloqueava a resposta de texto.
 * Como a imagem agora roda em background (`EdgeRuntime.waitUntil`), essa
 * condição pulava o scraping na maioria das gerações reais do admin (que
 * usam `generateWithImage=true` por padrão) — na prática o Firecrawl quase
 * nunca rodava. A assinatura abaixo deliberadamente NÃO recebe a flag de
 * imagem, para que essa regressão não possa voltar por acidente.
 */
export function shouldScrapeForContext(opts: {
  hasApiKey: boolean;
  remainingMs: number;
  minRemainingMs?: number;
}): boolean {
  const min = opts.minRemainingMs ?? 15000;
  return opts.hasApiKey && opts.remainingMs > min;
}
