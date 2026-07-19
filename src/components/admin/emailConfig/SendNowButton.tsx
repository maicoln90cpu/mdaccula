/**
 * SendNowButton — botão de envio imediato com dupla confirmação.
 *
 * Extraído de `src/pages/admin/EmailConfig.tsx` (Fase C do slim-down).
 * Comportamento 100% idêntico ao original:
 *   1) Modal explicativo + checkbox "Eu revisei o conteúdo".
 *   2) Digitação obrigatória da palavra "ENVIAR" antes do botão liberar.
 * Só chama `onConfirm()` depois das duas etapas.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface SendNowButtonProps {
  eventTitle: string;
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
}

export const SendNowButton = ({ eventTitle, disabled, onConfirm }: SendNowButtonProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [reviewed, setReviewed] = useState(false);
  const [typed, setTyped] = useState('');
  const reset = () => {
    setStep(1);
    setReviewed(false);
    setTyped('');
  };
  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" disabled={disabled}>
          <Send className="w-4 h-4 mr-2" /> Enviar agora
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {step === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Envio imediato — atenção!</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Você está prestes a <b>enviar de verdade</b> o e-mail do evento{' '}
                    <b>{eventTitle}</b> para toda a lista configurada na E-goi. Isso{' '}
                    <b>não pode ser desfeito</b>.
                  </p>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                      className="mt-1"
                    />
                    <span>Eu revisei o conteúdo, o assunto e o remetente estão corretos.</span>
                  </label>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button disabled={!reviewed} onClick={() => setStep(2)}>
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
                  <p>
                    Para liberar o envio, digite <b>ENVIAR</b> no campo abaixo.
                  </p>
                  <Input
                    autoFocus
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Digite ENVIAR"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={typed.trim().toUpperCase() !== 'ENVIAR'}
                onClick={async () => {
                  setOpen(false);
                  reset();
                  await onConfirm();
                }}
              >
                Sim, enviar agora
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};
