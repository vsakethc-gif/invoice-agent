ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS skip_weekends BOOLEAN DEFAULT TRUE;
NOTIFY pgrst, 'reload schema';
