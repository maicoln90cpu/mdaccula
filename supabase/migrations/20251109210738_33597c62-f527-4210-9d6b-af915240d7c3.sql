-- Habilitar RLS na tabela share_analytics
ALTER TABLE share_analytics ENABLE ROW LEVEL SECURITY;

-- Permitir que qualquer um insira shares (tracking público)
CREATE POLICY "Anyone can track shares"
  ON share_analytics
  FOR INSERT
  WITH CHECK (true);

-- Apenas admins podem visualizar analytics
CREATE POLICY "Admins can view share analytics"
  ON share_analytics
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));