/**
 * Fonte única do link de WhatsApp do botão "Comprar Sem Taxa via Pix".
 *
 * Reaproveita o número de WhatsApp já cadastrado em `vip_link` (usado pro
 * botão "Reservas de Camarote"), só troca a mensagem — evita cadastrar um
 * segundo número/link só pro Pix. A saudação varia conforme o número (Gui
 * vs MD), replicando o comportamento que já existia no site.
 *
 * Usado tanto pelo frontend (EventDetail.tsx, via alias `@shared/pixWhatsAppLink.ts`)
 * quanto pelo composer de e-mail (`emailComposer.ts`), pra garantir que o
 * botão de Pix no e-mail seja idêntico ao do site.
 */

const GUI_PHONE = "5511997819194";

export function buildPixWhatsAppLink(
  vipLink: string | null | undefined,
  eventTitle: string
): string | null {
  if (!vipLink) return null;
  try {
    const url = new URL(vipLink);
    const phone = url.searchParams.get("phone");
    if (!phone) return null;
    const greeting = phone.includes(GUI_PHONE) ? "Olá Gui" : "Olá MD";
    const message = `${greeting}, quero comprar ingresso sem taxa via Pix para ${eventTitle}`;
    url.searchParams.set("text", message);
    return url.toString();
  } catch {
    return null;
  }
}
