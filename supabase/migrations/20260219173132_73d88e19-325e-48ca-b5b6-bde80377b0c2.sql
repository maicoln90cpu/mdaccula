-- Migrar role admin do usuario antigo para o novo
UPDATE user_roles 
SET user_id = 'af594fec-a149-4ff0-b65f-ba13c84359c0' 
WHERE user_id = '61878bfd-4e94-4b3c-ac7e-39147663f953';

-- Remover profile antigo (o novo ja existe)
DELETE FROM profiles 
WHERE id = '61878bfd-4e94-4b3c-ac7e-39147663f953';