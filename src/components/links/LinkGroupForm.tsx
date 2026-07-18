import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/useToast";
import { z } from "zod";

const groupSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
});

interface LinkGroup {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  enabled: boolean;
}

interface LinkGroupFormProps {
  group: LinkGroup | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const LinkGroupForm = ({ group, onSuccess, onCancel }: LinkGroupFormProps) => {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const { toast } = useToast();

  useEffect(() => {
    if (group) {
      setName(group.name);
      setSlug(group.slug || '');
    }
  }, [group]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validação
    const result = groupSchema.safeParse({ name });
    if (!result.success) {
      const fieldErrors: { name?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "name") fieldErrors.name = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      // Verificar e gerar slug único se necessário
      let finalSlug = slug;
      if (!finalSlug) {
        finalSlug = await generateUniqueSlug(result.data.name);
      } else if (await checkSlugExists(finalSlug, group?.id)) {
        toast({
          variant: "destructive",
          title: "Slug já existe",
          description: "Escolha outro slug ou deixe vazio para gerar automaticamente",
        });
        setLoading(false);
        return;
      }

      if (group) {
        // Update
        const { error } = await supabase
          .from("link_groups")
          .update({ name: result.data.name, slug: finalSlug })
          .eq("id", group.id);

        if (error) throw error;
        toast({ title: "Grupo atualizado com sucesso" });
      } else {
        // Insert
        const { error } = await supabase
          .from("link_groups")
          .insert({ name: result.data.name, slug: finalSlug });

        if (error) throw error;
        toast({ title: "Grupo criado com sucesso" });
      }

      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        variant: "destructive",
        title: "Erro ao salvar grupo",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const checkSlugExists = async (slug: string, excludeId?: string): Promise<boolean> => {
    let query = supabase.from('link_groups').select('id').eq('slug', slug);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query.maybeSingle();
    return !!data;
  };

  const generateUniqueSlug = async (text: string): Promise<string> => {
    const baseSlug = generateSlug(text);
    let slug = baseSlug;
    let counter = 1;
    
    while (await checkSlugExists(slug, group?.id)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  };

  const copySlugLink = () => {
    const link = `${window.location.origin}/links/${slug}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do Grupo</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            // Gerar slug automaticamente se estiver criando novo
            if (!group) {
              setSlug(generateSlug(e.target.value));
            }
          }}
          placeholder="Ex: Redes Sociais"
          disabled={loading}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug (URL)</Label>
        <div className="flex gap-2">
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Ex: redes-sociais"
            disabled={loading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={copySlugLink}
            disabled={!slug}
          >
            Copiar Link
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Link: {window.location.origin}/links/{slug || 'slug-do-grupo'}
        </p>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando..." : group ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </form>
  );
};
