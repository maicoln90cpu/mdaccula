/**
 * Guardrail de generate-blog-post-v2: quando um template de categoria Eventos/
 * Festivais é usado sem nenhum dado real por trás (ex.: admin escolhe "Raspagem
 * de Eventos" na aba Gerar e digita só o nome), exigir uma busca real antes de
 * gerar — em vez de deixar a IA inventar lineup/local/horário (ver R-018 em
 * docs/TESTING.md).
 */
export function shouldRequireSourceVerification(isEventMode: boolean, hasEventSignals: boolean): boolean {
  return isEventMode && !hasEventSignals;
}

export function buildGuardrailSearchQuery(eventName: string, eventLocation?: string): string {
  return [eventName, eventLocation].filter(Boolean).join(' ').trim();
}
