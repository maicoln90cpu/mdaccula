import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getBRTDayWindowUTC,
  getBRTMonthToDateWindows,
  computeVariancePct,
  formatBRTDate,
  formatBRTDateRange,
  findMostFrequent,
  buildEmailHtml,
  type MetricResult,
  type TopEntity,
  type PeriodCardData,
} from "./metrics.ts";

Deno.test("getBRTDayWindowUTC: caso básico (referência ao meio-dia UTC)", () => {
  // 2026-07-18T12:00:00Z = 09:00 BRT → "hoje" BRT é 2026-07-18.
  const ref = new Date("2026-07-18T12:00:00.000Z");
  const yesterday = getBRTDayWindowUTC(1, ref);
  assertEquals(yesterday.startUTC.toISOString(), "2026-07-17T03:00:00.000Z");
  assertEquals(yesterday.endUTC.toISOString(), "2026-07-18T03:00:00.000Z");
});

Deno.test("getBRTDayWindowUTC: madrugada UTC ainda é 'ontem' em BRT", () => {
  // 2026-07-18T02:00:00Z = 23:00 BRT do dia 17 → "hoje" BRT é 2026-07-17.
  const ref = new Date("2026-07-18T02:00:00.000Z");
  const yesterday = getBRTDayWindowUTC(1, ref);
  assertEquals(yesterday.startUTC.toISOString(), "2026-07-16T03:00:00.000Z");
  assertEquals(yesterday.endUTC.toISOString(), "2026-07-17T03:00:00.000Z");
});

Deno.test("getBRTDayWindowUTC: virada de mês", () => {
  const ref = new Date("2026-08-01T10:00:00.000Z");
  const yesterday = getBRTDayWindowUTC(1, ref);
  assertEquals(yesterday.startUTC.toISOString(), "2026-07-31T03:00:00.000Z");
  assertEquals(yesterday.endUTC.toISOString(), "2026-08-01T03:00:00.000Z");
});

Deno.test("getBRTDayWindowUTC: virada de ano", () => {
  const ref = new Date("2027-01-01T10:00:00.000Z");
  const yesterday = getBRTDayWindowUTC(1, ref);
  assertEquals(yesterday.startUTC.toISOString(), "2026-12-31T03:00:00.000Z");
  assertEquals(yesterday.endUTC.toISOString(), "2027-01-01T03:00:00.000Z");
});

Deno.test("getBRTDayWindowUTC: janela de baseline de 7 dias fecha exatamente onde 'ontem' começa", () => {
  const ref = new Date("2026-07-18T12:00:00.000Z");
  const yesterday = getBRTDayWindowUTC(1, ref);
  const baselineStart = getBRTDayWindowUTC(8, ref).startUTC;
  assertEquals(baselineStart.toISOString(), "2026-07-10T03:00:00.000Z");
  assertEquals(yesterday.startUTC.getTime() - baselineStart.getTime(), 7 * 24 * 60 * 60 * 1000);
});

Deno.test("computeVariancePct: baseline zero retorna null (nunca Infinity)", () => {
  assertEquals(computeVariancePct(50, 0), null);
});

Deno.test("computeVariancePct: baseline negativo retorna null", () => {
  assertEquals(computeVariancePct(50, -10), null);
});

Deno.test("computeVariancePct: aumento de 50%", () => {
  assertEquals(computeVariancePct(150, 100), 50);
});

Deno.test("computeVariancePct: queda de 50%", () => {
  assertEquals(computeVariancePct(50, 100), -50);
});

Deno.test("buildEmailHtml: todos os contadores zerados não quebra e não gera NaN/Infinity", () => {
  const metrics: MetricResult[] = [
    {
      key: "link_clicks",
      label: "Cliques no Linktree",
      yesterday: 0,
      dayBefore: 0,
      baselineDailyAvg: 0,
      varianceVsDayBeforePct: computeVariancePct(0, 0),
      varianceVsBaselinePct: computeVariancePct(0, 0),
    },
  ];
  const html = buildEmailHtml(metrics, "17/07/2026");
  assertStringIncludes(html, "sem dado de comparação");
  assertEquals(html.includes("NaN"), false);
  assertEquals(html.includes("Infinity"), false);
});

Deno.test("buildEmailHtml: inclui rótulo e valor de cada métrica", () => {
  const metrics: MetricResult[] = [
    {
      key: "event_views",
      label: "Visualizações de Eventos",
      yesterday: 42,
      dayBefore: 30,
      baselineDailyAvg: 35.5,
      varianceVsDayBeforePct: computeVariancePct(42, 30),
      varianceVsBaselinePct: computeVariancePct(42, 35.5),
    },
  ];
  const html = buildEmailHtml(metrics, "17/07/2026");
  assertStringIncludes(html, "Visualizações de Eventos");
  assertStringIncludes(html, "42");
  assertStringIncludes(html, "17/07/2026");
});

