/**
 * Contract test (estático) — Fase C4 (item #2 e #3) da reorganização dos
 * controles de publicação (10/08/2026): scan-event-sources e
 * apify-instagram-webhook publicam o post do Event Watcher com um UPDATE
 * separado (generate-blog-post-v2 sempre insere com publishImmediately:false
 * aqui), o que bypassa a checagem de qualidade que savePost.ts já faz no
 * insert. Precisam repetir a checagem antes desse update, e avisar por
 * e-mail quando publicam de fato sem revisão.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(`${process.cwd()}/${path}`, 'utf-8');

describe('Contract: Event Watcher (scan-event-sources/apify-instagram-webhook) repete checagem de qualidade e avisa antes de publicar sem revisão', () => {
  it('scan-event-sources checa isContentSubstantial antes do update de publish e avisa por e-mail', () => {
    const content = read('supabase/functions/scan-event-sources/index.ts');
    expect(content).toContain("import { notifyAutoPublish } from \"../_shared/autoPublishAlert.ts\"");
    expect(content).toContain("import { isContentSubstantial } from \"../_shared/articleQuality.ts\"");
    expect(content).toContain('if (autoPublish && isContentSubstantial(data.post.content))');
    expect(content).toContain("source: 'event_watcher'");
  });

  it('apify-instagram-webhook checa isContentSubstantial antes do update de publish e avisa por e-mail', () => {
    const content = read('supabase/functions/apify-instagram-webhook/index.ts');
    expect(content).toContain("import { notifyAutoPublish } from \"../_shared/autoPublishAlert.ts\"");
    expect(content).toContain("import { isContentSubstantial } from \"../_shared/articleQuality.ts\"");
    expect(content).toContain('if (autoPublish && isContentSubstantial(generateData.post.content))');
    expect(content).toContain("source: 'event_watcher'");
  });

  it('auto-article-cron avisa por e-mail só quando o post realmente saiu publicado (não só quando o toggle pedia)', () => {
    const content = read('supabase/functions/auto-article-cron/index.ts');
    expect(content).toContain("import { notifyAutoPublish } from \"../_shared/autoPublishAlert.ts\"");
    expect(content).toContain('if (generateData.post?.published)');
    expect(content).toContain("source: 'auto_cron'");
  });
});
