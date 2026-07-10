import { describe, it, expect } from 'vitest';
import { renderBlockedTemplate, type Block } from '@/lib/emailTemplates/blocks';
import { MOCK_EVENT_DATA } from '@/lib/emailTemplates/eventAnnouncement';

describe('renderBlockedTemplate — bloco oculto (hidden:true)', () => {
  it('não renderiza HTML de blocos marcados como hidden', () => {
    const blocks: Block[] = [
      { id: 'a', kind: 'eyebrow', text: 'VISIVEL_MARKER', align: 'left' },
      { id: 'b', kind: 'eyebrow', text: 'INVISIVEL_MARKER', align: 'left', hidden: true } as Block,
    ];
    const html = renderBlockedTemplate(blocks, MOCK_EVENT_DATA, null, null, { preview: true });
    expect(html).toContain('VISIVEL_MARKER');
    expect(html).not.toContain('INVISIVEL_MARKER');
  });
});
