import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BulkSizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bulkWidth: number;
  bulkHeight: number;
  onBulkWidthChange: (value: number) => void;
  onBulkHeightChange: (value: number) => void;
  onApply: () => void;
}

export const BulkSizeDialog = ({
  open,
  onOpenChange,
  bulkWidth,
  bulkHeight,
  onBulkWidthChange,
  onBulkHeightChange,
  onApply,
}: BulkSizeDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Ajustar Tamanho dos Cards</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="bulk-width">Largura (px)</Label>
          <Input
            id="bulk-width"
            type="number"
            value={bulkWidth}
            onChange={(e) => onBulkWidthChange(Number(e.target.value))}
            min={300}
            max={1200}
          />
          <p className="text-xs text-muted-foreground">Recomendado: 650px</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bulk-height">Altura (px)</Label>
          <Input
            id="bulk-height"
            type="number"
            value={bulkHeight}
            onChange={(e) => onBulkHeightChange(Number(e.target.value))}
            min={60}
            max={300}
          />
          <p className="text-xs text-muted-foreground">
            Recomendado: 80px (cards normais) ou 200px (cards em destaque)
          </p>
        </div>
        <div className="bg-muted p-3 rounded-lg">
          <p className="text-sm text-muted-foreground">
            ⚠️ Esta ação aplicará os tamanhos para <strong>todos os cards</strong> existentes.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button onClick={onApply}>Aplicar a Todos</Button>
      </div>
    </DialogContent>
  </Dialog>
);

export default BulkSizeDialog;