// Regressão R-020 — o e-mail chegou com fundo branco e fonte branca (ilegível)
// porque buildEmailHtml devolvia um <div> solto, sem <html>/<head>/<body>. Sem
// esse wrapper, o cliente de e-mail (Outlook, ou o auto-dark-mode do Apple
// Mail/Gmail) aplica o fundo branco padrão dele e ignora o `background` do
// <div>, mas as cores de texto (#eee, #fff) continuam pensadas pro fundo
// escuro — texto claro sobre fundo claro. A correção usa uma estrutura
// table-based com <html><head><meta color-scheme="dark">...<body
// bgcolor>, igual ao padrão já usado em weekly-digest-draft/index.ts.
Deno.test("buildEmailHtml: usa wrapper completo <html>/<head>/<body> com fundo escuro declarado", () => {
  const metrics: MetricResult[] = [
    {
      key: "link_clicks",
      label: "Cliques no Linktree",
      yesterday: 10,
      dayBefore: 8,
      baselineDailyAvg: 9,
      varianceVsDayBeforePct: computeVariancePct(10, 8),
      varianceVsBaselinePct: computeVariancePct(10, 9),
    },
  ];
  const html = buildEmailHtml(metrics, "18/07/2026");
  assertStringIncludes(html, "<html");
  assertStringIncludes(html, "<body");
  assertStringIncludes(html, 'name="color-scheme" content="dark"');
  assertStringIncludes(html, "background-color:#0a0a0a");
});

Deno.test("findMostFrequent: array vazio retorna null", () => {
  assertEquals(findMostFrequent([]), null);
});

Deno.test("findMostFrequent: acha o id que mais se repete", () => {
  const result = findMostFrequent(["a", "b", "a", "c", "a", "b"]);
  assertEquals(result, { id: "a", count: 3 });
});

Deno.test("findMostFrequent: um único id aparece uma vez", () => {
  assertEquals(findMostFrequent(["x"]), { id: "x", count: 1 });
});

Deno.test("buildEmailHtml: sem destaques (topEntities vazio ou omitido) não gera a seção", () => {
  const metrics: MetricResult[] = [
    {
      key: "blog_views",
      label: "Visualizações do Blog",
      yesterday: 0,
      dayBefore: 0,
      baselineDailyAvg: 0,
      varianceVsDayBeforePct: null,
      varianceVsBaselinePct: null,
    },
  ];
  const html = buildEmailHtml(metrics, "18/07/2026");
  assertEquals(html.includes("Destaques de ontem"), false);
});

Deno.test("buildEmailHtml: com destaques, mostra nome, contagem e link de cada item", () => {
  const metrics: MetricResult[] = [];
  const topEntities: TopEntity[] = [
    {
      emoji: "📰",
      label: "Artigo mais acessado",
      name: "Solomun anuncia turnê no Brasil",
      url: "https://mdaccula.com/blog/solomun-turne-brasil",
      count: 57,
    },
    {
      emoji: "🔗",
      label: "Link mais clicado",
      name: "Ingressos",
      url: "https://exemplo.com/ingressos",
      count: 12,
    },
  ];
  const html = buildEmailHtml(metrics, "18/07/2026", topEntities);
  assertStringIncludes(html, "Destaques de ontem");
  assertStringIncludes(html, "Artigo mais acessado");
  assertStringIncludes(html, "Solomun anuncia turnê no Brasil");
  assertStringIncludes(html, "https://mdaccula.com/blog/solomun-turne-brasil");
  assertStringIncludes(html, "57");
  assertStringIncludes(html, "Link mais clicado");
});

Deno.test("buildEmailHtml: destaque com count 0 é filtrado (não aparece)", () => {
  const metrics: MetricResult[] = [];
  const topEntities: TopEntity[] = [
    { emoji: "🎟️", label: "Evento mais visto", name: "Nunca visto", url: null, count: 0 },
  ];
  const html = buildEmailHtml(metrics, "18/07/2026", topEntities);
  assertEquals(html.includes("Destaques de ontem"), false);
  assertEquals(html.includes("Nunca visto"), false);
});

Deno.test("buildEmailHtml: escapa HTML no nome do destaque (título vindo do banco)", () => {
  const metrics: MetricResult[] = [];
  const topEntities: TopEntity[] = [
    {
      emoji: "📰",
      label: "Artigo mais acessado",
      name: '<script>alert("x")</script>',
      url: null,
      count: 3,
    },
  ];
  const html = buildEmailHtml(metrics, "18/07/2026", topEntities);
  assertEquals(html.includes("<script>alert"), false);
  assertStringIncludes(html, "&lt;script&gt;");
});

