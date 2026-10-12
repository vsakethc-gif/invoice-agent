-- Add more personalized settings for businesses
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 0;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS minimum_chase_amount NUMERIC DEFAULT 0;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS bcc_email TEXT;

NOTIFY pgrst, 'reload schema';
