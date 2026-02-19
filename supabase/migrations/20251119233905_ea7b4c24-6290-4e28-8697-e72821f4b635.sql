-- Add card_width column to custom_links table
ALTER TABLE custom_links ADD COLUMN IF NOT EXISTS card_width integer DEFAULT 650;

-- Add comment for documentation
COMMENT ON COLUMN custom_links.card_width IS 'Width of the card in pixels, default 650px';