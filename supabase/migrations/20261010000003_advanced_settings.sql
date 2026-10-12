-- Add appearance and advanced agent settings
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'indigo';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS ui_density TEXT DEFAULT 'cozy';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS escalation_speed TEXT DEFAULT 'normal';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS agent_language TEXT DEFAULT 'English';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS late_fee_percentage NUMERIC DEFAULT 0;

NOTIFY pgrst, 'reload schema';
