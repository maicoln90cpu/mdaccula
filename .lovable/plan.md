

## Diagnóstico: Por que 488 URLs mas só 254 arquivos

**Não há imagens faltando.** A discrepância é explicada por:

1. **488 URLs no banco** apontam para apenas **254 arquivos únicos**. Muitos registros compartilham a mesma imagem (ex: um evento e seu blog post usam a mesma `ai-generated-*.webp`; custom_links referenciam imagens de `event-images`).

2. **Todas as 128 imagens de blog** estão no bucket `event-images` (não existe bucket separado para blog). Elas já foram copiadas para o Bunny — o Bunny mostra 224 arquivos em `event-images`, que é exatamente o que o Supabase tem.

3. **O problema real**: As 488 URLs no banco **ainda apontam para o Supabase** (0 URLs apontam para o Bunny). A ação `update_urls` nunca foi executada com sucesso, ou o botão não a dispara.

### Plano de Correção

#### A. Executar `update_urls` para reescrever as 488 URLs
O `migrate-to-bunny` já tem a ação `update_urls` que reescreve URLs de `supabase.co/storage/...` para `mdaccula.b-cdn.net/...`. O problema é que o frontend (MediaSettings) pode não ter um botão claro para isso, ou ele não foi executado.

**Ação**: Garantir que o botão "Atualizar URLs" no MediaSettings chame `action: "update_urls"` e mostrar progresso por tabela.

#### B. Corrigir contagem no diagnóstico e no check
O diagnóstico mostra "URLs ainda no Supabase: 488" vs "Arquivos no Bunny: 254" como se faltassem 234 arquivos, mas na verdade são **234 URLs duplicadas** (mesma imagem usada por múltiplos registros).

**Ação**: Adicionar ao diagnóstico:
- Total de URLs: 488
- Arquivos únicos referenciados: 254
- URLs duplicadas (mesmo arquivo): 234
- Isso deixa claro que não faltam arquivos

#### C. Corrigir o `check` action no batch-convert-webp
Atualmente o `check` só lista arquivos nos buckets do Supabase (254). Mas os **URLs no banco** são o que importa para saber quantas imagens o sistema usa. Adicionar contagem de URLs do banco para comparação.

### Arquivos alterados
- `supabase/functions/migrate-to-bunny/index.ts` — adicionar contagem de URLs únicas vs totais no diagnóstico
- `src/components/admin/settings/MediaSettings.tsx` — garantir botão `update_urls` visível e funcional, mostrar explicação sobre duplicatas

