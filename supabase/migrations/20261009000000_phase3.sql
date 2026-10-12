-- =====================================================================
-- InvoiceNudge — Phase 3 migration (SAFE TO RE-RUN)
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Every statement uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS,
-- so it works no matter which earlier SQL you already ran.
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------- Missing columns on existing tables ----------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paused_until DATE;           -- used for "promise to pay"
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_timezone TEXT;      -- recipient's best-known timezone

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mailing_address TEXT;      -- CAN-SPAM sender info
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS default_payment_link TEXT;

-- ---------- Messages (email thread per invoice) ----------
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    direction TEXT NOT NULL,            -- outbound | inbound
    subject TEXT,
    body TEXT NOT NULL,
    sent_at TIMESTAMPTZ,
    type TEXT NOT NULL,                 -- draft | sent | received
    status TEXT NOT NULL,               -- pending_approval | approved | sent | skipped | received
    step TEXT,                          -- Day -3 | Day +1 | Day +7 | Day +14 | Day +30 | Manual
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tone TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS used_fallback BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS guardrail_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS violations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- ---------- Audit log (append-only) ----------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,                -- owner | agent | system
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Opt-outs / suppression list (CAN-SPAM) ----------
CREATE TABLE IF NOT EXISTS suppressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (business_id, email)
);

-- ---------- Ownership helper functions (avoid RLS recursion) ----------
CREATE OR REPLACE FUNCTION is_business_owner(b_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM businesses WHERE id = b_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION is_invoice_owner(inv_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM invoices i JOIN businesses b ON b.id = i.business_id
    WHERE i.id = inv_id AND b.user_id = auth.uid()
  );
$$;

-- ---------- Row-Level Security: tenant isolation ----------
ALTER TABLE businesses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own businesses" ON businesses;
CREATE POLICY "Users can manage their own businesses" ON businesses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own business invoices" ON invoices;
CREATE POLICY "Users can manage their own business invoices" ON invoices FOR ALL
  USING (is_business_owner(business_id)) WITH CHECK (is_business_owner(business_id));

DROP POLICY IF EXISTS "Users can manage their own business messages" ON messages;
CREATE POLICY "Users can manage their own business messages" ON messages FOR ALL
  USING (is_invoice_owner(invoice_id)) WITH CHECK (is_invoice_owner(invoice_id));

-- Audit log is IMMUTABLE: owners may read and append, never update or delete.
DROP POLICY IF EXISTS "Users can view their own business audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can insert their own business audit logs" ON audit_logs;
CREATE POLICY "Users can view their own business audit logs" ON audit_logs FOR SELECT
  USING (is_business_owner(business_id));
CREATE POLICY "Users can insert their own business audit logs" ON audit_logs FOR INSERT
  WITH CHECK (is_business_owner(business_id));

DROP POLICY IF EXISTS "Users can manage their own suppressions" ON suppressions;
CREATE POLICY "Users can manage their own suppressions" ON suppressions FOR ALL
  USING (is_business_owner(business_id)) WITH CHECK (is_business_owner(business_id));

-- Tell Supabase's API to pick up the new columns immediately (fixes "schema cache" errors)
NOTIFY pgrst, 'reload schema';
