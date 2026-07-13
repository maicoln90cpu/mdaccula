Plano seguro para corrigir as automações antes da Fase 3

1) Diagnóstico confirmado
- Antes: os botões Gerar rascunho agora e Enviar teste agora não passam o template escolhido no card da automação.
- Depois: os 3 cards vão sempre enviar para a função o template atualmente selecionado no card: Digest semanal, Agenda FDS e Blog news.
- Ganho: teste, rascunho manual e automação agendada ficam alinhados.
- Risco: se o usuário trocar o seletor e não salvar, o botão manual já deve usar o valor visível na tela. Vou deixar isso intencional, porque é o comportamento esperado para teste imediato.

2) Corrigir seleção de template no backend
- Antes: o Digest semanal ignora `weekly_digest_template_id` salvo e cai no primeiro template padrão/mais antigo. Isso explica o Cartaz da semana sair como Resumo semanal antigo.
- Depois: a função `weekly-digest-draft` vai priorizar, nesta ordem:
  1. `template_id` enviado pelo botão;
  2. `site_settings.weekly_digest_template_id` salvo;
  3. template padrão do tipo semanal.
- Agenda FDS já tem parte disso, mas será revisada para manter o mesmo padrão.
- Blog news também será revisado para priorizar `blog_digest_template_id` salvo quando o botão não enviar override.

3) Corrigir template antigo sem blocos dinâmicos
- Antes: existe um template legado “Resumo semanal” com blocos de texto fixo tipo “Adicione aqui...” e “Cole links...”; quando ele é selecionado ou cai como default, nunca preenche eventos/blog.
- Depois: vou adicionar uma proteção no render das automações:
  - se o template de digest/agenda/blog não tiver blocos dinâmicos compatíveis, a função não vai enviar um e-mail vazio/fixo sem dados;
  - vai retornar erro claro informando que o template precisa conter bloco de agenda (`weekend_grid`) e/ou bloco de blog (`blog_posts_list`).
- Ganho: evita rascunhos e testes “bonitos, mas vazios”.
- Desvantagem: um template manual antigo poderá parar de enviar até ser atualizado com blocos corretos. Isso é melhor do que enviar conteúdo errado.

4) Padronizar os 3 botões manuais
- Digest semanal:
  - `Gerar rascunho agora` passará `{ force: true, template_id: weeklyCfg.templateId }`.
  - `Enviar teste agora` passará `{ force: true, dry_run: true, template_id: weeklyCfg.templateId }`.
- Agenda FDS:
  - mesmo comportamento com `weekendCfg.templateId`.
- Blog news:
  - mesmo comportamento com `blogCfg.templateId`.
- Também vou ajustar as mensagens de sucesso para mostrar o nome do template usado quando a função retornar essa informação.

5) Alinhar regras de Outlook/preheader
- Antes: a renderização por template já usa `renderBlockedTemplate`, `buildEmailMeta`, `injectEmailPreheader` e versão texto, mas a escolha incorreta do template faz parecer que as correções não valem em todos os modos.
- Depois: manteremos o mesmo pipeline para teste, rascunho e envio real:
  - teste: Edge Function em `dry_run` monta o HTML final, depois `send-test-email` envia via Resend;
  - rascunho/envio real: a mesma Edge Function monta o HTML e manda para a E-goi;
  - ambos usam o mesmo HTML final.
- Prevenção: se algum ajuste de Outlook for feito no helper de blocos, ele valerá para os 3 caminhos.

6) Criar proteção de regressão
- Adicionar/ajustar testes de contrato para garantir que:
  - `weekly-digest-draft` aceita `template_id` e não usa outro template por engano;
  - `weekend-agenda-draft` aceita `template_id`;
  - `blog-digest-draft` aceita `template_id`;
  - templates sem blocos dinâmicos não passam silenciosamente com conteúdo vazio/manual.

Checklist manual após implementação
- Na aba Automações, escolher “Digest semanal — Cartaz da semana” e clicar Enviar teste agora: deve chegar e-mail com eventos preenchidos e template Cartaz.
- Clicar Gerar rascunho agora no Digest: deve criar rascunho na E-goi com o mesmo conteúdo do teste, sem textos “Adicione aqui...” ou “Cole links...”.
- Repetir em Agenda FDS: template selecionado no card deve ser respeitado.
- Repetir em Blog news: deve trazer apenas matérias do blog, sem eventos.
- Trocar template no seletor sem salvar e clicar Enviar teste agora: o teste deve usar o template que está visível no seletor.
- Salvar agendamento e gerar rascunho: o backend deve usar o template salvo mesmo se chamado pelo cron.

Pendências futuras
- Depois desta correção, seguimos para a Fase 3: aba de Controle Pessoal.
- Se ainda existirem templates legados antigos no banco, poderá ser útil uma limpeza visual depois, mas não vou apagar nada agora para evitar perda de conteúdo.