Deno.test("buildEmailHtml: inclui o logo no topo", () => {
  const html = buildEmailHtml([], "18/07/2026");
  assertStringIncludes(html, "https://mdaccula.com/logo-mdaccula.jpeg");
  assertStringIncludes(html, 'alt="MDAccula"');
});

Deno.test("formatBRTDate: formata dd/mm/yyyy por padrão", () => {
  assertEquals(formatBRTDate(new Date("2026-07-18T03:00:00.000Z")), "18/07/2026");
});

Deno.test("formatBRTDate: sem ano quando withYear=false", () => {
  assertEquals(formatBRTDate(new Date("2026-07-18T03:00:00.000Z"), false), "18/07");
});

Deno.test("formatBRTDateRange: mostra o último dia incluído, não o limite exclusivo", () => {
  // janela [12/07 00h BRT, 19/07 00h BRT) cobre 12/07 a 18/07 inclusive.
  const start = new Date("2026-07-12T03:00:00.000Z");
  const end = new Date("2026-07-19T03:00:00.000Z");
  assertEquals(formatBRTDateRange(start, end), "12/07 – 18/07");
});

Deno.test("getBRTMonthToDateWindows: mês atual do dia 1 até ontem, mesmo intervalo no mês anterior", () => {
  // "ontem" = 18/07/2026 (18 dias corridos de julho).
  const yesterdayStart = getBRTDayWindowUTC(1, new Date("2026-07-19T12:00:00.000Z")).startUTC;
  const { current, previous } = getBRTMonthToDateWindows(yesterdayStart);
  assertEquals(formatBRTDateRange(current.startUTC, current.endUTC), "01/07 – 18/07");
  assertEquals(formatBRTDateRange(previous.startUTC, previous.endUTC), "01/06 – 18/06");
});

Deno.test("getBRTMonthToDateWindows: trunca no mês anterior mais curto (31/03 → fevereiro só tem 28)", () => {
  const yesterdayStart = getBRTDayWindowUTC(1, new Date("2026-04-01T12:00:00.000Z")).startUTC; // ontem = 31/03/2026
  const { current, previous } = getBRTMonthToDateWindows(yesterdayStart);
  assertEquals(formatBRTDateRange(current.startUTC, current.endUTC), "01/03 – 31/03");
  assertEquals(formatBRTDateRange(previous.startUTC, previous.endUTC), "01/02 – 28/02");
});

Deno.test("getBRTMonthToDateWindows: virada de ano (ontem em janeiro → mês anterior é dezembro do ano passado)", () => {
  const yesterdayStart = getBRTDayWindowUTC(1, new Date("2027-01-05T12:00:00.000Z")).startUTC; // ontem = 04/01/2027
  const { current, previous } = getBRTMonthToDateWindows(yesterdayStart);
  assertEquals(formatBRTDateRange(current.startUTC, current.endUTC), "01/01 – 04/01");
  assertEquals(formatBRTDateRange(previous.startUTC, previous.endUTC), "01/12 – 04/12");
  assertEquals(previous.startUTC.getUTCFullYear(), 2026);
});

Deno.test("buildEmailHtml: renderiza os cards de período (últimos 7 dias / mês atual) com título, range e variação", () => {
  const periodCards: PeriodCardData[] = [
    {
      emoji: "📅",
      title: "Últimos 7 dias",
      rangeLabel: "12/07 – 18/07 · vs. 05/07 – 11/07",
      rows: [
        { key: "link_clicks", label: "Cliques no Linktree", current: 70, previous: 56, variancePct: computeVariancePct(70, 56) },
      ],
    },
    {
      emoji: "🗓️",
      title: "Mês atual",
      rangeLabel: "01/07 – 18/07 · vs. 01/06 – 18/06",
      rows: [
        { key: "link_clicks", label: "Cliques no Linktree", current: 300, previous: 250, variancePct: computeVariancePct(300, 250) },
      ],
    },
  ];
  const html = buildEmailHtml([], "18/07/2026", [], periodCards);
  assertStringIncludes(html, "Últimos 7 dias");
  assertStringIncludes(html, "12/07 – 18/07 · vs. 05/07 – 11/07");
  assertStringIncludes(html, "Mês atual");
  assertStringIncludes(html, "01/07 – 18/07 · vs. 01/06 – 18/06");
  assertStringIncludes(html, "70");
  assertStringIncludes(html, "300");
});

Deno.test("buildEmailHtml: sem períodos informados (default) não gera cards de período", () => {
  const html = buildEmailHtml([], "18/07/2026");
  assertEquals(html.includes("Últimos 7 dias"), false);
  assertEquals(html.includes("Mês atual"), false);
});
