import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getBRTDayWindowUTC, computeVariancePct, buildEmailHtml, type MetricResult } from "./metrics.ts";

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
