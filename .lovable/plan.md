# Plano — Imagens do RSS no email + erros do console

## Parte 1 — Por que as imagens não aparecem no email

### Causa raiz (confirmada no banco)
Olhei os 6 posts mais recentes:

- **Imagens que aparecem** (1ª do print, o show com lasers): `...ai-generated-1780707683489.png` → **PNG**
- **Imagens quebradas** (Sábado Dre, Sirius, Fire Up): `...1779804036261-bf715a4d.webp` → **WebP**

O padrão é claro:
- Posts **gerados por IA** salvam a imagem como **PNG**.
- Posts **com upload manual** passam pelo `webpConverter.ts` e viram **WebP** (ótimo pro site, péssimo pro email).

**Outlook (que é o cliente do print) não renderiza WebP.** Gmail web renderiza, mas Outlook desktop, Outlook.com, Apple Mail antigo, Yahoo e vários outros mostram o "x" vermelho exatamente como no seu print. Não é problema do RSS nem do serviço de envio — é incompatibilidade do formato com o cliente de email.

Também tem um detalhe menor no `blog-rss/index.ts`: o `<enclosure type="image/jpeg">` está chumbado, então mesmo quando a imagem é PNG/WebP o tipo MIME está errado — alguns leitores RSS usam isso pra decidir se mostram.

### Antes vs depois (proposta)
| Item | Hoje | Depois |
|---|---|---|
| Imagem manual no email | `.webp` → quebra no Outlook | servida como `.jpg` via Bunny Optimizer (`?class=email` ou `?format=jpeg`) |
| Imagem IA no email | `.png` → funciona | continua funcionando (também passa pelo conversor, vira jpeg leve) |
| `<enclosure type>` no RSS | sempre `image/jpeg` (mentira) | sempre `image/jpeg` (e agora é verdade, porque a URL entregue é jpeg) |
| Site (não o email) | WebP no Bunny CDN | **inalterado** — continua WebP, sem perder performance |

### Como fazer
Editar **só** `supabase/functions/blog-rss/index.ts`:
1. Criar helper `toEmailSafeImage(url)` que:
   - Se a URL é Bunny CDN (`mdaccula.b-cdn.net`), acrescenta `?class=email` (Bunny Image Processing converte pra JPEG na borda — zero custo extra, cache no CDN).
   - Se não é Bunny, devolve a URL como está.
2. Usar essa URL tanto no `<img src=...>` do description quanto no `<enclosure url=...>`.
3. Garantir o atributo `width="600"` no `<img>` para Outlook não estourar o layout.

> Observação: o "class=email" precisa estar configurado no painel Bunny → Pull Zone → Image Processing → Classes. Se não estiver, uso `?format=jpeg&width=1200` (funciona out-of-the-box no Bunny Optimizer).

### Vantagens
- ✅ Resolve o problema sem reprocessar nenhuma imagem antiga.
- ✅ Não muda o site (continua servindo WebP, leve e rápido).
- ✅ Conversão acontece no CDN, em cache — sem custo de função, sem egress extra do Supabase.
- ✅ Reversível em 1 commit.

### Desvantagens / riscos
- ⚠️ Depende de o Bunny Image Optimizer estar habilitado no Pull Zone (geralmente vem ligado, mas vale confirmar).
- ⚠️ A primeira requisição de cada imagem pode demorar ~200ms a mais (processamento). Depois fica em cache.

### Checklist manual de validação
1. Após deploy, abrir `https://mdaccula.com/functions/v1/blog-rss` no navegador.
2. Procurar um post com `.webp` no banco e confirmar que a URL da imagem no XML termina com `?class=email` (ou `?format=jpeg`).
3. Abrir essa URL direto no navegador → deve baixar JPEG, não WebP.
4. Disparar um envio teste do serviço de newsletter (Mailchimp/Brevo/etc. que consome o RSS) pro seu Outlook → confirmar que todas as 4 imagens do email aparecem.
5. Abrir o mesmo email no Gmail web → confirmar que continua funcionando (regressão zero).

