import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Plus, X, Upload, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { generateEventGroupName } from '@/lib/eventGroupHelper';
import { useNavigate } from 'react-router-dom';
import { parseLocalDateTime, formatEventDateRange } from '@/lib/dateUtils';
import { convertToWebP } from '@/lib/webpConverter';
import { uploadImageToBunny } from '@/lib/bunnyUploader';
import { buildArticlePayload } from '@/lib/eventArticlePayload';
import { reconcileSchedule, parseSchedule, type EventSchedule } from '@/lib/eventScheduleHelper';
import { normalizeLineup } from '@/lib/lineupNormalizer';
import { notifyEventChange } from '@/lib/indexnow';
import { dispatchEventDraftEmail } from '@/lib/emailTemplates/dispatchEventDraft';

interface EventFormData {
  title: string;
  venue: string;
  address?: string;
  location_state: string;
  location_city: string;
  date: string;
  end_date?: string;
  time: string;
  end_time?: string;
  ticket_link?: string;
  vip_link?: string;
  pix_button_enabled?: boolean;
  tickets_per_day?: boolean;
  description?: string;
  slug?: string;
  blog_post_id?: string;
  subtitle?: string;
}

interface EventFormProps {
  event?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const GENRES = [
  'Techno',
  'House', 
  'Tech House',
  'Deep House',
  'Progressive',
  'Trance',
  'Psytrance',
  'Drum & Bass',
  'Dubstep',
  'Trap',
  'Hip Hop',
  'Funk',
  'Sertanejo',
  'Pagode',
  'Samba',
  'Rock',
  'Pop',
  'Eletrônica',
  'EDM',
  'Open Format',
  'Festival',
  'Outros'
];

const STATES = [
  'SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'GO', 'PE', 'CE', 'PA', 'MA', 'PB', 'ES', 'PI', 'AL', 'RN', 'MT', 'MS', 'DF', 'SE', 'RO', 'TO', 'AC', 'AM', 'RR', 'AP'
];

// Normaliza URLs antes de salvar: garante protocolo https:// para qualquer domínio
// digitado sem ele (ex: sympla.com.br/x, bit.ly/x). Mantém em sincronia com
// src/lib/safeExternalUrl.ts (defesa em runtime).
const normalizeUrl = (url: string | undefined): string | undefined => {
  if (!url) return url;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("sms:")
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

export const EventForm = ({ event, onSuccess, onCancel }: EventFormProps) => {
  const [lineup, setLineup] = useState<string[]>(normalizeLineup(event?.lineup));
  const [newLineupItem, setNewLineupItem] = useState('');
  const [schedule, setSchedule] = useState<EventSchedule | null>(() => {
    const parsed = parseSchedule(event?.schedule);
    if (!parsed) return null;
    return parsed.map((e) => ({ ...e, lineup: normalizeLineup(e.lineup) }));
  });
  const [newScheduleArtist, setNewScheduleArtist] = useState<Record<string, string>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [blogSearchTerm, setBlogSearchTerm] = useState('');
  const [blogSearchResults, setBlogSearchResults] = useState<any[]>([]);
  const [selectedBlogPost, setSelectedBlogPost] = useState<any>(null);
  const [showBlogDropdown, setShowBlogDropdown] = useState(false);
  const [manualSlug, setManualSlug] = useState(event?.slug || '');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(event?.genres || []);
  const [createLink, setCreateLink] = useState(true);
  const [linkUrlType, setLinkUrlType] = useState<'ticket' | 'slug'>('ticket');
  const [generateBlogPost, setGenerateBlogPost] = useState(false);
  const [aiContext, setAiContext] = useState<string>(event?.ai_context || '');
  const [linkGroups, setLinkGroups] = useState<any[]>([]);
  const [eventTemplates, setEventTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  // B.6 — Toggle para criar rascunho automático de e-mail na E-goi ao salvar.
  // Default OFF (nunca dispara sem intent explícito do admin).
  const [dispatchEmail, setDispatchEmail] = useState(false);
  const [emailAutomationReady, setEmailAutomationReady] = useState(false);
  const [emailAutomationReason, setEmailAutomationReason] = useState<string>('');
  const { toast } = useToast();
  const navigate = useNavigate();

  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm<EventFormData>({
    defaultValues: event ? {
      title: event.title,
      venue: event.venue,
      address: event.address,
      location_state: event.location_state,
      location_city: event.location_city,
      date: event.date,
      end_date: event.end_date || '',
      time: event.time,
      end_time: event.end_time,
      ticket_link: event.ticket_link,
      vip_link: event.vip_link,
      pix_button_enabled: event.pix_button_enabled ?? false,
      tickets_per_day: event.tickets_per_day ?? false,
      description: event.description,
      subtitle: event.subtitle,
      blog_post_id: event.blog_post_id,
    } : {
      location_state: 'SP'
    }
  });

  const isEditing = !!event?.id;

  useEffect(() => {
    const fetchData = async () => {
      // Fetch initial blog posts (for pre-selected post)
      const { data: posts } = await supabase
        .from('blog_posts')
        .select('id, title, category')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(20);
      
      if (posts) setBlogPosts(posts);

      // If editing and has blog_post_id, fetch the selected post
      if (event?.blog_post_id && event.blog_post_id !== 'none') {
        const { data: selectedPost } = await supabase
          .from('blog_posts')
          .select('id, title, category')
          .eq('id', event.blog_post_id)
          .single();
        if (selectedPost) setSelectedBlogPost(selectedPost);
      }

      // Fetch link groups
      const { data: groups } = await supabase
        .from('link_groups')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (groups) setLinkGroups(groups);

      // Fetch event templates
      const { data: templates } = await supabase
        .from('event_templates')
        .select('*')
        .order('name');
      
      if (templates) setEventTemplates(templates);

      // B.6 — Descobrir se a automação de e-mail está pronta.
      // Só habilita o toggle se: master ON + agência ON + list/sender/template preenchidos.
      try {
        const [{ data: master }, { data: cfg }] = await Promise.all([
          supabase.from('site_settings').select('value').eq('key', 'egoi_email_enabled').maybeSingle(),
          (supabase.from as any)('egoi_config').select('is_enabled,list_id,sender_id,default_event_template_id').maybeSingle(),
        ]);
        if (master?.value !== 'true') {
          setEmailAutomationReady(false);
          setEmailAutomationReason('Automação desativada pela Lovable (master switch OFF).');
        } else if (!cfg || !cfg.is_enabled) {
          setEmailAutomationReady(false);
          setEmailAutomationReason('Automação desligada no painel /admin/email-config.');
        } else if (!cfg.list_id || !cfg.sender_id) {
          setEmailAutomationReady(false);
          setEmailAutomationReason('Lista ou remetente ainda não configurados.');
        } else if (!cfg.default_event_template_id) {
          setEmailAutomationReady(false);
          setEmailAutomationReason('Selecione um template padrão em /admin/email-config.');
        } else {
          setEmailAutomationReady(true);
          setEmailAutomationReason('');
        }
      } catch {
        setEmailAutomationReady(false);
        setEmailAutomationReason('Não foi possível verificar a automação de e-mail.');
      }
    };
    fetchData();
  }, []);

  // Search blog posts by title
  useEffect(() => {
    if (!blogSearchTerm || blogSearchTerm.length < 2) {
      setBlogSearchResults(blogPosts.slice(0, 10));
      return;
    }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, category')
        .eq('published', true)
        .ilike('title', `%${blogSearchTerm}%`)
        .order('published_at', { ascending: false })
        .limit(15);
      
      if (data) setBlogSearchResults(data);
    }, 300);

    return () => clearTimeout(timer);
  }, [blogSearchTerm, blogPosts]);

  const addLineupItem = () => {
    if (newLineupItem.trim()) {
      setLineup([...lineup, newLineupItem.trim()]);
      setNewLineupItem('');
    }
  };

  // ===== Programação por dia (festival) =====
  const watchedDate = watch('date');
  const watchedEndDate = watch('end_date');
  const watchedTime = watch('time');
  const watchedEndTime = watch('end_time');

  // Reconcilia schedule quando intervalo muda. Preserva line-up das datas que continuam.
  useEffect(() => {
    if (!watchedDate || !watchedEndDate || watchedEndDate === watchedDate) {
      // Sem festival → limpa schedule
      if (schedule !== null) setSchedule(null);
      return;
    }
    if (!watchedTime) return;
    const next = reconcileSchedule(schedule, watchedDate, watchedEndDate, watchedTime, watchedEndTime || null);
    // Só atualiza se mudou (evita loop)
    if (JSON.stringify(next) !== JSON.stringify(schedule)) {
      setSchedule(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedDate, watchedEndDate, watchedTime, watchedEndTime]);

  const updateScheduleEntry = (date: string, patch: Partial<EventSchedule[number]>) => {
    setSchedule((prev) => {
      if (!prev) return prev;
      return prev.map((e) => (e.date === date ? { ...e, ...patch } : e));
    });
  };

  const addScheduleArtist = (date: string) => {
    const value = (newScheduleArtist[date] || '').trim();
    if (!value) return;
    setSchedule((prev) => {
      if (!prev) return prev;
      return prev.map((e) =>
        e.date === date ? { ...e, lineup: [...(e.lineup || []), value] } : e,
      );
    });
    setNewScheduleArtist((s) => ({ ...s, [date]: '' }));
  };

  const removeScheduleArtist = (date: string, idx: number) => {
    setSchedule((prev) => {
      if (!prev) return prev;
      return prev.map((e) =>
        e.date === date
          ? { ...e, lineup: (e.lineup || []).filter((_, i) => i !== idx) }
          : e,
      );
    });
  };

  const applyTemplate = (templateId: string) => {
    const template = eventTemplates.find(t => t.id === templateId);
    if (!template) return;

    setValue('venue', template.venue);
    setValue('address', template.address || '');
    setValue('location_city', template.location_city);
    setValue('location_state', template.location_state);
    setValue('ticket_link', template.ticket_link || '');
    setValue('vip_link', template.vip_link || '');
    setValue('title', (template as any).title || '');
    setValue('subtitle', (template as any).subtitle || '');
    setValue('time', (template as any).time || '');
    setValue('description', (template as any).description || '');
    setSelectedGenres(template.genres || []);

    toast({
      title: "Template aplicado",
      description: `Dados do template "${template.name}" foram preenchidos no formulário`
    });
  };

  const removeLineupItem = (index: number) => {
    setLineup(lineup.filter((_, i) => i !== index));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return null;

    setUploading(true);
    try {
      const webpFile = await convertToWebP(imageFile);
      return await uploadImageToBunny(webpFile, 'event-images');
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

  const onSubmit = async (data: EventFormData) => {
    // 🔍 LOG DE DIAGNÓSTICO: Início do submit
    console.log('[EventForm] 📝 Iniciando submit do formulário', {
      isEditing,
      eventId: event?.id,
      generateBlogPost,
      createLink,
      title: data.title
    });

    setSubmitting(true);
    try {
      let imageUrl = event?.image_url;
      
      if (imageFile) {
        console.log('[EventForm] 📷 Fazendo upload de imagem...');
        imageUrl = await uploadImage();
        if (!imageUrl) {
          console.log('[EventForm] ❌ Falha no upload de imagem, abortando submit');
          setSubmitting(false);
          return;
        }
        console.log('[EventForm] ✅ Upload de imagem concluído:', imageUrl);
      }

      // Generate slug with timestamp to ensure uniqueness when duplicating
      const baseSlug = data.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_]+/g, '-').replace(/(^-|-$)/g, '');
      const timestamp = Date.now().toString().slice(-6);
      const eventSlug = manualSlug || event?.slug || `${baseSlug}-${timestamp}`;
      
      const blogPostId = data.blog_post_id === 'none' ? null : data.blog_post_id || null;

      // Normalize URLs
      const normalizedTicketLink = normalizeUrl(data.ticket_link);
      const normalizedVipLink = normalizeUrl(data.vip_link);

      // Validação: end_date precisa ser >= date (segurança extra além do CHECK no banco)
      if (data.end_date && data.end_date < data.date) {
        toast({
          title: "Data final inválida",
          description: "A data final do festival precisa ser igual ou posterior à data inicial.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Normaliza lineup principal (split em vírgulas que o admin tenha colado num único chip)
      const normalizedLineup = normalizeLineup(lineup);

      // Schedule só é salvo quando há festival válido (end_date > date)
      const finalSchedule =
        data.end_date && data.end_date > data.date && schedule && schedule.length > 0
          ? schedule.map((e) => ({ ...e, lineup: normalizeLineup(e.lineup) }))
          : null;

      const eventData = {
        ...data,
        ticket_link: normalizedTicketLink,
        vip_link: normalizedVipLink,
        lineup: normalizedLineup,
        genres: selectedGenres,
        image_url: imageUrl,
        slug: eventSlug,
        blog_post_id: blogPostId,
        end_date: data.end_date || null,
        time: (data.time && data.time.trim()) ? data.time : null,
        end_time: data.end_time || null,
        subtitle: data.subtitle || null,
        ai_context: aiContext.trim() || null,
        schedule: finalSchedule as any,
        // Garante envio explícito do toggle Pix (evita perda caso react-hook-form não inclua no spread)
        pix_button_enabled: data.pix_button_enabled === true,
        // Fase 5: só faz sentido p/ multi-dia; força false se não houver end_date posterior.
        tickets_per_day:
          data.tickets_per_day === true && !!data.end_date && data.end_date > data.date,
      };

      console.log('[EventForm] 📦 Dados do evento preparados:', {
        slug: eventSlug,
        genres: selectedGenres.length,
        hasImage: !!imageUrl,
        hasTicketLink: !!normalizedTicketLink
      });

      let createdEventId = event?.id;

      if (event?.id) {
        console.log('[EventForm] 🔄 Atualizando evento existente:', event.id);
        const previousSlug = event?.slug;
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', event.id);
        
        if (error) throw error;

        // 🔁 Se o slug mudou, registra redirect do antigo → novo (preserva SEO e links externos)
        if (previousSlug && previousSlug !== eventSlug) {
          const { error: redirErr } = await supabase
            .from('event_slug_redirects')
            .upsert(
              { old_slug: previousSlug, event_id: event.id, reason: 'slug renamed via admin' },
              { onConflict: 'old_slug' }
            );
          if (redirErr) {
            console.warn('[EventForm] ⚠️ Falha ao gravar redirect de slug antigo:', redirErr);
          } else {
            console.log('[EventForm] 🔁 Redirect criado:', previousSlug, '→', eventSlug);
          }
        }
        
        // 🔗 Sincronizar TODOS os campos com links vinculados
        console.log('[EventForm] 🔗 Sincronizando campos com links vinculados...');
        const linkUpdateData: Record<string, any> = {
          title: data.title,
          subtitle: data.subtitle || `${data.venue} - ${data.location_city}/${data.location_state}`,
          override_date: data.date,
          override_time: data.time || null,
          updated_at: new Date().toISOString(),
        };

        // Sincronizar imagem se foi alterada
        if (imageFile && imageUrl) {
          linkUpdateData.thumbnail_url = imageUrl;
        }

        // Sincronizar URL do ticket se existir
        if (normalizedTicketLink) {
          linkUpdateData.url = normalizedTicketLink;
        }

        const { error: linkUpdateError } = await supabase
          .from('custom_links')
          .update(linkUpdateData)
          .eq('event_id', event.id);
        
        if (linkUpdateError) {
          console.error('[EventForm] ⚠️ Erro ao sincronizar links:', linkUpdateError);
        } else {
          console.log('[EventForm] ✅ Campos sincronizados com links vinculados');
        }
        
        console.log('[EventForm] ✅ Evento atualizado com sucesso');
        
        // Invalidar cache de eventos para refletir mudanças imediatamente
        try {
          const { QueryClient } = await import('@tanstack/react-query');
          // Clear localStorage cache
          localStorage.removeItem('mdaccula-events-cache');
          console.log('[EventForm] 🗑️ Cache localStorage de eventos limpo');
        } catch {}
        
        toast({
          title: "Evento atualizado com sucesso!",
        });

        // IndexNow: avisa Bing/Yandex que o evento foi atualizado
        notifyEventChange(eventSlug);
      } else {
        console.log('[EventForm] ➕ Criando novo evento...');
        const { data: insertedEvent, error } = await supabase
          .from('events')
          .insert([eventData])
          .select()
          .single();
        
        if (error) throw error;
        createdEventId = insertedEvent.id;
        
        console.log('[EventForm] ✅ Evento criado com sucesso:', createdEventId);
        toast({
          title: "Evento criado com sucesso!",
        });

        // IndexNow: avisa Bing/Yandex sobre o novo evento
        notifyEventChange(eventSlug);
      }

      // Generate blog post AFTER event creation if checkbox is checked and creating new event
      // 🔍 LOG DE DIAGNÓSTICO: Verificação de geração de blog post
      console.log('[EventForm] 🔍 Verificando se deve gerar blog post:', {
        generateBlogPost,
        isEditing,
        createdEventId,
        shouldGenerate: generateBlogPost && !isEditing && createdEventId
      });

      if (generateBlogPost && !isEditing && createdEventId) {
        console.log('[EventForm] 🤖 Iniciando geração de blog post via IA...');
        
        const blogPayload = buildArticlePayload(
          {
            id: createdEventId,
            title: data.title,
            subtitle: data.subtitle,
            date: data.date,
            time: data.time,
            end_time: data.end_time,
            venue: data.venue,
            address: data.address,
            location_city: data.location_city,
            location_state: data.location_state,
            description: data.description,
            genres: selectedGenres,
            lineup,
            ticket_link: normalizedTicketLink,
            vip_link: normalizedVipLink,
            image_url: imageUrl,
            ai_context: aiContext,
          },
          { generateImage: !imageUrl, aiContextOverride: aiContext },
        );
        
        console.log('[EventForm] 📤 Payload para generate-blog-post-v2:', blogPayload);
        
        try {
          const startTime = Date.now();
          const { data: blogPostData, error: blogError } = await supabase.functions.invoke('generate-blog-post-v2', {
            body: blogPayload
          });
          const duration = Date.now() - startTime;

          console.log('[EventForm] 📥 Resposta da edge function:', {
            duration: `${duration}ms`,
            hasData: !!blogPostData,
            hasError: !!blogError,
            postId: blogPostData?.post?.id,
            error: blogError
          });

          if (blogError) throw blogError;
          
          if (blogPostData?.post?.id) {
            console.log('[EventForm] 🔗 Vinculando blog post ao evento...');
            // Update event with blog_post_id
            const { error: updateError } = await supabase
              .from('events')
              .update({ blog_post_id: blogPostData.post.id })
              .eq('id', createdEventId);

            if (updateError) {
              console.error('[EventForm] ❌ Erro ao vincular blog post:', updateError);
            } else {
              console.log('[EventForm] ✅ Blog post vinculado com sucesso:', blogPostData.post.id);
              toast({
                title: "Post do blog gerado e vinculado!",
                description: "O post foi automaticamente vinculado ao evento.",
                action: (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => navigate(`/admin/blog?edit=${blogPostData.post.id}`)}
                  >
                    Editar Post
                  </Button>
                ),
              });
            }
          } else {
            console.warn('[EventForm] ⚠️ Resposta da IA não contém post.id:', blogPostData);
          }
        } catch (blogError) {
          console.error('[EventForm] ❌ Erro ao gerar blog post:', blogError);
          toast({
            title: "Erro ao gerar post do blog",
            description: "O evento foi criado, mas o post não foi gerado.",
            variant: "destructive"
          });
        }
      } else {
        console.log('[EventForm] ⏭️ Geração de blog post ignorada:', {
          reason: !generateBlogPost ? 'checkbox desmarcado' : isEditing ? 'modo edição' : 'sem eventId'
        });
      }
      
      // Create link automatically if checkbox is checked
      if (createLink && !isEditing && data.date && normalizedTicketLink && createdEventId) {
          try {
            // Generate group name based on event date
            const groupName = generateEventGroupName(data.date);
            
            
            
            // Check if group exists, if not create it
            const { data: existingGroup, error: groupError } = await supabase
              .from('link_groups')
              .select('id')
              .eq('name', groupName)
              .single();

            let groupId = existingGroup?.id;

            if (!existingGroup) {
              // Calculate chronological display_order: YYYY*100+MM
              const eventDate = new Date(data.date + 'T12:00:00');
              const chronologicalOrder = eventDate.getFullYear() * 100 + (eventDate.getMonth() + 1);
              
              const { data: newGroup, error: createGroupError } = await supabase
                .from('link_groups')
                .insert([{ name: groupName, enabled: true, display_order: chronologicalOrder }])
                .select()
                .single();

              if (createGroupError) throw createGroupError;
              groupId = newGroup.id;
              console.log(`[EventForm] 📁 Grupo "${groupName}" criado com display_order=${chronologicalOrder}`);
            }

            // Calculate display_order as timestamp (usando parseLocalDateTime para consistência)
            // Sem horário definido → usa 00:00 só para ordenar (mantém ordenação por data)
            const eventDateTime = parseLocalDateTime(data.date, data.time || '00:00');
            const displayOrder = Math.floor(eventDateTime.getTime() / 1000);

            // Determine URL based on selection
            const linkUrl = linkUrlType === 'ticket' 
              ? normalizedTicketLink 
              : `/eventos/${eventSlug}`;

            // Create the link
            const { error: linkError } = await supabase
              .from('custom_links')
              .insert([{
                title: data.title,
                subtitle: data.subtitle || `${data.venue} - ${data.location_city}/${data.location_state}`,
                url: linkUrl,
                thumbnail_url: imageUrl,
                group_id: groupId,
                display_order: displayOrder,
                is_internal: linkUrlType === 'slug',
                enabled: true,
                icon: 'Calendar',
                color_gradient: null, // Herda cor do template
                card_height: 80,
                event_id: createdEventId,
                override_date: data.date,
                override_time: data.time || null,
              }]);

            if (linkError) throw linkError;

            toast({
              title: "Link criado em /links com sucesso!",
            });
          } catch (linkError) {
            console.error('Error creating link:', linkError);
            toast({
              title: "Erro ao criar link",
              description: "O evento foi criado, mas o link não foi criado.",
              variant: "destructive"
            });
          }
        }

      // B.6 — Se admin marcou o toggle e a automação está pronta, cria rascunho na E-goi.
      // Falha aqui NÃO reverte o evento — apenas mostra toast. Histórico grava error_message.
      if (dispatchEmail && emailAutomationReady && createdEventId) {
        try {
          const result = await dispatchEventDraftEmail(createdEventId);
          if (result.skipped) {
            toast({
              title: 'Rascunho de e-mail não criado',
              description: `Motivo: ${result.reason ?? 'desconhecido'}. Verifique o painel /admin/email-config.`,
              variant: 'destructive',
            });
          } else if (result.ok) {
            toast({
              title: 'Rascunho criado na E-goi',
              description: 'Revise e envie manualmente pela sua conta E-goi.',
            });
          } else {
            toast({
              title: 'Falha ao criar rascunho na E-goi',
              description: result.error || 'Veja o histórico no painel de e-mails.',
              variant: 'destructive',
            });
          }
        } catch (dispatchErr: any) {
          console.error('[EventForm] Falha no disparo de rascunho E-goi:', dispatchErr);
          toast({
            title: 'Falha no disparo de e-mail',
            description: dispatchErr?.message || 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: "Erro ao salvar evento",
        description: "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{event ? 'Editar Evento' : 'Novo Evento'}</CardTitle>
        
        {!event && eventTemplates.length > 0 && (
          <div className="mt-4 space-y-2">
            <Label htmlFor="template-select">Usar Template (opcional)</Label>
            <Select 
              value={selectedTemplate} 
              onValueChange={(value) => {
                setSelectedTemplate(value);
                if (value && value !== 'none') applyTemplate(value);
              }}
            >
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Selecione um template para preencher automaticamente..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (preencher manualmente)</SelectItem>
                {eventTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Nome do Evento *</Label>
              <Input
                id="title"
                {...register('title', { required: 'Nome é obrigatório' })}
                placeholder="Nome do evento"
              />
              {errors.title && <span className="text-sm text-destructive">{errors.title.message}</span>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">Local *</Label>
              <Input
                id="venue"
                {...register('venue', { required: 'Local é obrigatório' })}
                placeholder="Nome do local"
              />
              {errors.venue && <span className="text-sm text-destructive">{errors.venue.message}</span>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço Completo</Label>
            <Input
              id="address"
              {...register('address')}
              placeholder="Rua, número - Bairro"
            />
            <p className="text-xs text-muted-foreground">
              Endereço aparecerá apenas na página de detalhes do evento
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtítulo (Opcional)</Label>
            <Input
              id="subtitle"
              {...register('subtitle')}
              placeholder="Ex: Ingresso antecipado com 30% OFF"
            />
            <p className="text-xs text-muted-foreground">
              Texto chamativo que aparecerá no card do evento
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location_state">Estado *</Label>
              <Controller
                name="location_state"
                control={control}
                defaultValue="SP"
                rules={{ required: 'Estado é obrigatório' }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATES.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.location_state && <span className="text-sm text-destructive">{errors.location_state.message}</span>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_city">Cidade *</Label>
              <Input
                id="location_city"
                {...register('location_city', { required: 'Cidade é obrigatória' })}
                placeholder="Nome da cidade"
              />
              {errors.location_city && <span className="text-sm text-destructive">{errors.location_city.message}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data Inicial *</Label>
              <Input
                id="date"
                type="date"
                {...register('date', { required: 'Data é obrigatória' })}
              />
              {errors.date && <span className="text-sm text-destructive">{errors.date.message}</span>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">Data Final (festival) — opcional</Label>
              <Input
                id="end_date"
                type="date"
                {...register('end_date')}
                min={watch('date') || undefined}
              />
              <p className="text-xs text-muted-foreground">
                Preencha apenas se for festival de múltiplos dias (ex.: So Track Boa 05 e 06/06).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="time">Horário de Início (Opcional)</Label>
              <Input
                id="time"
                type="time"
                {...register('time')}
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio se a produtora ainda não divulgou o horário
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">Horário de Término (Opcional)</Label>
              <Input
                id="end_time"
                type="time"
                {...register('end_time')}
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio se o evento não tiver horário definido de término
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Vertentes de Som * (selecione uma ou mais)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-lg">
              {GENRES.map((genre) => (
                <div key={genre} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`genre-${genre}`}
                    checked={selectedGenres.includes(genre)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGenres([...selectedGenres, genre]);
                      } else {
                        setSelectedGenres(selectedGenres.filter(g => g !== genre));
                      }
                    }}
                    className="w-4 h-4 rounded border-input"
                  />
                  <label htmlFor={`genre-${genre}`} className="text-sm cursor-pointer">
                    {genre}
                  </label>
                </div>
              ))}
            </div>
            {selectedGenres.length === 0 && (
              <span className="text-sm text-destructive">Selecione pelo menos uma vertente</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug (URL personalizada) - Opcional</Label>
            <Input
              id="slug"
              value={manualSlug}
              onChange={(e) => {
                const sanitized = e.target.value
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/[^a-z0-9-]/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/(^-|-$)/g, '');
                setManualSlug(sanitized);
              }}
              placeholder="meu-evento-personalizado"
            />
            <p className="text-xs text-muted-foreground">
              Se vazio, será gerado automaticamente do título. Use apenas letras minúsculas, números e hífens.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Line-up</Label>
            <div className="flex gap-2">
              <Input
                value={newLineupItem}
                onChange={(e) => setNewLineupItem(e.target.value)}
                placeholder="Nome do artista"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLineupItem())}
              />
              <Button type="button" onClick={addLineupItem} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {lineup.map((artist, index) => (
                <div key={index} className="flex items-center gap-1 bg-secondary px-3 py-1 rounded-full text-sm">
                  {artist}
                  <button
                    type="button"
                    onClick={() => removeLineupItem(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            {schedule && schedule.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Esse line-up serve como padrão. Use a "Programação por dia" abaixo para variar por dia.
              </p>
            )}
          </div>

          {/* Programação por dia (festival multi-dias) */}
          {schedule && schedule.length > 1 && (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
              <div>
                <Label className="text-base">📅 Programação por dia (festival)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Festival de {formatEventDateRange(watchedDate, watchedEndDate)}.
                  Defina horário e line-up de cada dia. Se um dia ficar sem line-up próprio, usa o line-up principal acima.
                </p>
              </div>
              {schedule.map((entry) => (
                <div key={entry.date} className="border rounded-md p-3 bg-background space-y-3">
                  <div className="font-semibold text-sm">
                    {parseLocalDateTime(entry.date, '00:00').toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Início</Label>
                      <Input
                        type="time"
                        value={entry.time?.slice(0, 5) || ''}
                        onChange={(e) => updateScheduleEntry(entry.date, { time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Término</Label>
                      <Input
                        type="time"
                        value={entry.end_time?.slice(0, 5) || ''}
                        onChange={(e) => updateScheduleEntry(entry.date, { end_time: e.target.value || null })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Line-up deste dia</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newScheduleArtist[entry.date] || ''}
                        onChange={(e) =>
                          setNewScheduleArtist((s) => ({ ...s, [entry.date]: e.target.value }))
                        }
                        placeholder="Nome do artista"
                        onKeyPress={(e) =>
                          e.key === 'Enter' && (e.preventDefault(), addScheduleArtist(entry.date))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => addScheduleArtist(entry.date)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(entry.lineup || []).map((artist, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-full text-xs"
                        >
                          {artist}
                          <button
                            type="button"
                            onClick={() => removeScheduleArtist(entry.date, idx)}
                            className="ml-0.5 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {(!entry.lineup || entry.lineup.length === 0) && (
                        <span className="text-xs text-muted-foreground italic">
                          Vazio → usa line-up principal
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="image">Imagem do Evento</Label>
            <div className="flex items-center gap-4">
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="flex-1"
              />
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ticket_link">Link Ingresso</Label>
              <Input
                id="ticket_link"
                {...register('ticket_link')}
                placeholder="https://... ou bit.ly/..."
                onBlur={(e) => {
                  const normalized = normalizeUrl(e.target.value);
                  if (normalized && normalized !== e.target.value) {
                    setValue('ticket_link', normalized);
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vip_link">Link Camarote</Label>
              <Controller
                name="vip_link"
                control={control}
                render={({ field }) => (
                  <Select
                    value={
                      field.value?.includes('5511999136884') ? 'maicoln' :
                      field.value?.includes('5511997819194') ? 'guilherme' :
                      field.value ? 'none' : ''
                    }
                    onValueChange={(value) => {
                      if (value === 'none' || !value) {
                        field.onChange('');
                      } else if (value === 'maicoln') {
                        const message = `Olá MD, queria ver um camarote para ${watch('title') || 'evento'}`;
                        field.onChange(`https://api.whatsapp.com/send?phone=5511999136884&text=${encodeURIComponent(message)}`);
                      } else if (value === 'guilherme') {
                        const message = `Olá Gui, queria ver um camarote para ${watch('title') || 'evento'}`;
                        field.onChange(`https://api.whatsapp.com/send?phone=5511997819194&text=${encodeURIComponent(message)}`);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma opção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="maicoln">Maicoln Douglas</SelectItem>
                      <SelectItem value="guilherme">Guilherme Accula</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {(() => {
            const pixEnabled = watch('pix_button_enabled') === true;
            const vipLinkVal = (watch('vip_link') || '').trim();
            const missingVip = pixEnabled && !vipLinkVal;
            return (
              <div
                className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                  missingVip
                    ? 'border-amber-500/60 bg-amber-500/10'
                    : 'border-input bg-muted/30'
                }`}
              >
                <Controller
                  name="pix_button_enabled"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="pix_button_enabled"
                      checked={!!field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      className="mt-0.5 data-[state=checked]:bg-[#25D366]"
                    />
                  )}
                />
                <div className="space-y-1">
                  <Label htmlFor="pix_button_enabled" className="cursor-pointer">
                    Mostrar botão "Comprar Sem Taxa via Pix"
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Exibe um terceiro botão verde na página do evento que abre o mesmo WhatsApp configurado em Link Camarote, com mensagem de Pix sem taxa.
                  </p>
                  {missingVip && (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      ⚠️ O botão NÃO vai aparecer no evento até você preencher um "Link Camarote" acima (Maicoln ou Guilherme).
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {(() => {
            const startDate = watch('date');
            const endDate = watch('end_date');
            const isMultiDay = !!endDate && !!startDate && endDate > startDate;
            if (!isMultiDay) return null;
            return (
              <div className="flex items-start gap-3 rounded-md border border-input bg-muted/30 p-3">
                <Controller
                  name="tickets_per_day"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="tickets_per_day"
                      checked={!!field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      className="mt-0.5"
                    />
                  )}
                />
                <div className="space-y-1">
                  <Label htmlFor="tickets_per_day" className="cursor-pointer">
                    Um link de venda por dia (festival)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ative quando cada dia do festival tem ingresso vendido separadamente. Na página do evento, o botão "Comprar Ingresso" abrirá um modal para a pessoa escolher o dia. Os links por dia precisam estar cadastrados em <strong>Links</strong> com o evento vinculado e a data de override preenchida.
                  </p>
                </div>
              </div>
            );
          })()}


          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descrição do evento..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="blog_post_id">Post do Blog Relacionado (Opcional)</Label>
            <Controller
              name="blog_post_id"
              control={control}
              render={({ field }) => (
                <div className="relative">
                  {selectedBlogPost ? (
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                      <span className="text-sm flex-1 truncate">
                        [{selectedBlogPost.category}] {selectedBlogPost.title}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setSelectedBlogPost(null);
                          field.onChange('none');
                          setBlogSearchTerm('');
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar artigo por título..."
                        className="pl-9"
                        value={blogSearchTerm}
                        onChange={(e) => {
                          setBlogSearchTerm(e.target.value);
                          setShowBlogDropdown(true);
                        }}
                        onFocus={() => {
                          setShowBlogDropdown(true);
                          if (!blogSearchTerm) setBlogSearchResults(blogPosts.slice(0, 10));
                        }}
                        onBlur={() => {
                          // Delay to allow click on dropdown item
                          setTimeout(() => setShowBlogDropdown(false), 200);
                        }}
                      />
                    </div>
                  )}
                  {showBlogDropdown && !selectedBlogPost && blogSearchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-background border rounded-md shadow-lg">
                      {blogSearchResults.map((post) => (
                        <button
                          key={post.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 truncate"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedBlogPost(post);
                            field.onChange(post.id);
                            setShowBlogDropdown(false);
                            setBlogSearchTerm('');
                          }}
                        >
                          <span className="text-muted-foreground">[{post.category}]</span> {post.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Vincule este evento a um post do blog para exibir informações adicionais.
            </p>
          </div>

          {/* Contexto para IA — sempre visível, persiste em events.ai_context */}
          <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
            <Label htmlFor="aiContextAlways">Contexto para IA (opcional)</Label>
            <Textarea
              id="aiContextAlways"
              value={aiContext}
              onChange={(e) => setAiContext(e.target.value)}
              placeholder="Ex: Ingresso cortesia pelo link, 5% de desconto com cupom MDACCULA, open bar até 01h, evento beneficente..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Salvo no evento e respeitado em toda geração/regeneração de artigo. Tem prioridade máxima sobre o template.
            </p>
          </div>

          {!event?.id && (
            <>
              {/* Criar Link Automaticamente */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createLink"
                    checked={createLink}
                    onCheckedChange={(checked) => setCreateLink(checked as boolean)}
                  />
                  <Label htmlFor="createLink" className="cursor-pointer font-medium">
                    Criar link automaticamente em /links
                  </Label>
                </div>
                
                {createLink && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="linkUrlType">URL do Link</Label>
                    <Select value={linkUrlType} onValueChange={(value: 'ticket' | 'slug') => setLinkUrlType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ticket">Link do Ingresso</SelectItem>
                        <SelectItem value="slug">Página do Evento (/eventos/...)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      O grupo será criado automaticamente baseado no mês do evento
                    </p>
                  </div>
                )}
              </div>

              {/* Gerar Post do Blog */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="generateBlogPost"
                    checked={generateBlogPost}
                    onCheckedChange={(checked) => setGenerateBlogPost(checked as boolean)}
                  />
                  <Label htmlFor="generateBlogPost" className="cursor-pointer font-medium">
                    Gerar post do blog automaticamente com IA
                  </Label>
                </div>
                
                {generateBlogPost && (
                  <div className="space-y-3 pl-6">
                    <p className="text-xs text-muted-foreground">
                      Um post do blog será criado como rascunho e vinculado a este evento. Você poderá editá-lo após a criação.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="aiContext">Contexto para IA (opcional)</Label>
                      <Textarea
                        id="aiContext"
                        value={aiContext}
                        onChange={(e) => setAiContext(e.target.value)}
                        placeholder="Ex: Ingresso cortesia pelo link, 50% de desconto no primeiro lote, open bar até 01h, evento beneficente..."
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Informações extras que a IA deve considerar ao gerar o artigo. Essas instruções têm prioridade máxima.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* B.6 — Toggle rascunho E-goi. Default OFF; só habilita se automação pronta. */}
          <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-start gap-3">
              <Checkbox
                id="dispatchEmail"
                checked={dispatchEmail}
                disabled={!emailAutomationReady}
                onCheckedChange={(checked) => setDispatchEmail(checked as boolean)}
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="dispatchEmail"
                  className={`cursor-pointer font-medium ${!emailAutomationReady ? 'text-muted-foreground' : ''}`}
                >
                  Criar rascunho de e-mail na E-goi ao salvar
                </Label>
                <p className="text-xs text-muted-foreground">
                  {emailAutomationReady
                    ? 'Um rascunho será criado na sua conta E-goi usando o template padrão. Você revisa e envia manualmente pela E-goi.'
                    : emailAutomationReason || 'Automação de e-mail indisponível.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">

            <Button type="submit" disabled={submitting || uploading} className="flex-1">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {event ? 'Atualizar' : 'Criar'} Evento
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