
Objetivo: corrigir a migração para Bunny e evoluir a ferramenta de conversão/diagnóstico de imagens no Admin.

Diagnóstico
- Do I know what the issue is? Sim.
- O erro de migração não é de login/admin do Supabase. A chamada para `migrate-to-bunny` responde 200 e passa pela validação de admin.
- O `401 Unauthorized` acontece no `PUT` para a Bunny Storage API. Os logs confirmam isso: a função chega a montar a URL e enviar o `AccessKey`, mas a Bunny rejeita a credencial.
- Causa mais provável: o secret `BUNNY_STORAGE_API_KEY` está com a credencial errada para Storage. A Bunny usa a senha/API password da Storage Zone, não a API key geral da conta.
- Há também um risco técnico no código atual: o endpoint/região está hardcoded em vários lugares (`br.storage.bunnycdn.com`). Vou padronizar isso para evitar divergência.
- A ferramenta atual de “WebP” está inconsistente: o backend `batch-convert-webp` hoje reencoda para JPEG, não WebP, e a UI espera campos diferentes do que a função retorna.

O que vou corrigir
1. Corrigir a migração Bunny
- Refatorar `supabase/functions/migrate-to-bunny/index.ts`.
- Extrair helper interno para upload/listagem Bunny:
  - validar secret
  - usar endpoint configurável
  - diferenciar erro de credencial vs erro de rede
- Parar de depender de `HEAD` na CDN como fonte de verdade; usar checagem/listagem na própria Storage API da Bunny.
- Melhorar o retorno da função com diagnóstico claro:
  - `auth_ok`
  - `bunny_config_ok`
  - `storage_endpoint`
  - `credential_type_hint`
  - erros por bucket/arquivo mais legíveis
- Se a credencial estiver errada, a UI vai mostrar explicitamente algo como:
  `BUNNY_STORAGE_API_KEY inválida para Storage Zone. Atualize o secret com a password da zone mdacula.`

2. Melhorar o painel de migração no Admin
Arquivo principal: `src/components/admin/settings/MediaSettings.tsx`
- Adicionar bloco “Diagnóstico Bunny” com botão de check.
- Mostrar:
  - total de arquivos no Supabase por bucket
  - total de arquivos no Bunny por bucket
  - quantas URLs ainda apontam para Supabase no banco
  - status da configuração Bunny
- Melhorar a execução da migração:
  - botão por bucket e botão “migrar tudo”
  - progresso por lote
  - resumo de erros mais claro
  - botão de reset de offset/reprocessamento

3. Evoluir a ferramenta de conversão
Backend: `supabase/functions/batch-convert-webp/index.ts`
UI: `src/components/admin/settings/MediaSettings.tsx`
- Adicionar botão “Check / Analisar acervo”.
- Mostrar por bucket:
  - quantidade total no Supabase
  - quantidade total no Bunny
  - imagens pequenas / médias / grandes
  - média de tamanho em MB
  - total estimado ocupado
- Faixas propostas:
  - pequena: < 500 KB
  - média: 500 KB até 2 MB
  - grande: > 2 MB
- Adicionar níveis de compressão:
  - Sutil: qualidade alta, resize leve
  - Média: equilíbrio
  - Severa: qualidade menor e resize mais agressivo
- Corrigir o comportamento para de fato gerar WebP; se o runtime não suportar WebP em algum caso, retornar erro/fallback explícito, sem fingir sucesso.
- Alinhar contrato UI/backend:
  - hoje a UI espera `converted` / `largeFilesSkipped`
  - a função retorna `processed` / `tooLarge`
  - vou unificar isso

Arquivos que precisam ser alterados
- `supabase/functions/migrate-to-bunny/index.ts`
- `supabase/functions/upload-to-bunny/index.ts` (padronização do helper/config Bunny)
- `supabase/functions/batch-convert-webp/index.ts`
- `src/components/admin/settings/MediaSettings.tsx`
- possivelmente `supabase/config.toml` se eu separar alguma função de auditoria
- opcionalmente os 3 edge functions de IA que já fazem upload Bunny, para também reutilizarem o mesmo helper/config:
  - `generate-blog-post-v2`
  - `regenerate-blog-image`
  - `generate-multi-event-article`

Passo externo que provavelmente será necessário
- Se o secret atual realmente for a API key da conta Bunny, será preciso trocar no Supabase:
  - `BUNNY_STORAGE_API_KEY` → password da Storage Zone `mdacula`
- Isso não é mudança de Cloudflare.
- Em princípio não precisa editar nada no Cloudflare para esse fluxo.

Como o sistema ficará depois
- Uploads novos continuam indo para Bunny.
- O Admin passa a ter:
  - diagnóstico completo Supabase vs Bunny
  - migração guiada por bucket/lote
  - atualização de URLs no banco
  - check de acervo com faixas de tamanho e média em MB
  - níveis de compressão para otimização real em WebP

O que ainda faltará depois desta entrega
- Validar o secret correto da Bunny em produção
- Rodar a migração completa
- Rodar atualização das URLs no banco
- Fazer teste ponta a ponta nas telas públicas para confirmar que imagens antigas e novas abrem corretamente
- Opcional: consolidar toda a lógica Bunny em um helper compartilhado entre edge functions para reduzir manutenção futura
