// Servidor Node.js mínimo para hospedagem na Hostinger (plano Node).
// Serve a build estática (dist/) e devolve index.html para qualquer
// rota desconhecida — assim /eventos, /blog/post-x funcionam ao
// colar a URL no navegador ou dar F5 (SPA fallback).

import express from "express";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, "dist");
const INDEX_HTML = path.join(DIST, "index.html");

if (!fs.existsSync(INDEX_HTML)) {
  console.error(
    `[server] dist/index.html não encontrado em ${DIST}. ` +
      `Rode "npm run build" antes de iniciar o servidor.`,
  );
  process.exit(1);
}

app.disable("x-powered-by");
app.use(compression());

// Assets com hash do Vite → cache imutável longo
app.use(
  "/assets",
  express.static(path.join(DIST, "assets"), {
    maxAge: "1y",
    immutable: true,
  }),
);

// Demais estáticos (favicon, robots.txt, sitemap.xml, service-worker, etc.)
app.use(
  express.static(DIST, {
    maxAge: "1h",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("service-worker.js")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

// Healthcheck simples para monitoramento
app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, ts: Date.now() });
});

// SPA fallback: entrega index.html e deixa o React Router cuidar
app.get(/.*/, (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(INDEX_HTML);
});

app.listen(PORT, () => {
  console.log(`[server] MDAccula rodando na porta ${PORT}`);
});
