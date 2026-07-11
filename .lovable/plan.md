## Plano aprovado antes de mexer

### Problema identificado

**Como está hoje**
- **Enviar teste** ainda usa assunto hardcoded no frontend: `"[Teste] " + nome do evento`. Ele não lê o `subject_template` salvo.
- O HTML do e-mail ainda tem um **preheader escondido hardcoded dentro do próprio HTML**, calculado pelo evento: `evento — data em local`. Mesmo que o campo `preheader_template` esteja salvo certo, o snippet pode continuar antigo.
- **Criar rascunho / Enviar agora** chama outro fluxo. Nele, o template de evento é escolhido de forma insegura: busca qualquer template com `is_default = true`. Hoje existem mais de um `is_default = true` no banco, então a busca pode falhar e cair no fallback `Novo evento: ...`.
- Os fluxos **weekly-digest** e **weekend-agenda** foram corrigidos parcialmente, mas ainda têm trechos de fallback/`computePreheader()` que podem gerar texto diferente do salvo.
- Ainda existem templates salvos no banco com “Cuiabá”; isso precisa ser corrigido para **São Paulo**.

**Como ficará**
- Um único contrato de geração de assunto/preheader será usado por todos os fluxos:
  - preview visual;
  - enviar teste;
  - criar rascunho na E-goi;
  - enviar agora;
  - digest semanal;
  - agenda FDS.
- Se não houver template válido, o sistema deve **falhar com aviso claro**, em vez de enviar assunto/preheader hardcoded errado.
- O HTML escondido, o assunto enviado para Resend e o assunto/preheader enviados para E-goi sairão da mesma fonte: `subject_template` e `preheader_template` salvos.

---

## Etapa 1 — Criar helper central de assunto/preheader

### Antes vs depois
- **Antes:** cada lugar resolve placeholders de um jeito: preview, envio teste, rascunho E-goi e funções Edge.
- **Depois:** haverá uma função central para resolver:
  - `{{event_title}}` e `{{event.title}}`
  - `{{date_label}}` e `{{event.date_label}}`
  - `{{time_label}}` e `{{event.time_label}}`
  - `{{venue_name}}`, `{{event.venue}}`, `{{event.venue_name}}`
  - `{{city_state}}` e `{{event.city_state}}`
  - `{{weekend_range}}`
  - `{{week_range}}`
  - `{{range_label}}`
  - `{{events_count}}`

### Melhoria
- Acaba a diferença entre “o que aparece no preview” e “o que chega no e-mail”.

### Vantagens
- Menos chance de um fluxo ficar esquecido.
- Mais fácil testar e corrigir no futuro.

### Desvantagens / riscos
- Edge Functions e frontend têm runtimes diferentes. Então a solução segura é criar **um contrato único** com helper no frontend e equivalente em `_shared` para Edge Functions, usando os mesmos testes/mesma regra. Não vou tentar importar frontend dentro da Edge Function porque isso costuma quebrar deploy.

### Checklist manual
- Editar assunto para: `TESTE {{event.title}} — {{event.date_label}}`
- Editar preheader para: `PREHEADER {{event.venue}}, {{event.city_state}}`
- Conferir se preview mostra exatamente isso resolvido.

### Pendências
- Nenhuma nesta etapa, se aprovado.

### Prevenção de regressão
- Criar teste unitário simples para garantir que placeholder com ponto e underline geram o mesmo resultado.

---

## Etapa 2 — Corrigir o HTML escondido do preheader

### Antes vs depois
- **Antes:** o corpo HTML inclui um `<div style="display:none">` com preheader automático antigo.
- **Depois:** o HTML recebe o preheader já resolvido do template salvo.

### Melhoria
- Corrige o problema do snippet antigo aparecendo em clientes de e-mail, mesmo quando o campo salvo está correto.

### Vantagens
- O preview da caixa de entrada, o Resend e a E-goi ficam alinhados.

### Desvantagens / riscos
- Alguns clientes de e-mail podem cachear conversas antigas. Teste novo deve ser feito com assunto diferente para evitar agrupamento/cache visual.

### Checklist manual
- Enviar teste com preheader novo e assunto novo.
- No e-mail recebido, verificar:
  - assunto;
  - snippet/preheader;
  - primeira linha escondida não aparece visualmente no corpo.

### Pendências
- Nenhuma.

### Prevenção de regressão
- Teste verificando que o HTML gerado contém o preheader resolvido e não contém o preheader automático antigo.

---

## Etapa 3 — Corrigir “Enviar teste”

### Antes vs depois
- **Antes:** botão “Enviar teste” manda assunto hardcoded: `[Teste] ${previewData.eventTitle}`.
- **Depois:** botão “Enviar teste” vai usar o `subject_template` e `preheader_template` do template ativo, resolvidos com os dados do simulador.

### Melhoria
- O teste passa a representar fielmente o envio real.

### Vantagens
- Você consegue validar pelo próprio e-mail recebido antes de criar rascunho na E-goi.

### Desvantagens / riscos
- Se houver alterações não salvas no editor, o botão precisa usar o estado local do editor ou avisar claramente. Vou priorizar usar o que está visível no editor quando possível, e manter aviso de “não salvo” quando depender do servidor.

