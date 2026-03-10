import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { Switch } from '@/components/ui/switch';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { ImageUploadWithCrop } from '@/components/ui/ImageUploadWithCrop';
import { convertToWebP } from '@/lib/webpConverter';

interface BlogFormData {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  published: boolean;
}

// Blog post type for editing - uses partial fields since different sources may provide different fields
interface BlogPost {
  id: string;
  title: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  category: string;
  published?: boolean;
  published_at?: string | null;
  image_url?: string | null;
  views?: number | null;
  likes?: number | null;
  created_at?: string;
}

interface BlogFormProps {
  post?: BlogPost;
  onSuccess: () => void;
  onCancel: () => void;
}

const CATEGORIES = ['Eventos', 'Cena SP', 'Festivais', 'História', 'Guias', 'Entrevistas'];

export const BlogForm = ({ post, onSuccess, onCancel }: BlogFormProps) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState(post?.published || false);
  const [content, setContent] = useState(post?.content || '');
  const { toast } = useToast();

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<BlogFormData>({
    defaultValues: post ? {
      title: post.title,
      excerpt: post.excerpt || '',
      content: post.content,
      category: post.category,
      published: post.published,
    } : {
      published: false,
    }
  });

  const handleImageSelect = (file: File) => {
    setImageFile(file);
  };

  const uploadImage = async () => {
    if (!imageFile) return null;

    setUploading(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('event-images')
        .upload(fileName, imageFile);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('event-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Erro ao fazer upload da imagem",
        description: "Tente novamente",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const checkSlugExists = async (slug: string): Promise<boolean> => {
    const { data } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    return !!data;
  };

  const generateUniqueSlug = async (title: string): Promise<string> => {
    const baseSlug = generateSlug(title);
    let slug = baseSlug;
    let counter = 1;
    
    while (await checkSlugExists(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  };

  const onSubmit = async (data: BlogFormData) => {
    setSubmitting(true);
    try {
      let imageUrl = post?.image_url;
      
      if (imageFile) {
        imageUrl = await uploadImage();
        if (!imageUrl) {
          setSubmitting(false);
          return;
        }
      }

      const postData = {
        ...data,
        content, // Use content from RichTextEditor
        published,
        image_url: imageUrl,
        published_at: published && !post?.published ? new Date().toISOString() : post?.published_at,
      };

      if (post) {
        const { error } = await supabase
          .from('blog_posts')
          .update(postData)
          .eq('id', post.id);
        
        if (error) throw error;
        
        toast({
          title: "Post atualizado com sucesso!",
        });
      } else {
        const slug = await generateUniqueSlug(data.title);
        
        const { error } = await supabase
          .from('blog_posts')
          .insert([{ ...postData, slug }]);
        
        if (error) throw error;
        
        toast({
          title: "Post criado com sucesso!",
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        title: "Erro ao salvar post",
        description: "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{post ? 'Editar Post' : 'Novo Post'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              {...register('title', { required: 'Título é obrigatório' })}
              placeholder="Título do post"
            />
            {errors.title && <span className="text-sm text-destructive">{errors.title.message}</span>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
            <Select onValueChange={(value) => setValue('category', value)} defaultValue={post?.category}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Resumo</Label>
            <Textarea
              id="excerpt"
              {...register("excerpt", { required: "Resumo é obrigatório" })}
              rows={3}
              className="resize-none"
            />
            {errors.excerpt && (
              <p className="text-sm text-destructive">{errors.excerpt.message}</p>
            )}
          </div>

          <RichTextEditor
            content={content}
            onChange={setContent}
            label="Conteúdo"
            placeholder="Escreva o conteúdo do post aqui..."
          />

          <ImageUploadWithCrop
            onImageSelect={handleImageSelect}
            currentImageUrl={post?.image_url}
            label="Imagem do Post"
            aspectRatio={16 / 9}
            cropMode="optional"
          />

          <div className="flex items-center space-x-2">
            <Switch
              id="published"
              checked={published}
              onCheckedChange={setPublished}
            />
            <Label htmlFor="published">Publicar imediatamente</Label>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={submitting || uploading} className="flex-1">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {post ? 'Atualizar' : 'Criar'} Post
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
