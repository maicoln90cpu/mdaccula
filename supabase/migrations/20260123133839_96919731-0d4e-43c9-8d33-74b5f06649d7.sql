-- ================================================
-- TABELA: podcast_submissions
-- Armazena inscrições de DJs para gravação de sets
-- ================================================

CREATE TABLE public.podcast_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_age TEXT NOT NULL,
  genre TEXT NOT NULL,
  has_original_track BOOLEAN DEFAULT FALSE,
  original_track_link TEXT,
  instagram TEXT,
  spotify TEXT,
  soundcloud TEXT,
  tiktok TEXT,
  email TEXT NOT NULL,
  project_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'contacted')),
  admin_notes TEXT,
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_podcast_submissions_updated_at
  BEFORE UPDATE ON public.podcast_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_podcast_submissions_status ON public.podcast_submissions(status);
CREATE INDEX idx_podcast_submissions_created_at ON public.podcast_submissions(created_at DESC);
CREATE INDEX idx_podcast_submissions_email ON public.podcast_submissions(email);

-- ================================================
-- RLS POLICIES
-- ================================================

-- Habilitar RLS
ALTER TABLE public.podcast_submissions ENABLE ROW LEVEL SECURITY;

-- INSERT: Qualquer pessoa pode enviar inscrição (formulário público)
CREATE POLICY "Anyone can submit podcast registration"
ON public.podcast_submissions
FOR INSERT
WITH CHECK (
  is_valid_email(email) 
  AND length(email) <= 320
  AND length(full_name) >= 3
  AND length(project_name) >= 2
  AND length(project_description) >= 20
);

-- SELECT: Apenas admins podem ver inscrições
CREATE POLICY "Admins can view podcast submissions"
ON public.podcast_submissions
FOR SELECT
USING (is_admin());

-- UPDATE: Apenas admins podem atualizar (status, notas)
CREATE POLICY "Admins can update podcast submissions"
ON public.podcast_submissions
FOR UPDATE
USING (is_admin());

-- DELETE: Apenas admins podem deletar
CREATE POLICY "Admins can delete podcast submissions"
ON public.podcast_submissions
FOR DELETE
USING (is_admin());

-- ================================================
-- COMENTÁRIOS
-- ================================================
COMMENT ON TABLE public.podcast_submissions IS 'Inscrições de DJs para gravação de sets no MDAccula Radio';
COMMENT ON COLUMN public.podcast_submissions.status IS 'Status: pending, approved, rejected, contacted';
COMMENT ON COLUMN public.podcast_submissions.notification_sent IS 'Se o email de confirmação foi enviado';