-- Corrigir search_path na função set_new_group_after_navigation
CREATE OR REPLACE FUNCTION set_new_group_after_navigation()
RETURNS TRIGGER AS $$
DECLARE
  nav_order INTEGER;
  max_order INTEGER;
BEGIN
  -- Buscar ordem do grupo "Navegação"
  SELECT display_order INTO nav_order 
  FROM link_groups 
  WHERE LOWER(name) = 'navegação' OR LOWER(name) = 'navegacao'
  LIMIT 1;
  
  -- Se novo grupo não tem display_order definido
  IF NEW.display_order IS NULL THEN
    -- Pegar maior display_order atual
    SELECT COALESCE(MAX(display_order), 0) INTO max_order FROM link_groups;
    
    -- Se existe grupo "Navegação", colocar depois dele
    IF nav_order IS NOT NULL THEN
      NEW.display_order := GREATEST(nav_order + 1, max_order + 1);
    ELSE
      NEW.display_order := max_order + 1;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path TO 'public';