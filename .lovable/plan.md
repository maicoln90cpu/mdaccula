# Plano de contenção de custo do Google Maps Static API

## Diagnóstico

O custo de **R$ 240,23** em julho/2026 vem exclusivamente do **Maps Static API**, usado para renderizar a imagem do mapa dentro dos e-mails de campanha.

- **Serviço do site** (Maps Embed API, iframe na página de evento) continua **gratuito e ilimitado** — não entra na conta.
- **Geocoding** (preencher latitude/longitude ao criar evento) é gratuito até 10.000 requisições/mês e hoje tem uso muito baixo — não é o vilão.
- **Maps Static API** cobra a cada imagem servida: após 10.000 carregamentos/mês, custa **US$ 2,00 a cada 1.000 requisições** (aprox. US$ 0,002 por abertura).
- O problema é que o e-mail contém uma imagem viva do mapa. Cada vez que o destinatário abre o e-mail, o cliente de e-mail (Gmail, Outlook, etc.) faz uma nova requisição paga ao Google. O cache de 7 dias da Edge Function `render-static-map` não impede isso, porque os clientes de e-mail carregam a imagem de novo.
- O template padrão **"Novo evento — padrão"** (`type: event_new`) inclui o bloco `static_map` automaticamente. Portanto, toda campanha nova de evento estava saindo com mapa sem que o usuário percebesse.
- Nenhum template salvo no banco (`email_templates`) contém `static_map`, então o dano está vindo apenas do preset padrão + campanhas já criadas.

---

## Objetivo

1. Parar o sangramento imediato (tirar o mapa do padrão, alertar no editor).
2. Criar proteção orçamentária no Google Cloud.
3. Permitir manter a imagem do mapa nos e-mails, mas **cobrando apenas uma vez por campanha** (pré-renderização no Bunny CDN), e não a cada abertura.

---

## Fase A — Contenção imediata (1ª PR)

### A.1 Remover o bloco `static_map` do preset padrão `event_new`

- Arquivo: `src/lib/emailTemplates/presetBuilders.ts`.
- Remover o bloco `static_map` do array de blocos padrão do preset `event_new`.
- **Comportamento preservado**: o bloco continua disponível no editor; o usuário pode adicionar manualmente se quiser.
- **Ganho**: campanhas futuras deixam de sair com mapa por padrão.

### A.2 Aviso de custo no editor de blocos

- Arquivo: `src/components/admin/emailTemplateEditor/blockPropsPanel/eventProps.tsx` (ou local equivalente do painel de propriedades do `static_map`).
- Adicionar um aviso visual quando o bloco de mapa estático estiver selecionado:
  - "Atenção: cada abertura de e-mail com este mapa gera um custo no Google Cloud. Prefira pré-gerar a imagem no Bunny (Fase C) ou use apenas para campanhas pequenas."
- **Ganho**: o usuário não adiciona o bloco sem saber do custo.

### A.3 Verificar templates existentes

- Consultar a tabela `email_templates` para garantir que nenhum template `is_default` ou ativo contenha `static_map` (a query já mostrou 0, mas validar após a mudança).

---

## Fase B — Alerta de budget no Google Cloud (ação do usuário, com orientação)

Como o usuário confirmou ter acesso ao Google Cloud Console, o passo a passo é:

1. Acesse https://console.cloud.google.com/ com a conta que gerencia o projeto do Google Maps.
2. No seletor de projetos, escolha o projeto vinculado à chave do Maps.
3. No menu de navegação, vá em **Billing → Budgets & alerts** (Faturamento → Orçamentos e alertas).
4. Clique em **Create budget** (Criar orçamento).
5. Preencha:
   - **Name**: `Maps Static API - Alerta mensal`.
   - **Scope**: Projeto atual.
   - **Time range**: `Monthly` (reinicia todo mês).
   - **Budget amount**: R$ 20,00 (ou outro valor confortável).
6. Em **Set threshold alerts**:
   - 50% do orçamento → e-mail.
   - 90% do orçamento → e-mail.
   - 100% do orçamento → e-mail.
7. Salvar.

**Importante**: o alerta não bloqueia o serviço; só avisa. Para bloquear de fato, é necessário criar uma quota hard no **APIs & Services → Quotas** para `Maps Static API`, limitando requisições por dia. Recomendo fortalecer o alerta com uma quota diária baixa (ex: 1.000 requisições/dia) para evitar estouro.

---

## Fase C — Pré-renderização da imagem do mapa no Bunny CDN (2ª PR)

### C.1 Criar bucket/pasta no Bunny para mapas de e-mail

- Usar a pasta `email-map-images` dentro da storage zone existente `mdaccula`.
- Nenhuma secret nova é necessária; `BUNNY_STORAGE_API_KEY` e `BUNNY_STORAGE_ZONE_ID` já estão configuradas.
- Nenhum custo significativo: Bunny cobra por armazenamento e banda, muito abaixo do Maps Static API por abertura.

### C.2 Criar helper de upload direto de bytes no Bunny

