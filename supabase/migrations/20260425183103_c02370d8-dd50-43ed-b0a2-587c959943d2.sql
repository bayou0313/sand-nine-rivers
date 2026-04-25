
-- Test fixture 1: clean slate on Silas's existing order
UPDATE public.orders
SET driver_workflow_status = NULL,
    acknowledged_at = NULL,
    at_pit_at = NULL,
    loaded_at = NULL,
    workflow_delivered_at = NULL,
    driver_collected_cash = 0,
    driver_collected_check = 0,
    driver_collected_card = 0,
    driver_collected_at = NULL
WHERE id = '3a10552a-64dd-4cd5-b38e-8fd04dfdcc5d';

-- Test fixture 2: assign a Stripe-paid order to Silas (for payment-gate "paid" path)
UPDATE public.orders
SET driver_id = '06dac71f-bf66-4349-a0b4-4df5a3694435',
    payment_status = 'paid',
    driver_workflow_status = NULL,
    acknowledged_at = NULL,
    at_pit_at = NULL,
    loaded_at = NULL,
    workflow_delivered_at = NULL,
    driver_collected_cash = 0,
    driver_collected_check = 0,
    driver_collected_card = 0,
    driver_collected_at = NULL
WHERE id = '5dcc06a7-7997-44cb-90de-ce5d519b7b67';

-- Test fixture 3: assign a COD order to Marcel (for cross-driver isolation)
UPDATE public.orders
SET driver_id = 'b431578a-5ad8-4ee1-b00c-9274c6b43245',
    driver_workflow_status = NULL,
    acknowledged_at = NULL,
    at_pit_at = NULL,
    loaded_at = NULL,
    workflow_delivered_at = NULL,
    driver_collected_cash = 0,
    driver_collected_check = 0,
    driver_collected_card = 0,
    driver_collected_at = NULL
WHERE id = '9e2b20ae-947f-4da3-b219-8f9f88e3effa';

-- Test fixture 4: driver session for Silas (token: SzE1m1UvFBR-B1wqeFl26wMh7N05Nop2onQW8FkhrZKjFTOjpLDmKfjYSpBA6Kna)
INSERT INTO public.driver_sessions (driver_id, session_token_hash, expires_at, user_agent, ip_address)
VALUES (
  '06dac71f-bf66-4349-a0b4-4df5a3694435',
  'fa7d8144e740fc5815720c10eabddd17686031d65925dbdd98bb2e2752ac5188',
  now() + interval '24 hours',
  'phase3b-smoke-test',
  '127.0.0.1'
);

-- Test fixture 5: driver session for Marcel (token: VuYrw9EgBdvfyAw68skpVaLgMaMkB9cG1vA6qIDYsT_w3mf0mWRQr0PKnoGJsrTe)
INSERT INTO public.driver_sessions (driver_id, session_token_hash, expires_at, user_agent, ip_address)
VALUES (
  'b431578a-5ad8-4ee1-b00c-9274c6b43245',
  'b782253ac00da1d798087b8b4c581e4008b5a9744424daf05c5b3ab4dd516480',
  now() + interval '24 hours',
  'phase3b-smoke-test',
  '127.0.0.1'
);
