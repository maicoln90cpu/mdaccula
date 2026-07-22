import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildPixWhatsAppLink } from "./pixWhatsAppLink.ts";

Deno.test("buildPixWhatsAppLink: saudação 'Olá Gui' quando o telefone é o do Gui", () => {
  const link = buildPixWhatsAppLink(
    "https://api.whatsapp.com/send?phone=5511997819194",
    "Evento Teste"
  );
  assertStringIncludes(decodeURIComponent(link!.replace(/\+/g, " ")), "Olá Gui");
  assertStringIncludes(link!, "phone=5511997819194");
});

Deno.test("buildPixWhatsAppLink: saudação 'Olá MD' para qualquer outro telefone", () => {
  const link = buildPixWhatsAppLink(
    "https://api.whatsapp.com/send?phone=5511999999999",
    "Evento Teste"
  );
  assertStringIncludes(decodeURIComponent(link!.replace(/\+/g, " ")), "Olá MD");
});

Deno.test("buildPixWhatsAppLink: inclui o título do evento na mensagem", () => {
  const link = buildPixWhatsAppLink(
    "https://api.whatsapp.com/send?phone=5511999999999",
    "NEON GARDEN"
  );
  const decoded = decodeURIComponent(link!.replace(/\+/g, " "));
  assertStringIncludes(decoded, "NEON GARDEN");
  assertStringIncludes(decoded, "comprar ingresso sem taxa via Pix");
});

Deno.test("buildPixWhatsAppLink: retorna null sem vip_link", () => {
  assertEquals(buildPixWhatsAppLink(null, "Evento"), null);
  assertEquals(buildPixWhatsAppLink(undefined, "Evento"), null);
  assertEquals(buildPixWhatsAppLink("", "Evento"), null);
});

Deno.test("buildPixWhatsAppLink: retorna null se vip_link não tem phone", () => {
  assertEquals(buildPixWhatsAppLink("https://api.whatsapp.com/send?text=oi", "Evento"), null);
});

Deno.test("buildPixWhatsAppLink: retorna null se vip_link é uma URL inválida", () => {
  assertEquals(buildPixWhatsAppLink("não é uma url", "Evento"), null);
});
