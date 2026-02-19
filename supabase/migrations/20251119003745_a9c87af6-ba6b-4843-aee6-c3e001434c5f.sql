-- Add card_height field to custom_links table
ALTER TABLE custom_links ADD COLUMN card_height integer DEFAULT 60;

COMMENT ON COLUMN custom_links.card_height IS 'Height of the card in pixels (for non-featured cards). Default is 60px.';