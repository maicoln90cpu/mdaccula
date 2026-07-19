/**
 * `supabase.functions.invoke()` nunca expõe a mensagem de erro custom de uma
 * Edge Function (ex.: `jsonError("Nenhuma fonte real encontrada...", 404)`) em
 * `error.message` — em resposta não-2xx, o SDK lança `FunctionsHttpError` cujo
 * `.context` é o `Response` bruto, e a mensagem real só existe no corpo JSON
 * dele. Sem isso, o admin sempre via um toast genérico ("Erro ao gerar
 * artigo") mesmo quando o backend já explicava o problema com clareza.
 */
export async function getEdgeFunctionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context && typeof context === "object" && typeof (context as Response).json === "function") {
      try {
        const body = await (context as Response).json();
        if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
          return (body as { error: string }).error;
        }
      } catch {
        // Corpo não era JSON (ou já foi consumido) — cai pro fallback abaixo.
      }
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Erro desconhecido";
}
