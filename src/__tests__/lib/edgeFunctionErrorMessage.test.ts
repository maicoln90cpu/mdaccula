import { describe, it, expect } from "vitest";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionErrorMessage";

function makeFunctionsHttpError(body: unknown, message = "Edge Function returned a non-2xx status code"): Error {
  const error = new Error(message);
  error.name = "FunctionsHttpError";
  (error as Error & { context: Response }).context = new Response(JSON.stringify(body), { status: 404 });
  return error;
}

describe("getEdgeFunctionErrorMessage", () => {
  it("extrai a mensagem real do corpo JSON de um FunctionsHttpError", async () => {
    const error = makeFunctionsHttpError({ error: 'Nenhuma fonte real encontrada para "a liga".', success: false });
    await expect(getEdgeFunctionErrorMessage(error)).resolves.toBe('Nenhuma fonte real encontrada para "a liga".');
  });

  it("cai pro error.message quando o context não tem corpo JSON válido", async () => {
    const error = new Error("mensagem genérica do SDK");
    (error as Error & { context: Response }).context = new Response("não é json", { status: 500 });
    await expect(getEdgeFunctionErrorMessage(error)).resolves.toBe("mensagem genérica do SDK");
  });

  it("cai pro error.message quando não há context (Error comum)", async () => {
    await expect(getEdgeFunctionErrorMessage(new Error("falha de rede"))).resolves.toBe("falha de rede");
  });

  it("retorna 'Erro desconhecido' quando não é Error nem tem context", async () => {
    await expect(getEdgeFunctionErrorMessage("string qualquer")).resolves.toBe("Erro desconhecido");
    await expect(getEdgeFunctionErrorMessage(null)).resolves.toBe("Erro desconhecido");
  });

  it("ignora corpo JSON sem campo error string", async () => {
    const error = makeFunctionsHttpError({ success: false });
    await expect(getEdgeFunctionErrorMessage(error)).resolves.toBe(
      "Edge Function returned a non-2xx status code"
    );
  });
});
