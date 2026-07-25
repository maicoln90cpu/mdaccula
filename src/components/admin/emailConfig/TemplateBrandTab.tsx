/**
 * Aba "Template (marca)" da página `/admin → E-mail`.
 *
 * Extraída de `src/pages/admin/EmailConfig.tsx` (Onda 2 PR-B do plano de
 * slim-down). Mantém 100% do comportamento: mesmos inputs, mesmos handlers
 * (via props), mesmo preview lateral.
 */
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Image as ImageIcon, Palette, RefreshCw, Save } from 'lucide-react';
import { InboxPreviewHeader } from '@/components/admin/InboxPreviewHeader';
import type {
  EventAnnouncementData,
  EmailTemplateSettings,
} from '@/lib/emailTemplates/emailComposer';
import type { Template } from '@/lib/emailTemplates/blocks';

type TplState = EmailTemplateSettings & { id?: string };

type PreviewSource = 'event' | 'digest' | 'weekend' | 'blog';

interface TemplateBrandTabProps {
  tpl: TplState;
  setTpl: (t: TplState) => void;
  tplSaving: boolean;
  uploadingLogo: boolean;
  uploadLogo: (file: File) => void | Promise<void>;
  saveTemplate: () => void | Promise<void>;
  activeTemplate: Template | null;
  previewSource: PreviewSource;
  previewData: EventAnnouncementData;
  previewHtml: string;
  digestPreviewHtml: string;
  digestPreviewMeta: { subject?: string | null; preheader?: string | null } | null;
}

export function TemplateBrandTab({
  tpl,
  setTpl,
  tplSaving,
  uploadingLogo,
  uploadLogo,
  saveTemplate,
  activeTemplate,
  previewSource,
  previewData,
  previewHtml,
  digestPreviewHtml,
  digestPreviewMeta,
}: TemplateBrandTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" /> Marca
            </CardTitle>
            <CardDescription>Logo e nome exibidos no topo do e-mail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Nome da marca (fallback sem logo)</Label>
              <Input
                value={tpl.brand_name ?? ''}
                placeholder="MDACCULA"
                onChange={(e) => setTpl({ ...tpl, brand_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Logo (PNG/SVG, máx 500KB)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  disabled={uploadingLogo}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadLogo(f);
                  }}
                />
                {uploadingLogo && <RefreshCw className="w-4 h-4 animate-spin" />}
              </div>
              {tpl.logo_url && (
                <div className="mt-2 flex items-center gap-3 p-2 rounded border bg-muted/20">
                  <img
                    src={tpl.logo_url}
                    alt="Logo"
                    className="h-10 w-auto bg-black rounded"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTpl({ ...tpl, logo_url: null })}
                  >
                    Remover
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" /> Cores
            </CardTitle>
            <CardDescription>Base do gradiente do CTA e destaques.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                ['primary_color', 'Cor primária'],
                ['accent_color', 'Cor de acento'],
                ['background_color', 'Fundo do e-mail'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <Label className="w-40 shrink-0">{label}</Label>
                <input
                  type="color"
                  value={tpl[key] ?? '#000000'}
                  onChange={(e) => setTpl({ ...tpl, [key]: e.target.value })}
                  className="h-9 w-14 rounded border cursor-pointer bg-transparent"
                />
                <Input
                  value={tpl[key] ?? ''}
                  onChange={(e) => setTpl({ ...tpl, [key]: e.target.value })}
                  placeholder="#a855f7"
                  className="font-mono text-xs"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Textos e links (fallback global)</CardTitle>
            <CardDescription>
              Valores usados como padrão. Se o <b>Editor de blocos</b> tem um botão CTA ou
              link secundário com texto próprio, o texto do bloco tem prioridade sobre este
              campo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Texto do botão principal (CTA) — fallback</Label>
              <Input
                value={tpl.cta_label ?? ''}
                placeholder="Garantir ingresso"
                onChange={(e) => setTpl({ ...tpl, cta_label: e.target.value })}
              />
            </div>
            <div>
              <Label>Texto do link secundário — fallback</Label>
              <Input
                value={tpl.secondary_link_label ?? ''}
                placeholder="Ver agenda completa no site"
                onChange={(e) => setTpl({ ...tpl, secondary_link_label: e.target.value })}
              />
            </div>
            <div>
              <Label>Rodapé (aviso de descadastro)</Label>
              <Textarea
                rows={3}
                value={tpl.footer_text ?? ''}
                onChange={(e) => setTpl({ ...tpl, footer_text: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              💡 Redes sociais agora são configuradas dentro de cada template, no bloco{' '}
              <b>Redes sociais</b> do
              <b> Editor de blocos</b>. Assim cada template pode ter suas próprias redes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>HTML no topo e no rodapé (opcional)</CardTitle>
            <CardDescription>
              Cola HTML fixo antes da logo (ex.: "Newsletter #12 · Maio 2026") e depois do
              descadastro (ex.: razão social, CNPJ). Aplicado a <b>todos</b> os templates.
              Scripts, styles e handlers on* são removidos automaticamente por segurança.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>HTML no topo (antes da logo)</Label>
              <Textarea
                rows={4}
                className="font-mono text-xs"
                placeholder="<p>Newsletter #12 · Maio 2026</p>"
                value={tpl.custom_html_header ?? ''}
                onChange={(e) => setTpl({ ...tpl, custom_html_header: e.target.value })}
              />
            </div>
            <div>
              <Label>HTML no rodapé (após descadastro)</Label>
              <Textarea
                rows={4}
                className="font-mono text-xs"
                placeholder="<p>MDAccula LTDA · São Paulo-SP</p>"
                value={tpl.custom_html_footer ?? ''}
                onChange={(e) => setTpl({ ...tpl, custom_html_footer: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end sticky bottom-4">
          <Button onClick={saveTemplate} disabled={tplSaving} size="lg">
            <Save className="w-4 h-4 mr-2" />
            {tplSaving ? 'Salvando...' : 'Salvar template'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-[#050505] p-4 lg:sticky lg:top-4 lg:self-start">
        <div className="text-xs text-muted-foreground mb-2 px-1">
          Preview ao vivo (dados mock)
        </div>
        <InboxPreviewHeader
          subjectTemplate={activeTemplate?.subject_template}
          preheaderTemplate={activeTemplate?.preheader_template}
          overrideSubject={
            previewSource !== 'event' ? (digestPreviewMeta?.subject ?? null) : null
          }
          overridePreheader={
            previewSource !== 'event' ? (digestPreviewMeta?.preheader ?? null) : null
          }
          data={{
            eventTitle: previewData.eventTitle,
            dateLabel: previewData.dateLabel,
            timeLabel: previewData.timeLabel,
            venueName: previewData.venueName,
            cityState: previewData.cityState,
          }}
        />
        <iframe
          title="Template preview"
          srcDoc={previewSource !== 'event' ? digestPreviewHtml || previewHtml : previewHtml}
          sandbox=""
          className="mx-auto block h-[820px] w-full max-w-[640px] rounded-md border-0 bg-white"
        />
      </div>
    </div>
  );
}
