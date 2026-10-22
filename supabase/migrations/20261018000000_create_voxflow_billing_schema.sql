-- ==============================================================================
-- VoxFlow Billing, Subscriptions & Invoicing Schema Migration
-- Migration: 20261018000000_create_voxflow_billing_schema.sql
-- Description:
--   Creates production tables for recurring subscription tracking, provider customer
--   mappings, billing invoices, webhook idempotency deduplication ledger, and
--   monthly usage quota tracking.
--   Enforces Row Level Security (RLS) so users can only view their own billing data,
--   while updates are strictly restricted to the authoritative backend service_role.
-- ==============================================================================

-- 1. Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'dodo',
  customer_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL DEFAULT 'premium_monthly',
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('incomplete', 'active', 'past_due', 'cancel_at_period_end', 'canceled', 'expired')
  ),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW())
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON public.subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end);

-- CRITICAL: Prevent duplicate active subscriptions for a single user at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_subscription_per_user 
  ON public.subscriptions (user_id) 
  WHERE status IN ('active', 'past_due', 'cancel_at_period_end');

-- Enable RLS on Subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscriptions RLS: Authenticated users can view their own subscription
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Users can view own subscription'
  ) THEN
    CREATE POLICY "Users can view own subscription"
      ON public.subscriptions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- 2. Billing Invoices Table
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_invoice_id TEXT NOT NULL UNIQUE,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'paid' CHECK (
    status IN ('paid', 'open', 'void', 'uncollectible')
  ),
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW())
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_user_id ON public.billing_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_created_at ON public.billing_invoices(created_at DESC);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'billing_invoices' AND policyname = 'Users can view own invoices'
  ) THEN
    CREATE POLICY "Users can view own invoices"
      ON public.billing_invoices FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- 3. Webhook Idempotency & Audit Ledger
-- Records all processed webhook event IDs to prevent duplicate side effects, replay attacks, and racing deliveries
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'dodo',
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processed' CHECK (
    status IN ('processing', 'processed', 'failed', 'ignored')
  ),
  payload_summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  error_message TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
  CONSTRAINT uq_billing_provider_event UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON public.billing_webhook_events(processed_at DESC);

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

-- Note: Webhook events are private internal audit records; no client SELECT policy is granted to public users.


-- 4. Monthly Usage Quotas Table
CREATE TABLE IF NOT EXISTS public.usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_year_month TEXT NOT NULL, -- e.g. '2026-10'
  voice_transcriptions_used INTEGER NOT NULL DEFAULT 0,
  meetings_used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
  CONSTRAINT uq_user_quota_period UNIQUE (user_id, period_year_month)
);

CREATE INDEX IF NOT EXISTS idx_usage_quotas_user_period ON public.usage_quotas(user_id, period_year_month);

ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usage_quotas' AND policyname = 'Users can view own usage quota'
  ) THEN
    CREATE POLICY "Users can view own usage quota"
      ON public.usage_quotas FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- 5. Updated_at Triggers
DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_usage_quotas_updated_at ON public.usage_quotas;
CREATE TRIGGER set_usage_quotas_updated_at
  BEFORE UPDATE ON public.usage_quotas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 6. Role Privileges
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.billing_invoices TO authenticated;
GRANT SELECT ON public.usage_quotas TO authenticated;

-- Service role has full access for backend billing management
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.billing_invoices TO service_role;
GRANT ALL ON public.billing_webhook_events TO service_role;
GRANT ALL ON public.usage_quotas TO service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
