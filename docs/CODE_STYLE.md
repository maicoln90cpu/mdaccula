# Guia de Estilo de Código - MDAccula

> Convenções, padrões e boas práticas para desenvolvimento no projeto MDAccula.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Ferramentas de Qualidade](#ferramentas-de-qualidade)
3. [Estrutura de Arquivos](#estrutura-de-arquivos)
4. [Nomenclatura](#nomenclatura)
5. [Imports](#imports)
6. [Componentes React](#componentes-react)
7. [TypeScript](#typescript)
8. [Estilização](#estilização)
9. [Animações](#animações)
10. [Hooks Personalizados](#hooks-personalizados)
11. [Edge Functions](#edge-functions)
12. [Logging](#logging)
13. [Tratamento de Erros](#tratamento-de-erros)
14. [Testes e Validação](#testes-e-validação)

---

## Visão Geral

Este projeto segue padrões rigorosos de código para garantir:
- **Consistência** entre todos os módulos
- **Manutenibilidade** a longo prazo
- **Legibilidade** para novos desenvolvedores
- **Segurança** nas operações com dados

---

## Ferramentas de Qualidade

### ESLint

Configuração em `eslint.config.js`. Desde 18/07/2026 o projeto roda com **zero warnings** (era 392) e todas as regras abaixo estão como `"error"`, não `"warn"` — uma violação nova falha `npm run lint` (exit 1) e trava o CI, não é mais só um aviso:

```javascript
// Regras principais ativas (todas "error")
{
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/consistent-type-imports": "error",
  "@typescript-eslint/no-empty-object-type": "error",
  "@typescript-eslint/no-require-imports": "error",
  "react-hooks/exhaustive-deps": "error",
  "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
  "no-console": ["error", { allow: ["warn", "error"] }],
  "no-param-reassign": ["error", { props: false }],
  "no-implicit-coercion": ["error", { boolean: false }],
  "no-return-await": "error",
  "no-misleading-character-class": "error",
  "no-empty": "error",
  "prefer-rest-params": "error",
}
```

Ver histórico completo da limpeza (392 → 0, em 6 fases) no [`CHANGELOG.md`](../CHANGELOG.md).

### Prettier

Configuração em `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Scripts de Qualidade

```bash
npm run lint          # Verificar erros de lint
npm run lint:fix      # Corrigir automaticamente
npm run format        # Formatar com Prettier
npm run format:check  # Verificar formatação
```

---

## Estrutura de Arquivos

### Organização de Pastas

```
src/
├── components/           # Componentes React
│   ├── ui/              # Componentes base (Shadcn/UI)
│   ├── admin/           # Componentes exclusivos do admin
│   ├── blog/            # Componentes do blog
│   ├── events/          # Componentes de eventos
│   ├── links/           # Componentes de links
│   └── sections/        # Seções da homepage
├── hooks/               # Hooks personalizados
│   └── index.ts         # Barrel export
├── lib/                 # Utilitários e helpers
│   └── index.ts         # Barrel export
├── pages/               # Páginas da aplicação
│   └── admin/           # Páginas administrativas
├── types/               # Tipos TypeScript compartilhados
│   └── index.ts         # Barrel export
└── integrations/        # Integrações externas (Supabase)

supabase/
└── functions/
    ├── _shared/         # Módulos compartilhados
    │   ├── cors.ts
    │   ├── rate-limit.ts
    │   ├── timeout.ts
    │   ├── response.ts
    │   └── index.ts
    └── [function-name]/
        └── index.ts
```

### Barrel Exports

Use arquivos `index.ts` para exportar múltiplos módulos:

```typescript
// src/hooks/index.ts
export { AuthProvider } from './useAuth';
export { useAuth } from './useAuthContext';
export { useToast } from './useToast';
export { useSiteSettings } from './useSiteSettings';

// src/lib/index.ts
export { cn, parseLocalDate } from './utils';
export { logger, useLogger } from './logger';
export { isEventVisible } from './eventDateHelper';
```

---

## Nomenclatura

### Arquivos

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Componentes | PascalCase.tsx | `EventCard.tsx` |
| Hooks | camelCase.tsx | `useAuth.tsx` |
| Utilitários | camelCase.ts | `eventDateHelper.ts` |
| Tipos | index.ts em pasta types | `src/types/index.ts` |
| Edge Functions | kebab-case | `track-link-click/` |

### Variáveis e Funções

```typescript
// ✅ Correto
const eventDate = new Date();
const isLoading = true;
function fetchEvents() {}
const handleSubmit = () => {};

// ❌ Evitar
const EventDate = new Date();     // PascalCase para variável
const is_loading = true;          // snake_case
function FetchEvents() {}         // PascalCase para função
```

### Componentes e Tipos

```typescript
// ✅ Correto
interface EventCardProps { }
type CustomLink = { };
function EventCard({ }: EventCardProps) { }

// ❌ Evitar
interface eventCardProps { }      // camelCase para interface
type customLink = { };            // camelCase para type
```

---

## Imports

### Ordem de Imports

```typescript
// 1. React e hooks do React
import { useState, useEffect, useCallback } from "react";

// 2. Bibliotecas externas
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { z } from "zod";

// 3. Componentes UI
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// 4. Hooks personalizados
import { useAuth, useToast } from "@/hooks";

// 5. Utilitários e lib
import { cn, logger } from "@/lib";

// 6. Integrações
import { supabase } from "@/integrations/supabase/client";

// 7. Tipos
import type { CustomLink, SyncError } from "@/types";

// 8. Assets locais
import heroImage from "@/assets/hero.jpg";
```

### Imports Proibidos

```typescript
// ❌ NUNCA importar diretamente
import { createClient } from "@supabase/supabase-js";  // Use o client pré-configurado

// ❌ NUNCA modificar estes arquivos
// src/integrations/supabase/client.ts
// src/integrations/supabase/types.ts
// supabase/config.toml
```

---

## Componentes React

### Estrutura Padrão

```typescript
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { logger } from "@/lib";
import { supabase } from "@/integrations/supabase/client";

interface EventCardProps {
  eventId: string;
  onSelect?: (id: string) => void;
}

export function EventCard({ eventId, onSelect }: EventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (error) {
    logger.error("Error loading event", error, { component: "EventCard" });
    return <div>Erro ao carregar evento</div>;
  }

  return (
    <Card className="p-4">
      <h3>{data?.title}</h3>
      {/* Conteúdo */}
    </Card>
  );
}
```

### Props com Valores Default

```typescript
interface ButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

export function CustomButton({ 
  variant = "default", 
  size = "md", 
  disabled = false 
}: ButtonProps) {
  // ...
}
```

---

## TypeScript

### Tipos vs Interfaces

```typescript
// Use interface para objetos com propriedades
interface User {
  id: string;
  name: string;
  email: string;
}

// Use type para unions, intersections e aliases
type UserRole = "admin" | "moderator" | "user";
type ExtendedUser = User & { role: UserRole };
```

### Evitar `any`

```typescript
// ❌ Evitar
const data: any = response;
function handleError(error: any) {}

// ✅ Preferir
const data: User = response;
function handleError(error: unknown) {
  if (error instanceof Error) {
    logger.error(error.message);
  }
}
```

### Tipos Utilitários

Use tipos do arquivo `src/types/index.ts`:

```typescript
import type { SyncError, RawLinkData, AppError } from "@/types";
```

---

## Estilização

### Tailwind CSS

```typescript
// ✅ Use tokens semânticos do design system
<div className="bg-background text-foreground">
  <span className="text-primary">Texto destacado</span>
</div>

// ❌ Evitar cores hardcoded
<div className="bg-black text-white">
  <span className="text-purple-500">Texto</span>
</div>
```

### Função `cn()` para Classes Condicionais

```typescript
import { cn } from "@/lib";

<button 
  className={cn(
    "px-4 py-2 rounded-md",
    variant === "primary" && "bg-primary text-primary-foreground",
    variant === "secondary" && "bg-secondary text-secondary-foreground",
    disabled && "opacity-50 cursor-not-allowed"
  )}
>
  {children}
</button>
```

---

## Animações

O projeto usa **Framer Motion** (adicionado em 16/07/2026) para animações mais ricas — stagger,
tilt/parallax, glow que segue o mouse — mantendo os keyframes CSS existentes (`tailwind-animate`,
`index.css`) para os casos simples que já funcionavam (`animate-logo-pulse`, `animate-glow`, etc).

### Toda animação nova precisa respeitar `prefers-reduced-motion`

```typescript
import { useReducedMotion } from "framer-motion";

const prefersReducedMotion = useReducedMotion();

<motion.div
  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
/>
```

### Efeitos de ponteiro (tilt, magnetic, parallax) só ativam com mouse de verdade

```typescript
const onPointerMove = (e: React.PointerEvent) => {
  if (prefersReducedMotion || e.pointerType !== "mouse") return;
  // ...
};
```

### Toda `@keyframes`/`animate-*` nova entra nos DOIS blocos de desativação em `index.css`

```css
/* Desliga em mobile (perf) */
@media (max-width: 768px) {
  .animate-minha-animacao-nova { animation: none; }
}

/* Desliga se o usuário pediu reduzir movimento */
@media (prefers-reduced-motion: reduce) {
  .animate-minha-animacao-nova { animation: none; }
}
```

### Building blocks reutilizáveis (não recriar do zero)

| Peça | Arquivo | Uso |
|------|---------|-----|
| `useTiltRotate` / `useMuralParallax` | `src/hooks/useTiltParallax.ts` | Tilt 3D em card único / parallax de múltiplos cards a partir de um container |
| `useMagneticHover` | `src/hooks/useMagneticHover.ts` | Botão que se desloca sutilmente na direção do cursor |
| `SpotlightCard` | `src/components/effects/SpotlightCard.tsx` | Glow radial que segue o mouse dentro de um card |
| `AuroraBackground` | `src/components/effects/AuroraBackground.tsx` | Fundo ambiente com blobs animados usando os tokens neon do tema |
| `getBrandColor()` | `src/lib/brandColors.ts` | Cor real de marca (Instagram, WhatsApp, etc) aplicada só ao ícone, nunca ao chrome do card |

---

## Hooks Personalizados

### Estrutura Padrão

```typescript
// src/hooks/useEventData.tsx
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib";

interface UseEventDataReturn {
  events: Event[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useEventData(): UseEventDataReturn {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*");
      
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      logger.error("Error fetching events", err, { hook: "useEventData" });
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }, []);

  return { events, loading, error, refetch };
}
```

---

## Edge Functions

### Estrutura com Módulos Compartilhados

```typescript
// supabase/functions/my-function/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleCorsPreFlight,
  withTimeout,
  isRateLimited,
  getClientIP,
  jsonSuccess,
  badRequestResponse,
  rateLimitResponse,
  handleError,
} from "../_shared/index.ts";

const FUNCTION_TIMEOUT_MS = 10000;

Deno.serve(async (req) => {
  // 1. Handle CORS preflight
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  try {
    // 2. Parse request body
    const { resourceId } = await req.json();

    // 3. Validate input
    if (!resourceId) {
      return badRequestResponse("resourceId é obrigatório");
    }

    // 4. Check rate limit
    const clientIP = getClientIP(req);
    if (isRateLimited(clientIP, resourceId)) {
      console.log(`Rate limited: ${clientIP}`);
      return rateLimitResponse();
    }

    // 5. Initialize Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 6. Execute operation with timeout
    const { error } = await withTimeout(
      supabase.from("table").insert({ id: resourceId }),
      FUNCTION_TIMEOUT_MS
    );

    if (error) throw error;

    // 7. Return success
    console.log(`Operation completed for: ${resourceId}`);
    return jsonSuccess();

  } catch (error) {
    return handleError(error, "my-function");
  }
});
```

---

## Logging

### Usar Logger Centralizado

```typescript
import { logger } from "@/lib";

// Níveis disponíveis
logger.debug("Mensagem de debug", { context: "value" });
logger.info("Operação completada", { userId: "123" });
logger.warn("Aviso importante", { threshold: 80 });
logger.error("Erro crítico", error, { component: "EventCard" });

// Logger com escopo (para componentes)
const scopedLogger = logger.scope({ component: "EventCard" });
scopedLogger.error("Erro ao carregar", error);

// Hook para React
import { useLogger } from "@/lib";

function MyComponent() {
  const log = useLogger("MyComponent");
  log.info("Component mounted");
}
```

### Evitar console.log

```typescript
// ❌ Evitar em produção
console.log("debug:", data);
console.error("Error:", error);

// ✅ Preferir logger
logger.debug("debug data", { data });
logger.error("Operation failed", error, { context: "MyComponent" });
```

---

## Tratamento de Erros

### Padrão de try/catch

```typescript
try {
  const { data, error } = await supabase.from("events").select("*");
  if (error) throw error;
  return data;
} catch (error) {
  logger.error("Failed to fetch events", error, { component: "EventList" });
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  toast.error(message);
}
```

### Tipagem de Erros

```typescript
// ❌ Evitar
} catch (error: any) {
  toast.error(error.message);
}

// ✅ Preferir
} catch (error) {
  logger.error("Operation failed", error);
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  toast.error(message);
}
```

---

## Testes e Validação

### Validação com Zod

```typescript
import { z } from "zod";

const eventSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato: YYYY-MM-DD"),
  venue: z.string().min(1, "Local obrigatório"),
  ticket_link: z.string().url("URL inválida").optional(),
});

// Uso
const result = eventSchema.safeParse(formData);
if (!result.success) {
  const errors = result.error.flatten().fieldErrors;
  // Mostrar erros
}
```

---

## Checklist de Contribuição

Antes de submeter código, verifique:

- [ ] ESLint não reporta erros (`npm run lint`)
- [ ] Código formatado com Prettier (`npm run format`)
- [ ] Sem tipos `any` (use tipos específicos)
- [ ] Sem `console.log` (use logger)
- [ ] Erros tratados adequadamente
- [ ] Imports organizados na ordem correta
- [ ] Componentes com props tipadas
- [ ] Edge Functions usando módulos compartilhados

---

*Última atualização: 18/07/2026*