### Checklist manual
- Alterar assunto/preheader no template.
- Salvar.
- Clicar “Enviar teste”.
- Confirmar no e-mail recebido que não aparece mais `[Teste] Nome do evento` como assunto principal, salvo se isso estiver no próprio template.

### Pendências
- Nenhuma.

### Prevenção de regressão
- Teste/contrato para impedir que `sendTestEmail` volte a receber assunto hardcoded.

---

## Etapa 4 — Corrigir “Criar rascunho” e “Enviar agora” de evento individual

### Antes vs depois
- **Antes:** `dispatchEventDraftEmail` tenta pegar `default_event_template_id`; se vazio, busca qualquer `is_default = true`. Como há mais de um default, pode falhar e cair no `Novo evento:` hardcoded.
- **Depois:** evento individual sempre buscará template do tipo correto:
  - `event_new` para evento normal;
  - `ticket_batch` quando for virada de lote;
  - `courtesy` quando o fluxo usar cortesia.

### Melhoria
- A E-goi receberá o assunto/preheader do template salvo, não o nome/fallback antigo.

### Vantagens
- Evita rascunho com “Novo evento:” quando você já alterou o assunto.
- Evita pegar template errado, como Cortesia, por causa de `is_default` duplicado.

### Desvantagens / riscos
- Se não existir template do tipo certo, o envio será bloqueado com erro claro. Isso é melhor do que enviar errado.

### Checklist manual
- No template “Evento”, salvar assunto personalizado.
- Em “Histórico por evento”, clicar “Criar rascunho agora”.
- Conferir na E-goi que o campo **Título/Subject** está igual ao template salvo resolvido.
- Só testar “Enviar agora” se você quiser fazer envio real; caso contrário, validar apenas rascunho.

### Pendências
- Avaliar depois se vale criar uma tela para escolher template por evento antes do envio. Nesta correção, vou manter o comportamento atual e só corrigir a fonte.

### Prevenção de regressão
- Função auxiliar única para seleção de template por tipo.
- Teste garantindo que múltiplos `is_default = true` não derrubam o fluxo de evento.

---

## Etapa 5 — Corrigir weekly-digest-draft e weekend-agenda-draft 100%

### Antes vs depois
- **Antes:** ainda podem usar `computePreheader()` ou fallback automático se o template não estiver completo.
- **Depois:** subject/preheader virão do template salvo. Se o assunto estiver vazio, retorna erro claro em vez de enviar um hardcoded.

### Melhoria
- Digest e Agenda FDS passam a obedecer o mesmo padrão do evento individual.

### Vantagens
- Menos diferença entre “Preview”, “Gerar rascunho” e automações.

### Desvantagens / riscos
- Templates antigos sem `subject_template` precisarão ser preenchidos. Pelo banco atual, os principais já têm valor.

### Checklist manual
- Alterar o assunto do Digest com `{{week_range}}`.
- Alterar o assunto da Agenda FDS com `{{weekend_range}}`.
- Gerar preview e rascunho.
- Conferir se ambos usam o texto salvo.

### Pendências
- Nenhuma para a correção atual.

### Prevenção de regressão
- Teste de contrato para as Edge Functions retornarem `subject` e `preheader` no `dry_run`.

---

## Etapa 6 — Corrigir “Cuiabá” no banco/templates

### Antes vs depois
- **Antes:** ainda há templates salvos com “Cuiabá”.
- **Depois:** templates salvos serão atualizados para “São Paulo”.

### Melhoria
- Remove origem persistida do texto errado.

### Vantagens
- Mesmo templates antigos deixam de reintroduzir “Cuiabá”.

### Desvantagens / riscos
- É mudança no banco. Será feita via migration controlada, apenas substituindo textos de template.

### Checklist manual
- Abrir templates de Digest/Agenda FDS.
- Confirmar que nenhum assunto/preheader contém “Cuiabá”.

### Pendências
- Nenhuma.

### Prevenção de regressão
- Busca no código e no banco por “Cuiabá” depois da correção.

---

## Etapa 7 — Deploy e validação segura

### Antes vs depois
- **Antes:** funções diferentes deployadas com lógicas diferentes.
- **Depois:** Edge Functions afetadas serão redeployadas juntas:
  - `send-test-email` se necessário;
  - `create-event-email-campaign` se necessário;
  - `weekly-digest-draft`;
  - `weekend-agenda-draft`.

### Melhoria
- Evita corrigir frontend e deixar backend antigo.

### Vantagens
- Menos risco de “preview certo, envio errado”.

### Desvantagens / riscos
- Qualquer alteração de Edge Function exige deploy. Vou manter a mudança pequena e focada.

### Checklist manual final
1. Editar e salvar template “Evento”.
2. Enviar teste.
3. Criar rascunho E-goi.
4. Conferir assunto e preheader nos dois.
5. Repetir para Digest e Agenda FDS usando preview/dry-run/rascunho.
6. Confirmar que “Cuiabá” não aparece mais.

### Pendências futuras
- Opcional depois: mostrar no histórico qual `subject` e `preheader` foram enviados em cada campanha. Isso exigiria salvar esses campos na tabela de histórico, então não vou incluir agora para evitar escopo extra.

### Prevenção de regressão
- Testes de helper de placeholders.
- Teste do HTML gerado com preheader resolvido.
- Teste de seleção de template por tipo.
- Monitoramento manual via logs das Edge Functions depois do primeiro rascunho.