import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isBotUserAgent } from './botDetection.ts';

Deno.test('isBotUserAgent: identifica crawlers de busca conhecidos', () => {
  assertEquals(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true);
  assertEquals(isBotUserAgent('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'), true);
  assertEquals(isBotUserAgent('Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)'), true);
  assertEquals(isBotUserAgent('AhrefsBot/7.0 (+http://ahrefs.com/robot/)'), true);
});

Deno.test('isBotUserAgent: identifica bots de preview de link (redes sociais)', () => {
  assertEquals(isBotUserAgent('facebookexternalhit/1.1'), true);
  assertEquals(isBotUserAgent('WhatsApp/2.23.20.0'), true);
  assertEquals(isBotUserAgent('TelegramBot (like TwitterBot)'), true);
  assertEquals(isBotUserAgent('Twitterbot/1.0'), true);
});

Deno.test('isBotUserAgent: identifica scripts/HTTP clients genéricos', () => {
  assertEquals(isBotUserAgent('curl/8.4.0'), true);
  assertEquals(isBotUserAgent('python-requests/2.31.0'), true);
  assertEquals(isBotUserAgent('axios/1.6.0'), true);
  assertEquals(isBotUserAgent('Go-http-client/1.1'), true);
  assertEquals(isBotUserAgent('okhttp/4.9.0'), true);
});

Deno.test('isBotUserAgent: identifica headless/monitoramento', () => {
  assertEquals(isBotUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/128.0.0.0'), true);
  assertEquals(isBotUserAgent('Pingdom.com_bot_version_1.4'), true);
  assertEquals(isBotUserAgent('UptimeRobot/2.0'), true);
});

Deno.test('isBotUserAgent: User-Agent ausente ou vazio conta como bot (defensivo)', () => {
  assertEquals(isBotUserAgent(null), true);
  assertEquals(isBotUserAgent(undefined), true);
  assertEquals(isBotUserAgent(''), true);
  assertEquals(isBotUserAgent('   '), true);
});

Deno.test('isBotUserAgent: navegadores reais (desktop/mobile) NÃO são marcados como bot', () => {
  assertEquals(
    isBotUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    ),
    false,
  );
  assertEquals(
    isBotUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23F84 Safari/604.1',
    ),
    false,
  );
  assertEquals(
    isBotUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15'),
    false,
  );
});

Deno.test('isBotUserAgent: o app Instagram (crawler de preview, roda em cima de um UA de navegador) é pego pelo termo Instagram? (não é, e tudo bem)', () => {
  // O UA do app Instagram (visto nos logs de Storage, 30/07) não contém
  // nenhum termo de bot — ele se disfarça de Mobile Safari de propósito.
  // Não dá pra pegar sem uma blocklist de app específica; documentado como
  // limitação conhecida, não coberto por este padrão.
  assertEquals(
    isBotUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23F84 Instagram 440.0.0.30.81 (iPhone18,2; iOS 26_5_2; pt_BR; pt; scale=3.00; 1320x2868; IABMV/1; 1025609183) Safari/604.1',
    ),
    false,
  );
});
