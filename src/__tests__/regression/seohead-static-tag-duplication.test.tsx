/**
 * Regressão — og:title, og:description, twitter:title/description, meta
 * description e canonical nunca mudavam por rota pra ninguém que executa JS
 * (usuário real, Googlebot, o pipeline de prerender) — ficavam sempre com o
 * texto genérico do site.
 *
 * Causa: index.html tem essas tags hardcoded como fallback estático (pro caso
 * de um crawler sem JS chegar antes da hidratação). react-helmet-async só
 * reconhece e substitui <meta>/<link> que já tenham o atributo `data-rh` (ver
 * node_modules/react-helmet-async/lib/index.esm.js, updateTags() — filtra por
 * `${type}[data-rh]`) — sem esse atributo nas tags estáticas, o Helmet nunca
 * as via, e só ACRESCENTAVA a versão real ao lado da genérica. Resultado:
 * duas tags `og:title` no DOM final, e a genérica (primeira) é a que
 * parsers de link preview normalmente respeitam.
 *
 * Correção: index.html ganhou `data-rh="true"` nessas tags — agora o Helmet
 * as reconhece como próprias e as substitui de verdade no primeiro render.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { SEOHead } from "@/components/SEOHead";

function seedStaticShellTags() {
  document.head.innerHTML = `
    <meta name="description" content="MDAccula - A maior agência de música eletrônica de São Paulo." data-rh="true">
    <meta property="og:title" content="MDAccula - Música Eletrônica em São Paulo" data-rh="true">
    <meta name="twitter:title" content="MDAccula - Música Eletrônica em São Paulo" data-rh="true">
    <meta property="og:description" content="MDAccula - A maior agência de música eletrônica de São Paulo." data-rh="true">
    <meta name="twitter:description" content="MDAccula - A maior agência de música eletrônica de São Paulo." data-rh="true">
    <link rel="canonical" href="https://mdaccula.com" data-rh="true">
  `;
}

describe("Regressão — SEOHead substitui (não duplica) as tags estáticas de index.html", () => {
  beforeEach(() => {
    seedStaticShellTags();
  });

  it("og:title/twitter:title da rota substituem o genérico do shell — só uma tag sobra", async () => {
    render(
      <HelmetProvider>
        <SEOHead
          title="Helvétia Open Bar"
          description="Evento real na Helvétia"
          url="https://mdaccula.com/eventos/helvetia2509"
        />
      </HelmetProvider>
    );

    await waitFor(() => {
      const ogTitles = document.head.querySelectorAll('meta[property="og:title"]');
      expect(ogTitles).toHaveLength(1);
      expect(ogTitles[0].getAttribute("content")).toBe("Helvétia Open Bar | MDAccula");
    });

    const twitterTitles = document.head.querySelectorAll('meta[name="twitter:title"]');
    expect(twitterTitles).toHaveLength(1);
    expect(twitterTitles[0].getAttribute("content")).toBe("Helvétia Open Bar | MDAccula");
  });

  it("meta description e canonical da rota também substituem o genérico (não só og:title)", async () => {
    render(
      <HelmetProvider>
        <SEOHead
          title="Helvétia Open Bar"
          description="Evento real na Helvétia"
          url="https://mdaccula.com/eventos/helvetia2509"
        />
      </HelmetProvider>
    );

    await waitFor(() => {
      const descriptions = document.head.querySelectorAll('meta[name="description"]');
      expect(descriptions).toHaveLength(1);
      expect(descriptions[0].getAttribute("content")).toBe("Evento real na Helvétia");

      const canonicals = document.head.querySelectorAll('link[rel="canonical"]');
      expect(canonicals).toHaveLength(1);
      expect(canonicals[0].getAttribute("href")).toBe("https://mdaccula.com/eventos/helvetia2509");
    });
  });
});
