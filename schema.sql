-- ===================================================
-- BUILDICY PULSE — PRODUCTION SUPABASE DATABASE SCHEMA & SEED DATA
-- Execute this entire script in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ===================================================

-- 1. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    avatar TEXT,
    hourly_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    client TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    budget NUMERIC DEFAULT 0,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    category TEXT DEFAULT 'General',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    client TEXT,
    project TEXT,
    member TEXT,
    payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('completed', 'pending')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure payment_status column exists if table was created previously without it
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('completed', 'pending'));

-- Refresh Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';


-- ===================================================
-- ROW LEVEL SECURITY (RLS) FOR DEVELOPMENT
-- Disable RLS so your app's anon key can read/write freely
-- ===================================================
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;

-- ===================================================
-- REALTIME SUBSCRIPTIONS
-- Enable Supabase Realtime on all tables so changes
-- reflect instantly across all connected screens.
-- ===================================================
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    public.clients, 
    public.members, 
    public.projects, 
    public.transactions;
COMMIT;

-- ===================================================
-- OPTIONAL SAMPLE SEED DATA
-- ===================================================
INSERT INTO public.clients (name, company, email, phone) VALUES
('Alex Rivera', 'Apex Technologies', 'alex@apextech.com', '+91 9876543210'),
('Sarah Jenkins', 'Vanguard Media', 'sarah@vanguard.io', '+91 9123456789')
ON CONFLICT DO NOTHING;

INSERT INTO public.members (name, role, hourly_rate) VALUES
('Mayur', 'Lead Architect', 2500),
('Karthick', 'Senior Developer', 2000)
ON CONFLICT DO NOTHING;

INSERT INTO public.projects (name, client, status, budget, category) VALUES
('Buildicy Platform v1', 'Apex Technologies', 'active', 500000, 'Development'),
('Wealth Dashboard', 'Vanguard Media', 'active', 300000, 'UI/UX Design')
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (date, amount, type, category, description, client, project, payment_status) VALUES
(CURRENT_DATE, 150000, 'income', 'Project Revenue', 'Milestone 1 Payment', 'Apex Technologies', 'Buildicy Platform v1', 'completed'),
(CURRENT_DATE, 25000, 'expense', 'Software', 'AWS Infrastructure & Hosting', NULL, NULL, 'completed')
ON CONFLICT DO NOTHING;


