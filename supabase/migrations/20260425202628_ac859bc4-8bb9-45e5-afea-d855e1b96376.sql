UPDATE public.orders SET
  driver_workflow_status = NULL,
  acknowledged_at = NULL,
  at_pit_at = NULL,
  loaded_at = NULL,
  workflow_delivered_at = NULL,
  driver_collected_cash = NULL,
  driver_collected_check = NULL,
  driver_collected_card = NULL,
  driver_collected_at = NULL,
  payment_method = 'cash',
  payment_status = 'pending'
WHERE id = '3a10552a-64dd-4cd5-b38e-8fd04dfdcc5d';

UPDATE public.orders SET
  driver_workflow_status = 'acknowledged',
  acknowledged_at = NOW(),
  at_pit_at = NULL,
  loaded_at = NULL,
  workflow_delivered_at = NULL,
  driver_collected_cash = NULL,
  driver_collected_check = NULL,
  driver_collected_card = NULL,
  driver_collected_at = NULL,
  payment_method = 'stripe-link',
  payment_status = 'paid'
WHERE id = '5dcc06a7-7997-44cb-90de-ce5d519b7b67';