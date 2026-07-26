import { ArrowLeft, Plus, Settings, Palette } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LinksManagerHeaderProps {
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (value: 'all' | 'active' | 'inactive') => void;
  onNewGroup: () => void;
  onNewLink: () => void;
  onOpenBulkSize: () => void;
  onOpenTemplateSettings: () => void;
}

export const LinksManagerHeader = ({
  statusFilter,
  onStatusFilterChange,
  onNewGroup,
  onNewLink,
  onOpenBulkSize,
  onOpenTemplateSettings,
}: LinksManagerHeaderProps) => (
  <div className="mb-8">
    <NavLink
      to="/admin"
      className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Voltar ao Painel
    </NavLink>
    <h1 className="text-3xl sm:text-4xl font-bold hero-text mb-4">Gerenciar Links</h1>
    <div className="flex flex-wrap gap-2">
      <Button onClick={onNewGroup}>
        <Plus className="w-4 h-4 mr-2" />
        Novo Grupo
      </Button>
      <Button variant="outline" onClick={onNewLink}>
        <Plus className="w-4 h-4 mr-2" />
        Novo Link
      </Button>
      <Button variant="secondary" onClick={onOpenBulkSize}>
        <Settings className="w-4 h-4 mr-2" />
        Ajustar Tamanhos
      </Button>
      <Button variant="outline" onClick={onOpenTemplateSettings}>
        <Palette className="w-4 h-4 mr-2" />
        Template & Avatar
      </Button>
    </div>

    <div className="flex items-center gap-2 mt-4">
      <span className="text-sm text-muted-foreground">Filtrar:</span>
      <Select
        value={statusFilter}
        onValueChange={(v) => onStatusFilterChange(v as 'all' | 'active' | 'inactive')}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Ativos</SelectItem>
          <SelectItem value="inactive">Inativos</SelectItem>
          <SelectItem value="all">Todos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
);

export default LinksManagerHeader;
