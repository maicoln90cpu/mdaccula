import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getBRTDayWindowUTC,
  computeVariancePct,
  findMostFrequent,
  buildEmailHtml,
  type MetricResult,
  type TopEntity,
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
