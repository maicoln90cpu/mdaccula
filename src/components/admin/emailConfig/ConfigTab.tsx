/**
 * ConfigTab — aba "Configuração" da tela Admin → E-mail.
 *
 * Extraído de `src/pages/admin/EmailConfig.tsx` (Fase C do slim-down).
 * Comportamento 100% preservado:
 *  - Status geral (Master switch + toggle da agência).
 *  - Configuração de envio (Lista/Segmento/Remetente/Modo).
 *  - Bloco informativo "Teste de disparo" (aponta para outras abas).
 *
 * Toda a lógica de fetch/save continua no pai; aqui é só apresentação +
 * delegação via callbacks — não há chamada Supabase neste componente.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Save, ShieldAlert, ShieldCheck, Users, FileText } from 'lucide-react';
import type { EgoiConfig, ListItem, Mode, SegmentItem, SenderItem } from './types';
import type { Template } from '@/lib/emailTemplates/blocks';
import { formatDateTimeBR } from '@/lib/formatters';

interface ConfigTabProps {
  masterEnabled: boolean;
  toggleMaster: (v: boolean) => void | Promise<void>;

  cfg: EgoiConfig;
  setCfg: (cfg: EgoiConfig) => void;
  canEnableAuto: boolean;

  lists: ListItem[];
  senders: SenderItem[];
  segments: SegmentItem[];
  templates: Template[];
  listTotal: number | null;
  reachEstimate: number | null;

  fetchingResources: boolean;
  fetchingSegments: boolean;
  lastSyncedAt: string | null;
  fetchEgoiResources: () => void | Promise<void>;

  saving: boolean;
  save: () => void | Promise<void>;

  formatCount: (n: number | null | undefined) => string;
}

export const ConfigTab = ({
  masterEnabled,
  toggleMaster,
  cfg,
  setCfg,
  canEnableAuto,
  lists,
  senders,
  segments,
  templates,
  listTotal,
  reachEstimate,
  fetchingResources,
  fetchingSegments,
  lastSyncedAt,
  fetchEgoiResources,
  saving,
  save,
  formatCount,
}: ConfigTabProps) => {
  return (
    <div className="space-y-6">
      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Status geral
          </CardTitle>
          <CardDescription>
            Dois níveis de segurança. Ambos precisam estar <b>ON</b> para disparos automáticos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div>
              <div className="font-medium">Master switch</div>
              <div className="text-xs text-muted-foreground">
                Trava global da automação. Deixe OFF enquanto valida; ligue para permitir disparos
                reais.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={masterEnabled ? 'default' : 'secondary'}>
                {masterEnabled ? 'ON' : 'OFF'}
              </Badge>
              <Switch checked={masterEnabled} onCheckedChange={toggleMaster} />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <div className="font-medium">Ativado pela agência</div>
              <div className="text-xs text-muted-foreground">
                {canEnableAuto
                  ? 'Toggle disponível — lista e remetente já configurados.'
                  : 'Preencha lista e remetente antes de habilitar.'}
              </div>
            </div>
            <Switch
              checked={cfg.is_enabled}
              disabled={!canEnableAuto}
              onCheckedChange={(v) => setCfg({ ...cfg, is_enabled: v })}
            />
          </div>

          {!masterEnabled && cfg.is_enabled && (
            <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Toggle da agência está ON, mas o Master ainda está OFF. Nada será disparado até a
                agência liberar.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuração */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração de envio</CardTitle>
          <CardDescription>
            Lista, segmento (opcional), remetente e modo de disparo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchEgoiResources}
              disabled={fetchingResources}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${fetchingResources ? 'animate-spin' : ''}`} />
              {lists.length > 0 || senders.length > 0
                ? 'Atualizar da E-goi'
                : 'Buscar listas e remetentes da E-goi'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {lists.length > 0 || senders.length > 0
                ? `${lists.length} listas • ${senders.length} remetentes${lastSyncedAt ? ` • sincronizado ${formatDateTimeBR(lastSyncedAt)}` : ''}`
                : 'Clique para popular os selects (usa sua API key).'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Lista */}
            <div>
              <Label>Lista (list_id)</Label>
              {lists.length > 0 ? (
                <Select
                  value={cfg.list_id?.toString() ?? ''}
                  onValueChange={(v) => setCfg({ ...cfg, list_id: Number(v), segment_id: null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a lista" />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map((l) => (
                      <SelectItem key={l.list_id} value={l.list_id.toString()}>
                        {l.internal_name || l.public_name || `Lista ${l.list_id}`}
                        {typeof l.total_contacts === 'number' &&
                          ` — ${formatCount(l.total_contacts)} contatos`}{' '}
                        (#{l.list_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
                  placeholder="Ex: 12345"
                  value={cfg.list_id ?? ''}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      list_id: e.target.value ? Number(e.target.value) : null,
                      segment_id: null,
                    })
                  }
                />
              )}
            </div>

            {/* Remetente */}
            <div>
              <Label>Remetente (sender_id)</Label>
              {senders.length > 0 ? (
                <Select
                  value={cfg.sender_id?.toString() ?? ''}
                  onValueChange={(v) => setCfg({ ...cfg, sender_id: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o remetente" />
                  </SelectTrigger>
                  <SelectContent>
                    {senders.map((s) => (
                      <SelectItem key={s.sender_id} value={s.sender_id.toString()}>
                        {s.name || s.email || `Sender ${s.sender_id}`}
                        {s.email && s.name ? ` <${s.email}>` : ''} (#{s.sender_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
                  placeholder="Ex: 6789"
                  value={cfg.sender_id ?? ''}
                  onChange={(e) =>
                    setCfg({ ...cfg, sender_id: e.target.value ? Number(e.target.value) : null })
                  }
                />
              )}
            </div>

            {/* Segmento */}
            <div className="md:col-span-2">
              <Label className="flex items-center gap-2">
                Segmento (opcional)
                {fetchingSegments && <RefreshCw className="w-3 h-3 animate-spin" />}
              </Label>
              <Select
                value={cfg.segment_id?.toString() ?? 'all'}
                onValueChange={(v) =>
                  setCfg({ ...cfg, segment_id: v === 'all' ? null : Number(v) })
                }
                disabled={!cfg.list_id}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      cfg.list_id ? 'Todos os contatos da lista' : 'Selecione uma lista primeiro'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Todos os contatos da lista
                    {typeof listTotal === 'number' && ` — ${formatCount(listTotal)} contatos`}
                  </SelectItem>
                  {segments.map((s) => (
                    <SelectItem key={s.segment_id} value={s.segment_id.toString()}>
                      {s.name}
                      {typeof s.total_contacts === 'number' &&
                        ` — ${formatCount(s.total_contacts)} contatos`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Sem segmento = envia para toda a lista. Segmentos vêm direto da E-goi.
              </p>
            </div>

            {/* Modo */}
            <div>
              <Label>Modo de disparo</Label>
              <Select value={cfg.mode} onValueChange={(v) => setCfg({ ...cfg, mode: v as Mode })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho (admin revisa e envia manual)</SelectItem>
                  <SelectItem value="immediate">Imediato (envia direto)</SelectItem>
                  <SelectItem value="scheduled">Agendado (dias antes do evento)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Recomendado: <b>Rascunho</b> nas primeiras semanas até validar o fluxo.
              </p>
            </div>

            {cfg.mode === 'scheduled' && (
              <div>
                <Label>Dias antes do evento</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={cfg.scheduled_days_before}
                  onChange={(e) =>
                    setCfg({ ...cfg, scheduled_days_before: Number(e.target.value) || 1 })
                  }
                />
              </div>
            )}

            {/* Template padrão para novos eventos */}
            <div className="md:col-span-2">
              <Label className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Template padrão para novo evento
              </Label>
              <Select
                value={cfg.default_event_template_id ?? 'none'}
                onValueChange={(v) =>
                  setCfg({ ...cfg, default_event_template_id: v === 'none' ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template do tipo Evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (usar primeiro template de evento)</SelectItem>
                  {templates
                    .filter((t) => t.type === 'event_new')
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.is_default ? ' (padrão)' : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Usado pelo botão de automação de e-mail na criação/edição de eventos. Selecione um
                template do tipo "Evento".
              </p>
            </div>
          </div>

          {/* Alcance estimado */}
          {cfg.list_id && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm">
                Alcance estimado: <b>{formatCount(reachEstimate)}</b> contatos
                {cfg.segment_id ? ' (segmento)' : ' (lista inteira)'}
              </span>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar configuração'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Teste — agora um atalho real, não um placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Teste de disparo</CardTitle>
          <CardDescription>
            O teste real fica na aba <b>Preview</b> ("Enviar teste agora") e o disparo de
            rascunhos/envios reais na aba <b>Histórico</b> (por evento) ou <b>Virada de lote</b>{' '}
            (com arte específica).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          A caixa "Criar rascunho de teste (em breve)" foi substituída pelo fluxo real da aba{' '}
          <b>Histórico</b>. Use "Criar rascunho" ou "Enviar agora" no evento desejado — cada disparo
          fica registrado com status e ID da E-goi.
        </CardContent>
      </Card>
    </div>
  );
};
