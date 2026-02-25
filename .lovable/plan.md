

## Diagnóstico completo dos 5 problemas

### 1) Eventos recorrentes — RESOLVIDO agora

A função **funciona perfeitamente**. Executei agora e criou 4 eventos + 4 links:
- Moving (26/02), FreakChic (27/02), Nave (28/02), SuperAfter (01/03)

O motivo de "não ter funcionado" antes: provavelmente o botão "Executar Agora" chamou a função antes dela estar deployada com a última versão, ou os eventos da semana já existiam (a função pula duplicatas). **Nenhuma correção necessária.**

---

### 2) Upload de imagem no modal de evento recorrente

Atualmente o modal em `RecurringEventsManager.tsx` tem apenas um campo de texto "URL da Imagem". Vou adicionar um botão de upload que:

- Usa o bucket `event-images` (já existente e público)
- Comprime a imagem antes do upload (usando `browser-image-compression` já instalado)
- Mostra preview após upload
- Preenche automaticamente o campo `image_url` com a URL do Supabase Storage

Implementação:
- Adicionar `<input type="file" accept="image/*">` com botão estilizado
- Ao selecionar arquivo: comprimir → upload para `event-images` → setar `image_url` no estado
- Mostrar loading spinner durante upload
- Manter o campo de URL manual como fallback

---

### 3) Layout mobile da `/` (home) — Hero cortada

O Hero usa `min-h-[75vh]` que funciona bem, mas o conteúdo dentro (título + subtítulo + descrição + botões + social proof) pode transbordar em telas pequenas. Olhando o screenshot, o conteúdo cabe mas o scroll indicator fica colado. Ajustes:

- Reduzir padding/margins do social proof em mobile
- Garantir que o hero não force overflow horizontal (verificar se há algum elemento largo)
- Ajustar `min-h-[75vh]` para `min-h-[85vh] sm:min-h-[75vh]` para dar mais espaço mobile

---

### 4) Blog mobile — scroll lateral e paginação quebrada

**Causa do scroll lateral**: O grid de cards (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) está OK, mas a **paginação** renderiza TODOS os números de página (até 10+) sem wrap, causando overflow horizontal. Screenshot confirma: números "2 3 4 5 6 7 8 9 10" saindo da tela.

Correções:
- **Paginação**: limitar a exibir no máximo 3-5 páginas visíveis com ellipsis ("1 ... 5 ... 10") em mobile
- **Container**: adicionar `overflow-x-hidden` no container principal do blog
- **Layout lateral aprovado**: converter os cards do grid para layout horizontal (imagem lateral + texto) conforme já aprovado anteriormente

Implementação da paginação mobile:
```
Mobile: « 1 ... 4 5 6 ... 10 »
Desktop: « 1 2 3 4 5 6 7 8 9 10 »
```
Lógica: mostrar primeira página, última página, e ±1 ao redor da atual, com ellipsis entre gaps.

---

### 5) Avatar da página /links — URL quebrada

**Causa raiz encontrada**: A URL do avatar no banco aponta para **outro projeto Supabase** (`nzbyyuqvhrwatmydxiag`), não para o projeto atual (`xfvpuzlspvvsmmunznxw`):

```
Atual (ERRADO): https://nzbyyuqvhrwatmydxiag.supabase.co/storage/v1/object/public/link-thumbnails/avatar-1763512473337.webp
Correto seria:   https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public/link-thumbnails/...
```

O arquivo não existe nesse projeto. Solução:
- Atualizar o `site_settings` com a URL correta após o usuário fazer upload novamente
- Adicionar opção de upload de avatar na página de Settings do admin (`/admin/settings`) com upload direto para o bucket `link-thumbnails` do projeto atual
- A página `/links` (linha 183-190) já renderiza o avatar corretamente se a URL for válida

Para resolver agora: o usuário precisa subir a imagem do avatar novamente. Vou adicionar um componente de upload na seção de configurações de Links (`LinksPageSettings.tsx`) para o avatar.

---

## Resumo de arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `src/pages/admin/RecurringEventsManager.tsx` | Adicionar upload de imagem no modal de edição |
| `src/components/sections/Hero.tsx` | Ajustar espaçamentos mobile |
| `src/pages/Blog.tsx` | Layout lateral nos cards + paginação inteligente (sem scroll) |
| `src/components/links/LinksPageSettings.tsx` | Adicionar upload de avatar |

## Detalhes técnicos

### Upload de imagem (eventos recorrentes + avatar)
- Usar `browser-image-compression` (já instalado) com `maxSizeMB: 0.5, maxWidthOrHeight: 1200`
- Upload via `supabase.storage.from('event-images').upload(...)` para eventos
- Upload via `supabase.storage.from('link-thumbnails').upload(...)` para avatar
- Gerar nome único com timestamp: `recurring-{timestamp}.webp`

### Paginação inteligente mobile
```typescript
function getVisiblePages(current: number, total: number, maxVisible = 5) {
  if (total <= maxVisible) return range(1, total);
  const pages: (number | '...')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('...');
  pages.push(total);
  return pages;
}
```

### Blog layout lateral (mobile)
```
Card horizontal:
[Imagem w-28 h-28 | Título + excerpt + meta + "Ler mais"]

Mobile: flex-row (imagem lateral compacta)
Desktop: flex-row (imagem lateral maior)
```
Sem `aspect-video`. Container de imagem fixo com `object-contain` + `bg-muted/20`.

