-- =====================================================================
-- Fix Supabase Security Warnings for SECURITY DEFINER functions
-- =====================================================================

-- 1. Fix FunctionSearchPathMutable: Always set search_path explicitly to '' for SECURITY DEFINER
-- When using search_path = '', all tables and functions must be fully qualified.
CREATE OR REPLACE FUNCTION public.is_business_owner(b_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses 
    WHERE id = b_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_invoice_owner(inv_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invoices i 
    JOIN public.businesses b ON b.id = i.business_id
    WHERE i.id = inv_id AND b.user_id = auth.uid()
  );
$$;

-- 2. Fix PublicCanExecuteSECURITYDEFINERFunction: Revoke execute from public/anon
REVOKE EXECUTE ON FUNCTION public.is_business_owner(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_business_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_invoice_owner(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_invoice_owner(uuid) FROM anon;

-- Explicitly grant execute only to authenticated users (and service_role) since RLS policies run as them
GRANT EXECUTE ON FUNCTION public.is_business_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_owner(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_invoice_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_invoice_owner(uuid) TO service_role;
