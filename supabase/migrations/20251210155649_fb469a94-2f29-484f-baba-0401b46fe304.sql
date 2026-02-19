-- Remover política permissiva que permite UPDATE por qualquer usuário
DROP POLICY IF EXISTS "System can update sync logs" ON sync_logs;

-- Criar política restritiva que permite UPDATE apenas para service_role
CREATE POLICY "Only service role can update sync logs"
  ON sync_logs FOR UPDATE
  TO service_role
  USING (true);