### Pendências / futuro (não agora)
- 🔜 Avaliar se vale **também** salvar uma cópia JPEG no upload (redundância, caso o Bunny Optimizer caia). Só se acontecer problema.
- 🔜 Adicionar teste automatizado do RSS validando que toda `<img src>` aponta para `.jpg` ou tem `?format=jpeg`.

### Prevenção de regressão
- Adicionar comentário no topo do `blog-rss/index.ts` avisando: "NUNCA usar a URL crua do banco — sempre passar por `toEmailSafeImage()` para garantir compatibilidade com Outlook".

---

## Parte 2 — Erros do console (triagem)

Analisei os 4 prints. **Nenhum erro é do seu app.** Detalhe por categoria:

### 🟢 Ignorar — são do ambiente Lovable (não vão pro site publicado)
| Erro | De onde vem |
|---|---|
| `Error: NextJS` em `0c82jsme6tqhg.js` | Wrapper interno do preview Lovable (você está dentro de um iframe Next.js do Lovable) |
| `Erro no mapa de código: 404` em `lovable.dev/_next/static/chunks/...` | Sourcemaps do próprio editor Lovable |
| `Diretiva de recursos: ... "vr", "magnetometer", "bluetooth"...` | Permissions-Policy do iframe Lovable |
| `downloadable font: avar / Table discarded` (Camera Plain Variable) | Fonte do editor Lovable, não do seu site |
| `Ignorando entryTypes: layout-shift` | Firefox não suporta CLS via PerformanceObserver — esperado |

**Por que ignorar:** todos só aparecem em `id-preview--...lovable.app`. No `mdaccula.com` em produção, somem.

### 🟡 Causados pelo seu AdBlock (canto superior direito do print)
| Erro | Causa |
|---|---|
| `Falha no carregamento de connect.facebook.net/fbevents.js` | AdBlock bloqueou Facebook Pixel |
| `DeviceModeDestinationsPlugin: Failed Facebook-Pixel timeout 11000ms` | RudderStack tentando carregar o Pixel bloqueado |
| `cookie "_gcl_au" / "_ga" / "_cf_bm" foi rejeitado por ter domínio inválido` | Tracking de Google Ads / Cloudflare bloqueado pelo AdBlock dentro do iframe |

**Por que ignorar:** desativando o AdBlock somem. Usuários reais com AdBlock também terão esses erros — é o comportamento esperado (e desejado: respeita a privacidade). **Não há nada a corrigir.**

### 🔴 Único realmente meu: tela "Algo deu errado"
A tela do ErrorBoundary apareceu. Mas:
- No console **não há stack trace** do erro real (só o wrapper "Error: NextJS").
- Você disse que o site voltou a funcionar.

**Hipótese:** foi um chunk antigo cacheado (deploy novo + aba antiga aberta). O `main.tsx` já tem auto-reload de chunk obsoleto — daí "voltou a funcionar" sozinho.

### Proposta para a Parte 2
**Não tocar em nada agora.** Em vez disso:
1. Quando a tela "Algo deu errado" aparecer **de novo**, abrir o console **sem AdBlock** e me mandar o print — aí teremos o erro real.
2. (Opcional, futuro) Adicionar no ErrorBoundary o `error.message` e `error.stack` visíveis em produção, pra capturar a causa sem depender de você abrir o console.

### Checklist manual de validação (Parte 2)
1. Abrir o site **publicado** (`https://mdaccula.com`, NÃO o preview), em aba anônima, sem extensões.
2. Abrir o console.
3. Confirmar que está limpo (ou só com avisos benignos de favicon/sitemap).

### Pendências (futuro, se quiser robustez)
- 🔜 Melhorar ErrorBoundary pra logar `error.stack` no `application_logs` automaticamente.
- 🔜 Adicionar Sentry ou similar pra capturar erros reais de produção sem depender de print.

---

## Resumo das mudanças propostas (precisam de aprovação)
**Só 1 arquivo será editado:**
- `supabase/functions/blog-rss/index.ts` — adicionar `toEmailSafeImage()` e aplicar no `<img>` e no `<enclosure>`.

**Nada de migração de banco, nada de mudança no site, nada de mudança no upload.**

Posso prosseguir com a implementação?
