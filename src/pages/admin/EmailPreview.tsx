import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import {
  MOCK_EVENT_DATA,
  type EventAnnouncementData,
} from "@/lib/emailTemplates/eventAnnouncement";
import { buildPresetBlocks } from "@/lib/emailTemplates/blocks";
import { composeEmail } from "@/lib/emailTemplates/emailComposer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Preview do template de e-mail "Novo evento" (Fase B.2).
 *
 * Renderiza o HTML final dentro de um iframe com mock data editável,
 * simulando a caixa de entrada real. Sem persistência — só visualização.
 */
export default function EmailPreview() {
  const [data, setData] = useState<EventAnnouncementData>(MOCK_EVENT_DATA);

  const blocks = useMemo(() => buildPresetBlocks("event_new"), []);
  const html = useMemo(() => composeEmail({
    template: { blocks, subject_template: "{{event_title}}" },
    event: data,
  }).html, [blocks, data]);

  const update = (patch: Partial<EventAnnouncementData>) =>
    setData((prev) => ({ ...prev, ...patch }));

  return (
    <div className="min-h-screen bg-background p-6">
      <Helmet>
        <title>Preview do e-mail — MDAccula Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Preview do template de e-mail</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Fase B.2 — visualização do template "Novo evento". Edite os campos à esquerda para
            testar como o e-mail vai aparecer na caixa de entrada.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Form de mock */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados do evento (mock)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="eventTitle">Título</Label>
                <Input
                  id="eventTitle"
                  value={data.eventTitle}
                  onChange={(e) => update({ eventTitle: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="eventSubtitle">Subtítulo</Label>
                <Input
                  id="eventSubtitle"
                  value={data.eventSubtitle ?? ""}
                  onChange={(e) => update({ eventSubtitle: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="flyerUrl">Flyer URL</Label>
                <Input
                  id="flyerUrl"
                  value={data.flyerUrl}
                  onChange={(e) => update({ flyerUrl: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="dateLabel">Data</Label>
                  <Input
                    id="dateLabel"
                    value={data.dateLabel}
                    onChange={(e) => update({ dateLabel: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="timeLabel">Hora</Label>
                  <Input
                    id="timeLabel"
                    value={data.timeLabel}
                    onChange={(e) => update({ timeLabel: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="venueName">Local</Label>
                  <Input
                    id="venueName"
                    value={data.venueName}
                    onChange={(e) => update({ venueName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cityState">Cidade/UF</Label>
                  <Input
                    id="cityState"
                    value={data.cityState}
                    onChange={(e) => update({ cityState: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={data.description}
                  onChange={(e) => update({ description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ticketUrl">Link do ingresso</Label>
                <Input
                  id="ticketUrl"
                  value={data.ticketUrl}
                  onChange={(e) => update({ ticketUrl: e.target.value })}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setData(MOCK_EVENT_DATA)}
                >
                  Restaurar mock
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([html], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "mdaccula-email-preview.html";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Baixar HTML
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview iframe — fixo em 600px para refletir largura real do e-mail */}
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">
                Preview (600px — largura real na caixa de entrada)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border bg-[#050505] p-4">
                <iframe
                  title="Email preview"
                  srcDoc={html}
                  sandbox=""
                  width={600}
                  className="mx-auto block h-[900px] bg-white"
                  style={{ width: 600, minWidth: 600, border: 0 }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
