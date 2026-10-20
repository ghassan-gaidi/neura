-- Remove the self-granting behavior: a tenant with no credit_balances row
-- now has 0 credits, not 1000 free credits.
CREATE OR REPLACE FUNCTION deduct_credits(
  p_tenant_id UUID,
  p_amount INT,
  p_description TEXT DEFAULT '',
  p_reference_id TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INT;
BEGIN
  SELECT balance INTO v_balance
  FROM credit_balances
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits: no credit balance for tenant'
      USING HINT = 'Top up via POST /api/credits';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_credits: have %, need %', v_balance, p_amount
      USING HINT = 'Top up via POST /api/credits';
  END IF;

  UPDATE credit_balances
  SET
    balance = balance - p_amount,
    total_consumed = total_consumed + p_amount,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO credit_transactions (tenant_id, amount, balance_after, transaction_type, description, reference_id)
  VALUES (p_tenant_id, -p_amount, v_balance - p_amount, 'spend', p_description, p_reference_id);

  RETURN v_balance - p_amount;
END;
$$;
