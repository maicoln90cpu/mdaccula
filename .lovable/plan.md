
Objetivo: fazer uma auditoria completa e corrigir todas as referências erradas de `mdacula` para `mdaccula`, porque esse typo invalida a zone/path usados no Bunny e explica o erro persistente.

Plano de correção

1. Corrigir constantes centrais do Bunny
- Atualizar `BUNNY_STORAGE_ZONE = "mdaccula"` onde hoje está `mdacula`
- Atualizar `BUNNY_CDN_HOST = "https://mdaccula.b-cdn.net"` onde hoje está `https://mdacula.b-cdn.net`

Arquivos já identificados com erro:
- `supabase/functions/migrate-to-bunny/index.ts`
- `supabase/functions/upload-to-bunny/index.ts`
- `supabase/functions/batch-convert-webp/index.ts`

2. Corrigir uploads que ainda montam URL manualmente com a zone errada
Hoje há funções que não reutilizam a constante e fazem string hardcoded com `/mdacula/...`.
Vou trocar para `mdaccula` e, idealmente, centralizar com constante para evitar novo erro.

Pontos confirmados:
- `supabase/functions/generate-blog-post-v2/index.ts`
- `supabase/functions/generate-multi-event-article/index.ts`
- `supabase/functions/regenerate-blog-image/index.ts`

Trechos com erro atual:
```text
https://${bunnyHostname}/mdacula/event-images/${fileName}
https://mdacula.b-cdn.net/event-images/${fileName}
```

3. Corrigir URLs CDN e regex no frontend
Há código cliente que reconhece e reescreve URLs Bunny com o domínio errado, o que pode quebrar preview, fallback e renderização mesmo depois do upload funcionar.

Pontos confirmados:
- `src/lib/imageUtils.ts`
  - `BUNNY_CDN_HOST = 'https://mdacula.b-cdn.net'`
  - `BUNNY_PATH_REGEX = /^https:\/\/mdacula\.b-cdn\.net\/(.+)$/`
- `src/lib/bunnyUploader.ts`
  - comentário/documentação menciona o host errado

4. Corrigir textos de diagnóstico no admin
O painel de mídia ainda orienta usando a zone errada, o que confunde a operação manual e o troubleshooting.

Ponto confirmado:
- `src/components/admin/settings/MediaSettings.tsx`
  - texto: `zone mdacula`

5. Fazer busca global e padronização
Antes de concluir, vou varrer o projeto por:
- `mdacula`
- `mdacula.b-cdn.net`
- `/mdacula/`

E substituir apenas os casos ligados à integração Bunny. Isso evita deixar erros residuais em funções auxiliares, logs e mensagens da UI.

Resultado esperado
- Todas as edge functions passam a enviar arquivos para a zone correta `mdaccula`
- Todas as URLs públicas passam a usar `https://mdaccula.b-cdn.net`
- O diagnóstico do admin deixa de exibir a zone errada
- O frontend passa a reconhecer corretamente URLs já migradas do Bunny

Observação técnica importante
- O secret `BUNNY_STORAGE_HOSTNAME` continua ausente, então o sistema seguirá usando o fallback `storage.bunnycdn.com`
- Isso não é o erro principal aqui: o problema auditado foi o nome da zone/CDN escrito errado em vários pontos

Checklist dos erros encontrados até agora
- `supabase/functions/migrate-to-bunny/index.ts`
- `supabase/functions/upload-to-bunny/index.ts`
- `supabase/functions/batch-convert-webp/index.ts`
- `supabase/functions/generate-blog-post-v2/index.ts`
- `supabase/functions/generate-multi-event-article/index.ts`
- `supabase/functions/regenerate-blog-image/index.ts`
- `src/lib/imageUtils.ts`
- `src/lib/bunnyUploader.ts`
- `src/components/admin/settings/MediaSettings.tsx`

Implementação
- Corrigir todos os pontos acima
- Padronizar uso de constantes para zone/CDN nas functions que hoje têm string hardcoded
- Fazer nova varredura final para garantir que não reste nenhuma ocorrência de `mdacula`
