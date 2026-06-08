# Plano — Corrigir "endereço do RSS não é válido" no Mailchimp

## Causa raiz (confirmada)

Acabei de baixar o feed (`/functions/v1/blog-rss`) e validar. O feed está **respondendo HTTP 200** e tem conteúdo, mas o XML está **mal formado** por causa da correção anterior.

A linha que quebrou:
```xml
<enclosure url="https://mdaccula.b-cdn.net/...png?format=jpeg&width=1200" type="image/jpeg" />
```

O `&` entre `format=jpeg` e `width=1200` é **caractere reservado em XML** dentro de atributo. Tem que ser `&amp;`. Mailchimp, Feedly e qualquer validador RSS estrito rejeitam o feed inteiro por causa disso — daí a mensagem "O endereço do RSS não é válido".

Antes da minha correção a URL não tinha `?...&...`, então o problema não existia. Eu introduzi o bug ao adicionar `?format=jpeg&width=1200`.

**Detalhe:** o `<img src="...&width=1200">` dentro do `<description>` está dentro de `<![CDATA[ ... ]]>`, então **não quebra** o XML. O problema é **só no atributo `url` do `<enclosure>`**, que fica fora do CDATA.

## Antes vs depois

| | Antes (hoje, quebrado) | Depois |
|---|---|---|
| `<enclosure url="...?format=jpeg&width=1200">` | XML inválido — Mailchimp rejeita | `<enclosure url="...?format=jpeg&amp;width=1200">` — XML válido |
| `<img src=...>` dentro de CDATA | já funciona | continua funcionando |
| URL real entregue ao cliente de email | JPEG do Bunny | JPEG do Bunny (idêntico) |

## Como fazer

Editar **só** `supabase/functions/blog-rss/index.ts`:

1. Criar um pequeno helper `xmlEscapeAttr(url)` que troca `&` por `&amp;`, `"` por `&quot;`, `<` por `&lt;` (defesa em profundidade).
2. Aplicar **só** no atributo do `<enclosure url="...">`.
3. Manter o `<img src>` como está (dentro de CDATA, não precisa).

Mudança mínima, ~5 linhas.

## Vantagens
- Resolve o erro no Mailchimp imediatamente.
- Não muda a URL real entregue (Bunny continua servindo o mesmo JPEG).
- Defesa em profundidade contra outros caracteres especiais no futuro.

## Desvantagens / riscos
- Nenhum. É correção pontual de bug introduzido na alteração anterior.

## Checklist manual de validação
1. Após deploy, abrir `https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/blog-rss`.
2. Confirmar que aparece `&amp;width=1200` (não mais `&width=1200`) nos `<enclosure>`.
3. Colar a mesma URL no Mailchimp → deve aceitar sem erro "endereço inválido".
4. Validar opcionalmente em https://validator.w3.org/feed/ → deve passar.
5. Enviar campanha teste pro Outlook → imagens devem aparecer (objetivo da correção anterior, mantido).

## Pendências / futuro
- 🔜 Adicionar teste unitário do `blog-rss` validando que o XML é well-formed (parseável). Evita esse tipo de regressão.

## Prevenção de regressão
- Comentário no topo da função: "URLs com query string DEVEM passar por `xmlEscapeAttr()` quando usadas em atributos XML fora de CDATA".
- Pendência futura acima cobre via teste automatizado.

---

**Resumo:** 1 arquivo, ~5 linhas, sem migração, sem mudar comportamento — só conserta o XML que ficou inválido depois do `?format=jpeg&width=1200`. Posso prosseguir?
