-- Create a security definer function so anon can insert and get back needed fields
CREATE OR REPLACE FUNCTION public.create_order(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_order_number text;
  v_lookup_token uuid;
  v_confirmation_token uuid;
BEGIN
  INSERT INTO public.orders (
    customer_name, customer_email, customer_phone, delivery_address,
    distance_miles, price, quantity, notes, delivery_date, delivery_day_of_week,
    saturday_surcharge, saturday_surcharge_amount, delivery_window,
    same_day_requested, tax_rate, tax_amount, payment_method, payment_status
  ) VALUES (
    p_data->>'customer_name',
    NULLIF(p_data->>'customer_email', ''),
    p_data->>'customer_phone',
    p_data->>'delivery_address',
    (p_data->>'distance_miles')::numeric,
    (p_data->>'price')::numeric,
    COALESCE((p_data->>'quantity')::int, 1),
    NULLIF(p_data->>'notes', ''),
    NULLIF(p_data->>'delivery_date', '')::date,
    p_data->>'delivery_day_of_week',
    COALESCE((p_data->>'saturday_surcharge')::boolean, false),
    COALESCE((p_data->>'saturday_surcharge_amount')::int, 0),
    COALESCE(p_data->>'delivery_window', '8:00 AM – 5:00 PM'),
    COALESCE((p_data->>'same_day_requested')::boolean, false),
    COALESCE((p_data->>'tax_rate')::numeric, 0),
    COALESCE((p_data->>'tax_amount')::numeric, 0),
    COALESCE(p_data->>'payment_method', 'COD'),
    COALESCE(p_data->>'payment_status', 'pending')
  )
  RETURNING id, order_number, lookup_token, confirmation_token
  INTO v_id, v_order_number, v_lookup_token, v_confirmation_token;

  RETURN jsonb_build_object(
    'id', v_id,
    'order_number', v_order_number,
    'lookup_token', v_lookup_token,
    'confirmation_token', v_confirmation_token
  );
END;
$$;
