-- Apply after schema-payment-channels.sql, before releasing guest purchase binding.
-- No backfill by chart, email, device fingerprint or raw client unlock flags.
BEGIN;
CREATE OR REPLACE FUNCTION public.claim_wechat_purchase(p_order_id text, p_user_id bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.payment_orders%ROWTYPE;
  affected integer;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Account unavailable';
  END IF;
  -- Same lock as fulfill_wechat_payment: binding before/after a callback is equivalent.
  SELECT * INTO o FROM public.payment_orders WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR (o.user_id IS NOT NULL AND o.user_id <> p_user_id) THEN RETURN 'unavailable'; END IF;
  IF o.status = 'paid' THEN
    IF o.kind = 'credits' THEN
      UPDATE public.user_credits SET user_id = p_user_id
        WHERE order_id = o.order_id AND (user_id IS NULL OR user_id = p_user_id);
      GET DIAGNOSTICS affected = ROW_COUNT;
    ELSIF o.kind = 'monthly' THEN
      UPDATE public.user_subscriptions SET user_id = p_user_id
        WHERE order_id = o.order_id AND (user_id IS NULL OR user_id = p_user_id);
      GET DIAGNOSTICS affected = ROW_COUNT;
    ELSIF o.kind = 'report' AND o.report_type = 'bazi' THEN
      UPDATE public.report_orders SET user_id = p_user_id
        WHERE order_id = o.order_id AND status = 'paid' AND (user_id IS NULL OR user_id = p_user_id);
      GET DIAGNOSTICS affected = ROW_COUNT;
    ELSIF o.kind = 'report' AND o.report_type = 'hepan' THEN
      affected := 1; -- The payment row itself is this report's durable entitlement.
    ELSE
      RAISE EXCEPTION 'Unknown purchase';
    END IF;
    IF affected <> 1 THEN RAISE EXCEPTION 'Entitlement binding failed'; END IF;
  END IF;
  UPDATE public.payment_orders SET user_id = p_user_id WHERE order_id = o.order_id;
  RETURN o.status;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_wechat_purchase(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_wechat_purchase(text, bigint) TO service_role;
COMMIT;
