// Cliente HTTP mínimo para a API v3 da E-goi, compartilhado entre
// create-event-email-campaign e send-scheduled-email-campaigns — ambos
// precisam da MESMA lógica defensiva de "isso realmente foi enviado?"
// (regressões R-004/R-007/R-008, ver docs/TESTING.md) e não podem divergir.

export const EGOI_BASE_URL = "https://api.egoiapp.com";

export async function egoiRequest(
  path: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<{ status: number; ok: boolean; body: any }> {
  const res = await fetch(`${EGOI_BASE_URL}${path}`, {
    ...init,
    headers: {
      Apikey: apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep raw
  }
  return { status: res.status, ok: res.ok, body };
}

/**
 * R-007/R-008: um status HTTP 2xx sozinho não basta — a E-goi pode responder
 * 2xx com um corpo que ainda indica erro/pendência. Nunca marcar uma
 * campanha como "sent" sem checar isso primeiro.
 */
export function egoiSendBodyIndicatesError(body: unknown): boolean {
  return !!(
    body &&
    typeof body === "object" &&
    ((body as any).error || (body as any).errors || (body as any).status === "error")
  );
}

/**
 * Dispara uma campanha E-goi recém-criada via POST .../actions/send.
 * Retorna { ok: true } apenas se o corpo da resposta não indicar erro.
 */
export async function sendEgoiCampaign(
  campaignHash: string,
  listId: number,
  apiKey: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await egoiRequest(
    `/campaigns/email/${encodeURIComponent(campaignHash)}/actions/send`,
    apiKey,
    { method: "POST", body: JSON.stringify({ list_id: listId }) },
  );
  return {
    ok: res.ok && !egoiSendBodyIndicatesError(res.body),
    status: res.status,
    body: res.body,
  };
}
