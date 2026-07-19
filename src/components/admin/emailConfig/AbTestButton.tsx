/**
 * AbTestButton — botão + modal para disparar teste A/B de assunto.
 *
 * Extraído de `src/pages/admin/EmailConfig.tsx` (Fase C do slim-down).
 * Cria DUAS campanhas na E-goi (variantes A e B) com assuntos distintos,
 * agrupadas por `ab_group_id`. O vencedor é apurado depois pelas métricas.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Send } from 'lucide-react';

interface AbTestButtonProps {
  eventTitle: string;
  defaultSubject: string;
  disabled?: boolean;
  onConfirm: (params: {
    subjectA: string;
    subjectB: string;
    winnerMetric: 'opens' | 'clicks';
    sendNow: boolean;
  }) => void | Promise<void>;
}

export const AbTestButton = ({
  eventTitle,
  defaultSubject,
  disabled,
  onConfirm,
}: AbTestButtonProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [subjectA, setSubjectA] = useState(defaultSubject);
  const [subjectB, setSubjectB] = useState('');
  const [winnerMetric, setWinnerMetric] = useState<'opens' | 'clicks'>('opens');
  const [sendNow, setSendNow] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [typed, setTyped] = useState('');
  const reset = () => {
    setStep(1);
    setReviewed(false);
    setTyped('');
    setSubjectA(defaultSubject);
    setSubjectB('');
    setWinnerMetric('opens');
    setSendNow(false);
  };
  const canContinue =
    subjectA.trim().length >= 3 &&
    subjectB.trim().length >= 3 &&
    subjectA.trim() !== subjectB.trim() &&
    reviewed;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Send className="w-4 h-4 mr-2" /> Teste A/B assunto
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        {step === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Teste A/B de assunto — {eventTitle}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-sm">
                    Serão criadas <b>duas campanhas</b> na E-goi, cada uma com um assunto diferente.
                    Ambas vão para a lista completa. O vencedor é apurado depois pelas métricas
                    (abertura ou clique).
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Obs.: a API v3 da E-goi não expõe split-test nativo por assunto — este é o fluxo
                    de "duas campanhas independentes". Recomendado apenas com listas ≥ 1000 contatos
                    para o resultado ter significância.
                  </p>
                  <div>
                    <Label>Assunto A</Label>
                    <Input
                      value={subjectA}
                      onChange={(e) => setSubjectA(e.target.value)}
                      placeholder="Ex.: Novo evento chegou 🔥"
                    />
                  </div>
                  <div>
                    <Label>Assunto B</Label>
                    <Input
                      value={subjectB}
                      onChange={(e) => setSubjectB(e.target.value)}
                      placeholder="Ex.: Você não vai querer perder este"
                    />
                    {subjectA.trim() && subjectB.trim() && subjectA.trim() === subjectB.trim() && (
                      <p className="text-xs text-red-500 mt-1">
                        Assuntos A e B precisam ser diferentes.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Métrica vencedora</Label>
                    <Select
                      value={winnerMetric}
                      onValueChange={(v) => setWinnerMetric(v as 'opens' | 'clicks')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="opens">Taxa de abertura</SelectItem>
                        <SelectItem value="clicks">Taxa de cliques</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendNow}
                      onChange={(e) => setSendNow(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      Enviar agora (imediato). Se desmarcado, cria apenas os rascunhos na E-goi.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      Eu revisei os assuntos e sei que <b>duas campanhas</b> serão criadas.
                    </span>
                  </label>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button disabled={!canContinue} onClick={() => setStep(2)}>
                Continuar
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Última confirmação</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-sm">
                    Para liberar o {sendNow ? 'envio' : 'criação'} do teste A/B, digite{' '}
                    <b>ENVIAR AB</b>.
                  </p>
                  <Input
                    autoFocus
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Digite ENVIAR AB"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={typed.trim().toUpperCase() !== 'ENVIAR AB'}
                onClick={async () => {
                  setOpen(false);
                  reset();
                  await onConfirm({
                    subjectA: subjectA.trim(),
                    subjectB: subjectB.trim(),
                    winnerMetric,
                    sendNow,
                  });
                }}
              >
                Sim, {sendNow ? 'enviar' : 'criar rascunhos'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};
