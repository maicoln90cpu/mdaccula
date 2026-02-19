

## Filtros UTM + Select com opcoes pre-configuradas no Redirects Manager

### 1. Filtros por UTM na listagem

Adicionar uma barra de filtros entre o header e a lista de links com selects para filtrar por:
- **utm_source** (todas as sources unicas existentes nos links)
- **utm_medium** (todos os mediums unicos existentes)
- **utm_campaign** (todas as campaigns unicas existentes)

Os filtros serao derivados dinamicamente dos dados ja carregados (sem query extra). A lista sera filtrada client-side com `useMemo`.

### 2. Select pre-configurado no modal de criacao/edicao

No formulario do Dialog, trocar os campos `utm_source` e `utm_medium` de Input para Select com opcoes pre-definidas + opcao "Personalizado" que habilita um Input livre.

**Opcoes de utm_source:**
- `mdaccula`
- `instagram`
- `whatsapp`
- `facebook`
- `tiktok`
- `email`
- `google`
- Personalizado...

**Opcoes de utm_medium:**
- `link-curto`
- `bio`
- `stories`
- `email`
- `post`
- `ads`
- `qrcode`
- Personalizado...

### 3. Card de pre-configuracao de UTMs padrao

Inserir entre a lista de links e o guia de UTMs um card compacto onde o admin pode definir os **valores padrao** de `utm_source` e `utm_medium` que serao usados ao criar novos links. Esses valores serao armazenados em estado local (com valores iniciais `mdaccula` e `link-curto`) e aplicados automaticamente no `emptyForm`.

### Detalhes tecnicos

**Arquivo modificado:** `src/pages/admin/RedirectsManager.tsx`

**Mudancas:**
1. Importar `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` de `@/components/ui/select`
2. Adicionar estados:
   - `filterSource`, `filterMedium`, `filterCampaign` (strings, "" = todos)
   - `defaultSource`, `defaultMedium` (strings para pre-config padrao)
   - `customSource`, `customMedium` (booleans para modo personalizado no form)
3. Criar `filteredLinks` com `useMemo` aplicando os 3 filtros
4. Renderizar barra de filtros com 3 Selects (opcoes extraidas dinamicamente dos links)
5. No Dialog, trocar utm_source e utm_medium para Select com opcoes fixas + modo personalizado
6. Adicionar card de "Configuracao padrao de UTMs" entre a lista e o guia, com 2 Selects para definir defaults
7. Atualizar `emptyForm` dinamicamente usando `defaultSource` e `defaultMedium`

**Nenhuma mudanca no banco de dados necessaria.**
