import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CustomLink, LinkGroup } from './types';

interface AddToGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkToAddToGroup: CustomLink | null;
  targetGroupId: string;
  onTargetGroupIdChange: (id: string) => void;
  groups: LinkGroup[];
  onConfirm: () => void;
}

export const AddToGroupDialog = ({
  open,
  onOpenChange,
  linkToAddToGroup,
  targetGroupId,
  onTargetGroupIdChange,
  groups,
  onConfirm,
}: AddToGroupDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Adicionar a Outro Grupo</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">
          Selecione o grupo onde deseja adicionar o link "{linkToAddToGroup?.title}":
        </p>
        <Select value={targetGroupId} onValueChange={onTargetGroupIdChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o grupo" />
          </SelectTrigger>
          <SelectContent>
            {groups
              .filter((g) => g.id !== linkToAddToGroup?.group_id)
              .map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={!targetGroupId}>
          Adicionar
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

export default AddToGroupDialog;
