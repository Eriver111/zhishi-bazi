-- Run after schema.sql in the production Supabase SQL editor, before enabling WeChat.
-- New orders fail closed if this migration is missing. Existing ZPAY records are untouched.
BEGIN;
CREATE TABLE IF NOT EXISTS public.payment_orders (
  order_id varchar(32) PRIMARY KEY CHECK (order_id ~ '^wx_[a-f0-9]{24}$'),
  provider text NOT NULL CHECK (provider = 'xunhu'),
  payment_method text NOT NULL CHECK (payment_method = 'wechat'),
  provider_appid text NOT NULL,
  user_id bigint REFERENCES public.users(id),
  channel varchar(32),
  kind text NOT NULL CHECK (kind IN ('credits', 'monthly', 'report')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  credits integer,
  days integer,
  redemption_code varchar(32),
  report_type varchar(16),
  report_key varchar(64),
  report_params jsonb,
  label varchar(160),
  return_path text NOT NULL,
  transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CHECK ((kind = 'credits' AND credits IS NOT NULL AND credits > 0 AND redemption_code IS NOT NULL)
    OR (kind = 'monthly' AND days IS NOT NULL AND days > 0 AND redemption_code IS NOT NULL)
    OR (kind = 'report' AND report_type IS NOT NULL AND report_type IN ('bazi', 'hepan') AND report_key IS NOT NULL
      AND report_params IS NOT NULL AND label IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_transaction_unique
  ON public.payment_orders(provider, provider_appid, transaction_id) WHERE transaction_id IS NOT NULL;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_orders FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_orders TO service_role;

CREATE OR REPLACE FUNCTION public.fulfill_wechat_payment(
  p_order_id text, p_appid text, p_amount_cents integer, p_transaction_id text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.payment_orders%ROWTYPE;
  fulfilled_at timestamptz := now();
BEGIN
  SELECT * INTO o FROM public.payment_orders WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.provider <> 'xunhu' OR o.payment_method <> 'wechat'
    OR p_appid IS DISTINCT FROM o.provider_appid OR p_amount_cents IS DISTINCT FROM o.amount_cents
    OR p_transaction_id IS NULL OR p_transaction_id !~ '^[a-zA-Z0-9_-]{1,96}$' THEN
    RAISE EXCEPTION 'Payment verification failed';
  END IF;
  IF o.status = 'paid' THEN
    IF o.transaction_id IS DISTINCT FROM p_transaction_id THEN RAISE EXCEPTION 'Transaction mismatch'; END IF;
    RETURN true;
  END IF;
  IF o.kind = 'credits' THEN
    INSERT INTO public.user_credits(code, credits, total_used, order_id, user_id, channel)
      VALUES(o.redemption_code, o.credits, 0, o.order_id, o.user_id, o.channel);
  ELSIF o.kind = 'monthly' THEN
    INSERT INTO public.user_subscriptions(code, order_id, user_id, channel, starts_at, expires_at)
      VALUES(o.redemption_code, o.order_id, o.user_id, o.channel, fulfilled_at,
        fulfilled_at + make_interval(days => o.days));
  ELSIF o.kind = 'report' THEN
    -- The existing account report library reconstructs BaZi only. Hepan keeps
    -- its durable entitlement in payment_orders and its existing page recovery.
    IF o.report_type = 'bazi' THEN
      INSERT INTO public.report_orders(order_id, user_id, report_type, report_key, report_params, label, amount, status, paid_at)
        VALUES(o.order_id, o.user_id, o.report_type, o.report_key, o.report_params, o.label,
          o.amount_cents / 100.0, 'paid', fulfilled_at);
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown payment product';
  END IF;
  -- The entitlement and paid flag commit together. A conflict rolls back both.
  UPDATE public.payment_orders SET status = 'paid', paid_at = fulfilled_at,
    transaction_id = p_transaction_id WHERE order_id = o.order_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.fulfill_wechat_payment(text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_wechat_payment(text, text, integer, text) TO service_role;
COMMIT;
