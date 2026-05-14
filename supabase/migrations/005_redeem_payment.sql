-- Atomically redeem a payment: add credits + record transaction
-- Returns new balance
CREATE OR REPLACE FUNCTION redeem_payment(
  p_tenant_id UUID,
  p_tx_hash TEXT,
  p_credits INT,
  p_amount_usdc TEXT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INT;
BEGIN
  -- Lock and update balance
  SELECT balance INTO v_balance
  FROM credit_balances
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO credit_balances (tenant_id, balance, total_purchased)
    VALUES (p_tenant_id, p_credits, p_credits)
    RETURNING balance INTO v_balance;
  ELSE
    UPDATE credit_balances
    SET
      balance = balance + p_credits,
      total_purchased = total_purchased + p_credits,
      updated_at = now()
    WHERE tenant_id = p_tenant_id
    RETURNING balance INTO v_balance;
  END IF;

  -- Record transaction
  INSERT INTO credit_transactions (tenant_id, amount, balance_after, transaction_type, description, reference_id)
  VALUES (p_tenant_id, p_credits, v_balance, 'purchase', format('Payment: %s USDC via %s', p_amount_usdc, p_tx_hash), p_tx_hash);

  RETURN v_balance;
END;
$$;
