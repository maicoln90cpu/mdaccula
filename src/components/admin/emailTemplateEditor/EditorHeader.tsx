/**
 * EditorHeader — Passo 1 (chips de tipo) + Passo 2 (select de template) + ações
 * (Novo/Duplicar/Excluir/Salvar) + inputs de nome/assunto/preheader.
 * Extraído do EmailTemplateEditor na Onda 12 sem alterações de comportamento.
 */
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Trash2, Copy, Save } from 'lucide-react';
import { TEMPLATE_PRESETS, type PresetKey, type Template } from '@/lib/emailTemplates/blocks';
import { PlaceholdersHelpDialog } from '../PlaceholdersHelpDialog';
import {
  TYPE_FILTER_ORDER,
  TYPE_FILTER_LABELS,
  type TypeFilterKey,
} from './typeFilter';

interface EditorHeaderProps {
  typeFilter: TypeFilterKey;
  countsByType: Record<TypeFilterKey, number>;
  onTypeFilterChange: (k: TypeFilterKey) => void;
  filteredTemplates: Template[];
  activeId: string | null;
  activeTpl: Template | null;
  isDirty: boolean;
  saving: boolean;
  currentName: string;
  currentSubject: string;
  currentPreheader: string;
  onActiveChange: (id: string) => void;
  onCreateTemplate: (presetKey?: PresetKey) => void;
  onDuplicateTemplate: () => void;
  onDeleteTemplate: () => void;
  onSaveTemplate: () => void;
  onNameChange: (v: string) => void;
  onSubjectChange: (v: string) => void;
  onPreheaderChange: (v: string) => void;
}

export const EditorHeader = ({
  typeFilter,
  countsByType,
  onTypeFilterChange,
  filteredTemplates,
  activeId,
  activeTpl,
  isDirty,
  saving,
  currentName,
  currentSubject,
  currentPreheader,
  onActiveChange,
  onCreateTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onSaveTemplate,
  onNameChange,
  onSubjectChange,
  onPreheaderChange,
}: EditorHeaderProps) => (
  <>
    {/* Passo 1 — escolher o TIPO do template */}
    <div>
      <Label className="text-xs mb-1.5 block">1º Tipo de template</Label>
      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTER_ORDER.map((key) => {
          const active = typeFilter === key;
          const count = countsByType[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTypeFilterChange(key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground/80 border-border hover:border-primary/50'
              }`}
            >
              {TYPE_FILTER_LABELS[key]}{' '}
              <span className={active ? 'opacity-80' : 'text-muted-foreground'}>({count})</span>
            </button>
          );
        })}
      </div>
    </div>

    {/* Passo 2 — escolher o template daquele tipo + ações */}
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex-1 min-w-[240px]">
        <Label className="text-xs flex items-center gap-2">
          2º Template de {TYPE_FILTER_LABELS[typeFilter]}
          {isDirty && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              • não salvo
            </span>
          )}
        </Label>
        {filteredTemplates.length === 0 ? (
          <div className="text-xs text-muted-foreground border border-dashed border-border rounded px-3 py-2">
            Nenhum template de "{TYPE_FILTER_LABELS[typeFilter]}" ainda. Use "Novo" para criar.
          </div>
        ) : (
          <Select value={activeId || ''} onValueChange={onActiveChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um template" />
            </SelectTrigger>
            <SelectContent>
              {filteredTemplates.map((t) => (
                <SelectItem key={t.id!} value={t.id!}>
                  {t.name} {t.is_default && '· padrão'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-1" />
            Novo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Criar a partir de preset</DropdownMenuLabel>
          {TEMPLATE_PRESETS.map((p) => (
            <DropdownMenuItem
              key={p.key}
              onClick={() => onCreateTemplate(p.key)}
              className="flex-col items-start gap-0.5"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-[11px] text-muted-foreground whitespace-normal">
                {p.description}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onCreateTemplate()}>Em branco</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="outline" onClick={onDuplicateTemplate} disabled={!activeTpl}>
        <Copy className="w-4 h-4 mr-1" />
        Duplicar
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onDeleteTemplate}
        disabled={!activeTpl || activeTpl.is_default}
      >
        <Trash2 className="w-4 h-4 mr-1" />
        Excluir
      </Button>
      <Button
        size="sm"
        variant={isDirty ? 'default' : 'outline'}
        onClick={onSaveTemplate}
        disabled={!activeTpl || saving || !isDirty}
        className={isDirty ? 'ring-2 ring-amber-500/40' : ''}
      >
        <Save className="w-4 h-4 mr-1" />
        {saving ? 'Salvando…' : isDirty ? 'Salvar alterações' : 'Salvo'}
      </Button>
    </div>

    {activeTpl && (
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Nome do template</Label>
          <Input
            value={currentName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Nome do template"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Assunto do e-mail</Label>
              <PlaceholdersHelpDialog />
            </div>
            <Input
              value={currentSubject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Ex.: Novo evento: {{event_title}}"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Aceita <code>{'{{event_title}}'}</code>, <code>{'{{date_label}}'}</code>,{' '}
              <code>{'{{venue_name}}'}</code>, <code>{'{{city_state}}'}</code>,{' '}
              <code>{'{{weekend_range}}'}</code> e mais — clique em <b>Ver placeholders</b>.
            </p>
          </div>
          <div>
            <Label className="text-xs">Preheader (preview na caixa de entrada)</Label>
            <Input
              value={currentPreheader}
              onChange={(e) => onPreheaderChange(e.target.value)}
              placeholder="Ex.: {{event_title}} em {{venue_name}} — ingressos abertos"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Texto curto exibido ao lado do assunto. Aceita os mesmos placeholders.
            </p>
          </div>
        </div>
      </div>
    )}
  </>
);
