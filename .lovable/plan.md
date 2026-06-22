## Causa raiz

O console mostra o erro exato:

```
TypeError: can't access property "slice", e.time is null
  em EventsCarousel.tsx:150
```

Na linha 150 do `src/components/events/EventsCarousel.tsx` existe:

```tsx
<span>{weekDay} • {event.time.slice(0, 5)}</span>
```

Quando algum evento tem `time = null` no banco, `null.slice(...)` quebra o React inteiro e o `ErrorBoundary` da página `/eventos` exibe a tela "Algo deu errado". Acontece igual em preview e produção porque o dado é o mesmo.

## Antes vs depois

| | Antes | Depois |
|---|---|---|
| Evento sem horário | Página inteira quebra | Mostra só o dia da semana (sem horário) |
| `event.time = "22:00:00"` | Mostra "22:00" | Mostra "22:00" (igual) |

## Correção (1 linha, baixíssimo risco)

Arquivo: `src/components/events/EventsCarousel.tsx`, linha 150.

De:
```tsx
<span>{weekDay} • {event.time.slice(0, 5)}</span>
```

Para:
```tsx
<span>{weekDay}{event.time ? ` • ${event.time.slice(0, 5)}` : ''}</span>
```

## Checklist de validação
- [ ] Abrir `/eventos` em preview → carrossel carrega normalmente
- [ ] Abrir `/eventos` em produção (mdaccula.com) após deploy
- [ ] Eventos com horário continuam exibindo "Sex • 22:00"
- [ ] Eventos sem horário exibem só "Sex"

## Prevenção de regressão
- Sugiro (etapa futura, não agora) varrer outros `.slice(`, `.toLowerCase(`, `.split(` em campos vindos do banco que podem ser `null` (ex.: `subtitle`, `location`) e aplicar guarda parecida. Posso fazer essa varredura depois que confirmar que o fix de agora resolveu.

## Pendências futuras (não agora)
- Criar teste unitário do `EventsCarousel` renderizando um evento com `time: null` para travar regressão.
- Avaliar tornar `time` NOT NULL no banco com default, se a regra do negócio permitir.

Posso aplicar só essa correção pontual?