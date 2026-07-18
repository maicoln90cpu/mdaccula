import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Save, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeBR } from "@/lib/formatters";

interface AlertRow {
  id: string;
  triggered_at: string;
  reason: string;
  window_bytes: number;
  baseline_bytes: number;
  ratio: number | null;
  threshold_mb: number | null;
  email_sent: boolean;
  email_error: string | null;
}

const formatMB = (b: number) => (b / (1024 * 1024)).toFixed(2) + " MB";

export const EgressAlertsCard = () => {
  const [enabled, setEnabled] = useState(true);
  const [thresholdMb, setThresholdMb] = useState(500);
  const [ratio, setRatio] = useState(2);
  const [email, setEmail] = useState("");
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    const { data: cfgRows } = await supabase.from("site_settings")
      .select("key,value")
      .in("key", [
        "egress_alert_enabled",
        "egress_alert_threshold_mb",
        "egress_alert_ratio",
        "egress_alert_email",
      ]);
    const map = new Map((cfgRows ?? []).map((r) => [r.key, r.value]));
    setEnabled(Boolean(map.get("egress_alert_enabled") ?? true));
    setThresholdMb(Number(map.get("egress_alert_threshold_mb") ?? 500));
    setRatio(Number(map.get("egress_alert_ratio") ?? 2));
    setEmail(String(map.get("egress_alert_email") ?? ""));

    const { data: alertRows } = await supabase.from("egress_alerts")
      .select("*")
      .order("triggered_at", { ascending: false })
      .limit(10);
    setAlerts((alertRows ?? []) as AlertRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: "egress_alert_enabled", value: enabled },
        { key: "egress_alert_threshold_mb", value: thresholdMb },
        { key: "egress_alert_ratio", value: ratio },
        { key: "egress_alert_email", value: email },
      ];
      for (const u of updates) {
        await supabase.from("site_settings").upsert(u, { onConflict: "key" });
      }
      toast.success("Configurações salvas");
    } catch (err) {
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("egress-alert-cron");
      if (error) throw error;
      toast.success(
        data?.alerted
          ? `Alerta disparado: ${data.reason}`
          : "Verificação executada — nada anormal.",
      );
      await loadAll();
    } catch (err) {
      toast.error("Erro ao executar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Alertas Automáticos de Egress</CardTitle>
          </div>
          <CardDescription>
            Cron diário compara consumo das últimas 24h com a média dos 7 dias anteriores.
            Dispara e-mail quando: total {`>`} limite, OU consumo {`>`} média × fator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Alertas ativados</Label>
              <p className="text-xs text-muted-foreground">Desligue para pausar checagens.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="threshold">Limite 24h (MB)</Label>
              <Input
                id="threshold"
                type="number"
                min={1}
                value={thresholdMb}
                onChange={(e) => setThresholdMb(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">Alerta se 24h {`>`} valor.</p>
            </div>
            <div>
              <Label htmlFor="ratio">Fator vs. média</Label>
              <Input
                id="ratio"
                type="number"
                min={1}
                step={0.1}
                value={ratio}
                onChange={(e) => setRatio(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">Ex.: 2.0 = pico 2×.</p>
            </div>
            <div>
              <Label htmlFor="email">E-mail destinatário</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Deixe vazio para não enviar.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving} size="sm">
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Salvando…" : "Salvar"}
            </Button>
            <Button onClick={runNow} disabled={testing} size="sm" variant="outline">
              <PlayCircle className="h-4 w-4 mr-1" />
              {testing ? "Executando…" : "Executar verificação agora"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos 10 alertas disparados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum alerta disparado até agora. ✅
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Quando</th>
                    <th className="text-left py-2 px-2">Motivo</th>
                    <th className="text-right py-2 px-2">24h</th>
                    <th className="text-right py-2 px-2">Base/dia</th>
                    <th className="text-right py-2 px-2">Razão</th>
                    <th className="text-center py-2 px-2">E-mail</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id} className="border-b">
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        {formatDateTimeBR(a.triggered_at)}
                      </td>
                      <td className="py-2 px-2 text-xs">{a.reason}</td>
                      <td className="py-2 px-2 text-xs text-right">{formatMB(a.window_bytes)}</td>
                      <td className="py-2 px-2 text-xs text-right">
                        {formatMB(a.baseline_bytes)}
                      </td>
                      <td className="py-2 px-2 text-xs text-right">
                        {a.ratio ? a.ratio.toFixed(2) + "×" : "—"}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {a.email_sent ? (
                          <span className="text-green-600" title="Enviado">✓</span>
                        ) : (
                          <span
                            className="text-yellow-600"
                            title={a.email_error ?? "Não enviado"}
                          >
                            ⚠
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
