import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { PreviewPanel } from '@/components/admin/emailTemplateEditor/PreviewPanel';
import { MOCK_EVENT_DATA } from '@/lib/emailTemplates/eventAnnouncement';

afterEach(() => cleanup());

describe('PreviewPanel — seletor de dispositivo (desktop/tablet/celular)', () => {
  it('começa em 600px (desktop) e troca a largura do iframe ao selecionar tablet/celular', () => {
    render(
      <PreviewPanel
        html="<html><body>oi</body></html>"
        overrideHtml={null}
        isDirty={false}
        issues={[]}
        currentSubject="Assunto"
        currentPreheader="Preheader"
        previewEvent={MOCK_EVENT_DATA}
      />
    );

    const iframe = screen.getByTitle('preview') as HTMLIFrameElement;
    expect(iframe.style.width).toBe('600px');

    fireEvent.click(screen.getByRole('radio', { name: /tablet/i }));
    expect(iframe.style.width).toBe('480px');

    fireEvent.click(screen.getByRole('radio', { name: /celular/i }));
    expect(iframe.style.width).toBe('375px');

    fireEvent.click(screen.getByRole('radio', { name: /desktop/i }));
    expect(iframe.style.width).toBe('600px');
  });
});