- Novo arquivo: `supabase/functions/_shared/bunnyUploadBytes.ts`.
- Função `uploadBytesToBunny(buffer: ArrayBuffer, path: string, contentType: string): Promise<string>`.
- Usar a mesma lógica de autenticação do `upload-to-bunny`, mas sem exigir FormData, JWT ou verificação de admin (uso interno por outra Edge Function).
- Retornar a URL pública no CDN (`https://mdaccula.b-cdn.net/email-map-images/...`).

### C.3 Modificar `create-event-email-campaign` para trocar URLs do mapa

- Arquivo: `supabase/functions/create-event-email-campaign/index.ts` (ou módulo compartilhado que ele use).
- Antes de enviar o HTML para a E-goi, executar o processo:
  1. Parsear o HTML e encontrar todas as `<img>` cujo `src` contenha `/render-static-map?`.
  2. Para cada URL, extrair `lat`, `lng`, `zoom`, `w`, `h`, `style`, `pincolor`.
  3. Gerar um nome de arquivo determinístico: `map-{hash}-{lat}-{lng}-{zoom}-{w}x{h}-{style}-{pincolor}.png`.
  4. Verificar se o arquivo já existe no Bunny (HEAD request). Se existir, só substituir a URL no HTML.
  5. Se não existir, chamar a própria Edge Function `render-static-map` (ou o Google Static Maps via gateway) para gerar a imagem uma única vez.
  6. Fazer upload da imagem para `email-map-images/{filename}` usando `uploadBytesToBunny`.
  7. Substituir o `src` original no HTML pela URL do Bunny.
- **Comportamento preservado**: se o mapa não tiver coordenadas, continua emitindo o aviso `MAP_COORDINATES_MISSING` e segue o fluxo atual.
- **Ganho**: a cobrança do Google Maps ocorre apenas 1 vez por imagem distinta, e não a cada abertura de e-mail.

### C.4 Atualizar `render-static-map` para fallback de cache

- Arquivo: `supabase/functions/render-static-map/index.ts`.
- Adicionar um parâmetro opcional `use_bunny_cache` (ou verificar se o Bunny já tem a imagem antes de chamar o Google).
- Se a imagem existir no Bunny, servir do Bunny diretamente.
- Se não existir, chamar o Google como hoje, mas opcionalmente salvar no Bunny.
- **Ganho**: reutiliza imagens já geradas, mesmo em chamadas diretas à função.

### C.5 Ajustar o aviso no editor

- Após a Fase C, atualizar o aviso no editor para:
  - "Mapa estático: a imagem será pré-gerada e salva no Bunny no envio, cobrando apenas 1 vez por campanha."

---

## Fase D — Testes e validação

### D.1 Testes de Edge Function

- Adicionar testes em `src/__tests__/contracts/` para `create-event-email-campaign` e `render-static-map`.
- Verificar que URLs do `render-static-map` são substituídas por URLs do Bunny no HTML final.
- Verificar que o fallback de cache funciona.

### D.2 Teste manual de envio

- Criar uma campanha de teste com o bloco de mapa.
- Verificar no HTML da E-goi (ou no preview) que a imagem do mapa aponta para `mdaccula.b-cdn.net/email-map-images/...`.
- Abrir o e-mail várias vezes e confirmar no Google Cloud Console que o contador de Maps Static API não aumenta após a primeira geração.

### D.3 Verificação de segurança e RLS

- Nenhuma tabela nova é necessária. As imagens no Bunny são públicas por design (são usadas em e-mails), mas os caminhos são impossíveis de adivinhar (hash determinístico). Não expõe dados sensíveis.

---

## Fase E — Monitoramento (3ª PR, opcional)

### E.1 Dashboard de custo de Maps no admin

- Adicionar um card em `AICostsPage` ou nova página `MapsCostsPage` mostrando:
  - Último custo mensal (se houver API de billing disponível; senão, orientar a consultar o Google Cloud Console).
  - Quantidade de imagens de mapa pré-renderizadas no Bunny.
  - Dica de ação se o custo subir.

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| O alerta de budget não impede cobrança, só avisa | Combinar com quota hard diária no Google Cloud |
| Pré-renderização aumenta o tempo de criação da campanha | Fazer upload em paralelo; timeout generoso; se falhar, enviar com URL original do Google (não quebra) |
| Bunny CDN pode ficar indisponível | Backup automático já existe no `upload-to-bunny`; reutilizar a mesma lógica |
| Usuário adiciona mapa manualmente e esquece de pré-renderizar | A Fase C faz a troca automaticamente no `create-event-email-campaign`, independente de como o bloco foi adicionado |

---

## Divisão de PRs

- **PR 1**: Fase A + Fase B (documentação/orientação do alerta). Baixo risco, entrega rápida.
- **PR 2**: Fase C + Fase D. Mudança mais profunda no fluxo de envio de campanha.
- **PR 3 (opcional)**: Fase E. Dashboard de monitoramento.

## Resultado esperado

- Após PR 1: custo mensal de Maps Static API cai para quase zero (ou para campanhas que já existem e ainda estão sendo abertas; novas campanhas não terão mapa por padrão).
- Após PR 2: o usuário pode voltar a usar mapa nos e-mails sem medo, pagando apenas uma vez por imagem gerada.
- Após PR 3: visibilidade de custo no próprio admin.
