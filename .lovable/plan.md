## Contexto

Todos os selects de evento na página `/admin/email-config` são alimentados por uma única query em `EmailConfig.tsx` (linhas 194‑200) que:

- Busca só 30 eventos (`.limit(30)`).
- Ordena por data **decrescente** (mais distantes primeiro no futuro; mais antigos por último).
- Não filtra por status — mas o limite de 30 exclui qualquer evento que caia fora dessa janela.

## Diagnóstico dos 3 problemas

**1) Nome antigo aparecendo depois da mesclagem "Parador Reveillon – Dias Avulsos"**
O merge grava o novo título corretamente (`MergeEventsDialog` → `title: effectiveTitle`). O select mostra nome velho porque `realEvents` é carregado uma única vez em `loadAll()` e não é reconsultado após uma mesclagem feita em outra tela. Ao recarregar a página, o nome novo aparece.

**2) "Nova Era" (e outros) não aparecem no select**
O `.limit(30)` corta a lista. Como a ordenação é `date DESC`, ficam de fora eventos que:
- estejam além dos 30 mais distantes no futuro, **ou**
- sejam mais antigos que o 30º item da lista ordenada.
"Nova Era" simplesmente não entra nessa janela.

**3) Ordem dos selects de evento**
Hoje: mais distante → mais próximo (`DESC`).
Desejado: mais próximo primeiro (`ASC`).

## Plano de correção (Fase única, baixo risco)

**Arquivo:** `src/pages/admin/EmailConfig.tsx` — bloco da query `evts` (linhas 194‑200).

1. Trocar `.order('date', { ascending: false })` por `.order('date', { ascending: true })`.
2. Adicionar `.order('time', { ascending: true })` como desempate.
3. Trocar `.limit(30)` por um filtro mais inteligente que garanta que **todos os eventos futuros + relevantes recentes** apareçam:
   - `.gte('date', <hoje - 7 dias>)` (mantém eventos recém-passados, útil para reenvios/cortesias).
   - `.limit(500)` (teto de segurança bem acima do volume real da agência).
4. Adicionar `.neq('status', 'merged_inactive')` para não mostrar duplicatas de festival já mescladas (é isso que faz o "nome velho" reaparecer se a duplicata ainda estivesse listada — reforça a correção do item 1).
5. Invalidar a lista após uma mesclagem: no callback `onSuccess` do `MergeEventsDialog` (usado no `MergedEventsTab`), disparar também um refresh de `realEvents` chamando `loadAll()`. Como esse dialog não é usado dentro do `EmailConfig`, a garantia principal para o item 1 vira o filtro `neq('status','merged_inactive')` + reload manual da página quando o admin volta para o email-config.

## Detalhes técnicos (para revisão)

```ts
// EmailConfig.tsx — bloco evts
supabase
  .from('events')
  .select(
    'id,title,slug,date,time,venue,location_city,location_state,image_url,description,subtitle,ticket_link,vip_link,cta_type,blog_post_id,lineup,latitude,longitude,venue_lat,venue_lng,status'
  )
  .neq('status', 'merged_inactive')
  .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  .order('date', { ascending: true })
  .order('time', { ascending: true })
  .limit(500),
```

Isto afeta **todos os selects** que usam `realEvents` (Envio manual, A/B, Agendamento, Virada de lote) — todos ganham a mesma ordem e a mesma lista completa de eventos futuros.

## Relatório obrigatório (será entregue após implementar)

1. Antes vs Depois
2. Melhorias
3. Vantagens / desvantagens
4. Checklist manual (abrir cada aba, conferir ordem crescente, procurar "Nova Era" e "Parador Reveillon – Dias Avulsos")
5. Pendências (nenhuma prevista)
6. Prevenção de regressão: comentário no código explicando por que o filtro de status é necessário; opcionalmente um teste de arquitetura garantindo que a query use `ascending: true`.
