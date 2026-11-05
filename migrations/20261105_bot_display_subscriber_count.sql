-- Store the subscriber number shown on bot cards as an admin-managed value.
ALTER TABLE bot_products
  ADD COLUMN IF NOT EXISTS subscriber_count integer NOT NULL DEFAULT 0;
