## Diagnóstico confirmado

- O front não está só “mostrando errado”: o payload atual de `bunny-stats` que chegou na tela já veio com `180290661969 bytes` = `167.91 GB`.
- A causa mais provável está na Edge Function `bunny-stats`: o modo `lifetime` ainda inicia em `2020-01-01`, porque a busca de `DateCreated` da pull zone não está retornando/parseando o campo esperado. Isso gera `67 chunks`, `56 erros` e soma `11 chunks` válidos, abrindo espaço para agregado inconsistente.
- A distribuição geográfica está truncada por configuração de gráfico: `YAxis width={50}` é pequeno demais para nomes de países/cidades retornados pela API.
- O banner superior “Egress Total Real” duplica a informação da aba Bunny e deve sair.
- Edge Functions do Supabase continua `0` porque o endpoint `usage.func-invocations` não está retornando linhas no formato esperado. Como existem registros reais em `function_edge_logs`, dá para usar os logs do próprio Supabase como fallback confiável.

## Plano de correção

### 1) Corrigir Bunny lifetime na fonte
- Ajustar `supabase/functions/bunny-stats/index.ts` para não depender cegamente de `DateCreated`.
- Usar uma data-base segura e auditável para o início real da série (por exemplo, o primeiro dia útil com tráfego nos charts retornados, ou fallback controlado), evitando somar chunks antigos/estranhos.
- Adicionar proteção contra `chunkErrors` altos: se muitos chunks falharem, retornar metadados de qualidade e não deixar o front tratar isso como número “oficial” sem aviso.
- Revisar a agregação de charts para evitar duplicação por timestamp entre chunks.
- Corrigir `GeoTrafficDistribution` para agregar todos os chunks válidos, não só pegar o último chunk.

### 2) Corrigir `metrics-snapshot` para não reintroduzir números errados
- Aplicar a mesma regra de range seguro e agregação em `supabase/functions/metrics-snapshot/index.ts`.
- Isso evita que a aba Histórico grave novamente lifetime inflado.

### 3) Corrigir Supabase Edge Functions
- Ajustar `supabase/functions/supabase-usage/index.ts` para usar fallback nos logs reais de `function_edge_logs` quando `usage.func-invocations` vier vazio.
- Retornar também a origem do número, por exemplo `source: "management-api" | "function-edge-logs"`, para o front poder exibir com transparência.
- Manter `DB Size`, Storage, Health e Requests como já estão, porque no snapshot atual eles estão chegando corretamente.

### 4) Corrigir front da página `/admin/egress-monitor`
- Remover o banner/card superior de “Egress Total Real”.
- Manter as métricas Bunny somente dentro da aba “Bunny CDN (oficial)”.
- Ajustar labels para deixar claro quando é `lifetime` vs últimos `N` dias.
- Corrigir a distribuição geográfica:
  - aumentar margem esquerda e largura do eixo;
  - truncar nomes longos de forma controlada;
  - colocar nome completo no tooltip;
  - aumentar altura proporcional quando houver muitos itens.
- Exibir avisos discretos dentro da aba Bunny caso `chunks.errors > 0` ou dados venham parciais.
- Atualizar o card de Edge Funcs para mostrar a origem do cálculo, quando disponível.

### 5) Verificação após implementação
- Chamar a Edge Function `bunny-stats` em `lifetime` e `range 90d` para comparar os bytes retornados.
- Conferir que o front mostra o mesmo valor do payload, sem duplicação/conversão errada.
- Conferir Supabase:
  - DB Size maior que zero;
  - Edge Funcs maior que zero usando fallback de logs;
  - Total Requests continua batendo com `apiCounts.totalRequests`.
- Conferir visualmente que a distribuição geográfica não sobrepõe rótulos.

## Antes vs depois esperado

- Antes: Bunny lifetime aparece como `167.91 GB`, com `56` chunks falhos e banner duplicado no topo.
- Depois: Bunny lifetime fica limitado ao intervalo confiável e aparece só dentro da aba Bunny.
- Antes: Edge Funcs mostra `0` mesmo existindo chamadas reais.
- Depois: Edge Funcs usa fallback dos logs reais e mostra contagem não-zero.
- Antes: geografia sobrepõe texto.
- Depois: eixo/margem/tooltip corrigidos sem truncamento visual agressivo.

## Pendências/riscos

- Se o Bunny não expuser uma data confiável de criação via API, vou usar fallback determinístico baseado no primeiro ponto real dos charts/estatísticas, e deixar isso explícito no payload.
- O fallback de Edge Functions por logs depende da retenção disponível no plano atual do Supabase; ainda assim é melhor que mostrar `0` incorreto.

## Prevenção de regressão

- Centralizar o cálculo de bytes e charts na Edge Function, sem somas paralelas no front.
- Adicionar metadados (`chunks`, `rangeSource`, `edgeFunctions.source`) para facilitar auditoria na própria UI.
- Validar sempre payload vs UI antes de concluir a correção.