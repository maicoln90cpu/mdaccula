
Objetivo: corrigir os 2 problemas reais que você apontou: a falha persistente na migração Bunny e o vazamento de informação sensível no frontend.

O que descobri
1. O frontend realmente está expondo parte do secret
- Em `src/components/admin/settings/MediaSettings.tsx`, o card de diagnóstico renderiza:
  - `key_prefix`
  - `key_length`
- Esses dados vêm do backend em `supabase/functions/migrate-to-bunny/index.ts`.
- Isso é um vazamento desnecessário e precisa ser removido imediatamente.

2. O diagnóstico atual está concluindo “credencial inválida” cedo demais
- A função `migrate-to-bunny` usa apenas:
  - `https://br.storage.bunnycdn.com/mdacula/`
- Se esse endpoint estiver incorreto para a sua zone, o sistema acusa senha inválida mesmo com a password correta.
- Como você enviou print do Bunny mostrando:
  - zone `mdacula`
  - hostname `br.storage.bunnycdn.com`
  - password normal da zone
  então o próximo passo correto é tratar melhor o diagnóstico, não insistir que o secret está errado.

3. Há inconsistência arquitetural no projeto
- `migrate-to-bunny`, `upload-to-bunny`, `batch-convert-webp` e 3 funções de IA repetem host/zone hardcoded.
- Isso cria risco de um fluxo funcionar e outro quebrar.
- Hoje a lógica Bunny está espalhada e sem helper compartilhado.

O que vou implementar
1. Corrigir segurança do diagnóstico
- Remover do backend qualquer retorno de:
  - `key_prefix`
  - `key_length`
- Remover do frontend qualquer exibição de “Key: 235d...”
- O diagnóstico vai mostrar apenas:
  - status da configuração
  - hostname usado
  - storage zone usada
  - mensagem segura de erro
- Sem qualquer dado derivado do secret.

2. Reescrever a validação Bunny para diagnóstico confiável
- Ajustar `supabase/functions/migrate-to-bunny/index.ts` para:
  - centralizar `storage zone`, `region` e `storage host`
  - testar conectividade e autenticação com respostas mais precisas
  - diferenciar:
    - erro de credencial
    - erro de endpoint/host
    - erro de rede
    - erro de listagem
- O retorno passará a indicar algo como:
  - `config_ok`
  - `auth_ok`
  - `storage_host`
  - `storage_zone`
  - `failure_reason`
- Sem culpar automaticamente a senha.

3. Padronizar a configuração Bunny em todas as edge functions
Arquivos:
- `supabase/functions/migrate-to-bunny/index.ts`
- `supabase/functions/upload-to-bunny/index.ts`
- `supabase/functions/batch-convert-webp/index.ts`
- `supabase/functions/generate-blog-post-v2/index.ts`
- `supabase/functions/regenerate-blog-image/index.ts`
- `supabase/functions/generate-multi-event-article/index.ts`

Plano técnico:
- criar constantes/helpers internos consistentes para:
  - montar URL de upload
  - montar URL de listagem
  - gerar URL pública CDN
- eliminar hardcodes soltos para evitar divergência entre funções.

4. Melhorar o painel admin para troubleshooting real
Em `src/components/admin/settings/MediaSettings.tsx`:
- trocar a mensagem atual por diagnóstico seguro
- mostrar claramente:
  - host usado
  - zone usada
  - buckets Supabase
  - buckets Bunny
  - URLs ainda não migradas
- exibir falha amigável:
  - “Falha ao autenticar na Storage API”
  - “Falha ao acessar endpoint configurado”
  - “Configuração Bunny inconsistente”
- sem mostrar qualquer traço do secret.

5. Ajustar a migração para ser mais robusta
- Antes de migrar, validar acesso ao bucket/path de forma mais confiável.
- Melhorar mensagens de erro por arquivo/lote.
- Se necessário, planejo também:
  - fallback de verificação por bucket
  - melhor tratamento de nomes/paths
  - resumo agregado por lote.

Resultado esperado depois
- O frontend não vai mais exibir nenhuma informação sensível do secret.
- O diagnóstico vai parar de acusar “senha errada” de forma simplista.
- A migração Bunny passará a usar a mesma configuração em todos os fluxos.
- Ficará muito mais claro se o problema é:
  - host/região,
  - path da zone,
  - autenticação da Storage API,
  - ou lógica da própria função.

O que ainda pode depender de ajuste externo
- Se, após o diagnóstico refeito, o host/região retornarem inconsistência real, pode ser necessário confirmar no Bunny se essa Storage Zone está de fato operando em `br.storage.bunnycdn.com`.
- Mas, pelo seu print, não há nenhum indicativo de Cloudflare ser o problema.
- O foco correto é Bunny Storage API + código do diagnóstico.

Resumo do que falta depois desta correção
- Corrigir diagnóstico e vazamento no frontend
- Revalidar migração por lote no Admin
- Executar migração completa
- Atualizar URLs no banco
- Fazer teste ponta a ponta nas páginas públicas para confirmar imagens antigas e novas
