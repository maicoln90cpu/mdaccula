// templates/generate-sitemap.mjs
// Copiar para scripts/generate-sitemap.mjs e adaptar DOMAIN e staticPages

import { writeFileSync } from 'node:fs';

const DOMAIN = 'https://[dominio]'; // TROCAR
const TODAY = new Date().toISOString().split('T')[0];

const staticPages = [
  { url: '/',        priority: '1.0', changefreq: 'weekly'  },
  { url: '/pricing', priority: '0.9', changefreq: 'monthly' },
  { url: '/faq',     priority: '0.7', changefreq: 'monthly' },
  // adicionar rotas publicas do projeto
  // NUNCA adicionar: /login, /dashboard, /settings, /admin
];

const urls = staticPages.map(({ url, priority, changefreq }) => `
  <url>
    <loc>${DOMAIN}${url}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

writeFileSync('public/sitemap.xml', sitemap.trim());
console.log(`Sitemap gerado: ${staticPages.length} URLs`);
