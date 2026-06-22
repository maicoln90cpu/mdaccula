## Resumo
Varredura nos componentes de eventos: somente 4 pontos reais ainda quebram se o campo vier `null` do banco. Demais usos já têm guarda (`formatTime`, `event.genres && ...`, `event.subtitle &&`).

## Pontos a corrigir

### 1) `src/pages/Eventos.tsx` (linhas 96-97)
Busca quebra se algum evento tiver `title` ou `venue` null.
```ts
// antes
event.title.toLowerCase().includes(...) || event.venue.toLowerCase().includes(...)
// depois
(event.title?.toLowerCase().includes(...) ?? false) ||
(event.venue?.toLowerCase().includes(...) ?? false)
```

### 2) `src/pages/EventDetail.tsx` (linhas 255, 618, 628)
`event.genres.join(", ")` quebra se `genres` for null.
```ts
// antes
`${event.genres.join(", ")} - ${event.venue}`
// depois
`${(event.genres ?? []).join(", ") || "Música eletrônica"} - ${event.venue ?? ""}`
```
E em 628:
```ts
Outros eventos de {(event.genres ?? []).join(", ") || "música eletrônica"}
```

### 3) `src/components/events/EventsCarousel.tsx` (linha 115)
`src={event.image_url}` sem fallback → quebra layout se null.
```tsx
src={event.image_url || '/placeholder.svg'}
alt={event.title ?? 'Evento'}
```
E na linha 144/154, garantir texto seguro:
```tsx
{event.title ?? 'Evento sem título'}
...
<span className="truncate max-w-[100px]">{event.venue ?? 'Local a confirmar'}</span>
```

### 4) `src/components/sections/FeaturedEvents.tsx` (linhas 82, 97, 108)
```tsx
alt={event.title ?? 'Evento'}
{event.title ?? 'Evento sem título'}
<span className="truncate">{event.venue ?? 'Local a confirmar'}</span>
```

## Antes vs depois
| Cenário | Antes | Depois |
|---|---|---|
| Evento com `title` null | Busca/carrossel quebra a página | Mostra "Evento sem título", busca ignora |
| Evento com `venue` null | Página quebra | Mostra "Local a confirmar" |
| Evento com `genres` null | `EventDetail` quebra | Usa lista vazia + texto padrão |
| Evento com `image_url` null no carrossel/home | Imagem quebrada | Usa `/placeholder.svg` |

## Vantagens / desvantagens
+ Risco baixíssimo: só adiciona guardas, não muda lógica.
+ Edição em 4 arquivos, alterações pequenas e localizadas.
+ Resolve crashes silenciosos que hoje dependeriam do `ErrorBoundary`.
− Mascara dados ruins no banco (evento sem título vai exibir "Evento sem título"). Mitigação: revisar admin futuramente para tornar título e venue obrigatórios no formulário.

## Checklist de validação
- [ ] Abrir `/eventos` → carrossel e lista carregam normalmente
- [ ] Buscar texto na barra de pesquisa → não quebra
- [ ] Abrir página de um evento qualquer → meta tags e "outros eventos" carregam
- [ ] Abrir home (`/`) → seção de eventos em destaque carrega
- [ ] Se houver evento com title/venue/genres nulos no banco, ele aparece com texto padrão (não derruba a página)

## Pendências (futuro, não agora)
- **Teste unitário**: criar fixture de evento "com tudo null" e renderizar `EventsCarousel`, `FeaturedEvents`, `Eventos` e `EventDetail` para travar regressão.
  - Como ficará: um arquivo de teste roda automaticamente em cada deploy e falha se voltarmos a acessar `.toLowerCase()` direto.
- **Validação no admin**: tornar título, venue, data obrigatórios no formulário de criação/edição de evento (não no banco para não quebrar histórico).
  - Como ficará: o agente do site não consegue salvar evento incompleto, evitando que o problema apareça na vitrine.

## Prevenção de regressão
- **Agora**: apenas as guardas inline (`?.`, `??`).
- **Pendente**: teste unitário com evento "tudo null" (item acima). Recomendo fortemente criar logo após validar este fix, pois é a única proteção permanente contra esse tipo de crash voltar.

Posso aplicar?