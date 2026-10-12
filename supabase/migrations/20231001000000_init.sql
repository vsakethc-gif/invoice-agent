-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Table: businesses
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    reply_to_email TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    default_tone TEXT DEFAULT 'Professional',
    send_mode TEXT DEFAULT 'approval',
    total_recovered NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: invoices
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    invoice_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'USD',
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'upcoming', -- upcoming, overdue, promised, disputed, paid, paused
    payment_link TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    direction TEXT NOT NULL, -- outbound, inbound
    subject TEXT,
    body TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    type TEXT NOT NULL, -- draft, sent, received
    status TEXT NOT NULL, -- pending_approval, sent, received, skipped
    step TEXT, -- Day -3, Day +1, Day +7, Day +14, Day +30
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL, -- owner, agent, system
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Helper functions for RLS to avoid subquery recursion
CREATE OR REPLACE FUNCTION is_business_owner(b_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM businesses WHERE id = b_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_invoice_owner(inv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM invoices i
    JOIN businesses b ON b.id = i.business_id
    WHERE i.id = inv_id AND b.user_id = auth.uid()
  );
$$;

-- Enable RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if any
DROP POLICY IF EXISTS "Users can manage their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can manage their own business invoices" ON invoices;
DROP POLICY IF EXISTS "Users can manage their own business messages" ON messages;
DROP POLICY IF EXISTS "Users can view their own business audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

-- Businesses Policy
CREATE POLICY "Users can manage their own businesses" 
ON businesses FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Invoices Policy
CREATE POLICY "Users can manage their own business invoices" 
ON invoices FOR ALL 
USING (is_business_owner(business_id))
WITH CHECK (is_business_owner(business_id));

-- Messages Policy
CREATE POLICY "Users can manage their own business messages" 
ON messages FOR ALL 
USING (is_invoice_owner(invoice_id))
WITH CHECK (is_invoice_owner(invoice_id));

-- Audit Logs Policy
CREATE POLICY "Users can view their own business audit logs" 
ON audit_logs FOR SELECT 
USING (is_business_owner(business_id));

CREATE POLICY "Users can insert their own business audit logs" 
ON audit_logs FOR INSERT 
WITH CHECK (is_business_owner(business_id));
