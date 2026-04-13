CREATE OR REPLACE FUNCTION public.create_order(p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_order_number text;
  v_lookup_token uuid;
  v_confirmation_token uuid;
  v_tax_parish text;
  v_zip_code text;
  v_combined_rate numeric;
  v_state_rate numeric;
  v_local_rate numeric;
  v_taxable_base numeric;
  v_state_tax_amount numeric;
  v_parish_tax_amount numeric;
  v_total_tax numeric;
  v_base_unit_price numeric;
  v_quantity int;
  v_distance_fee numeric;
  v_sat_surcharge_amount numeric;
  v_sun_surcharge_amount numeric;
  v_customer_id uuid;
  v_customer_email text;
BEGIN
  v_tax_parish := p_data->>'tax_parish';
  v_zip_code := p_data->>'zip_code';
  v_base_unit_price := COALESCE((p_data->>'base_unit_price')::numeric, 0);
  v_quantity := COALESCE((p_data->>'quantity')::int, 1);
  v_distance_fee := COALESCE((p_data->>'distance_fee')::numeric, 0);
  v_sat_surcharge_amount := CASE WHEN COALESCE((p_data->>'saturday_surcharge')::boolean, false)
    THEN COALESCE((p_data->>'saturday_surcharge_amount')::numeric, 0) ELSE 0 END;
  v_sun_surcharge_amount := CASE WHEN COALESCE((p_data->>'sunday_surcharge')::boolean, false)
    THEN COALESCE((p_data->>'sunday_surcharge_amount')::numeric, 0) ELSE 0 END;

  -- Priority 1: ZIP code lookup
  IF v_zip_code IS NOT NULL AND v_zip_code <> '' THEN
    SELECT combined_rate, state_rate, local_rate
    INTO v_combined_rate, v_state_rate, v_local_rate
    FROM public.zip_tax_rates
    WHERE zip_code = v_zip_code
    LIMIT 1;
  END IF;

  -- Priority 2: Parish lookup (fallback)
  IF v_combined_rate IS NULL AND v_tax_parish IS NOT NULL AND v_tax_parish <> '' THEN
    SELECT combined_rate, state_rate, local_rate
    INTO v_combined_rate, v_state_rate, v_local_rate
    FROM public.tax_rates
    WHERE state_code = 'LA' AND LOWER(county_parish) = LOWER(v_tax_parish)
    LIMIT 1;
  END IF;

  -- Priority 3: Client-sent rate (last resort)
  IF v_combined_rate IS NULL THEN
    v_combined_rate := COALESCE((p_data->>'tax_rate')::numeric, 0);
    v_state_rate := 0.05;
    v_local_rate := GREATEST(v_combined_rate - v_state_rate, 0);
  END IF;

  v_taxable_base := v_base_unit_price * v_quantity + v_distance_fee + v_sat_surcharge_amount + v_sun_surcharge_amount;
  v_state_tax_amount := ROUND(v_taxable_base * v_state_rate, 2);
  v_parish_tax_amount := ROUND(v_taxable_base * v_local_rate, 2);
  v_total_tax := v_state_tax_amount + v_parish_tax_amount;

  INSERT INTO public.orders (
    customer_name, customer_email, customer_phone, delivery_address,
    distance_miles, price, quantity, notes, delivery_date, delivery_day_of_week,
    saturday_surcharge, saturday_surcharge_amount, delivery_window,
    same_day_requested, tax_rate, tax_amount, payment_method, payment_status,
    lead_reference, delivery_terms_accepted, delivery_terms_timestamp,
    card_authorization_accepted, card_authorization_timestamp,
    pit_id, sunday_surcharge, sunday_surcharge_amount, company_name,
    base_unit_price, distance_fee, processing_fee,
    state_tax_rate, state_tax_amount, parish_tax_rate, parish_tax_amount
  ) VALUES (
    p_data->>'customer_name',
    NULLIF(p_data->>'customer_email', ''),
    p_data->>'customer_phone',
    p_data->>'delivery_address',
    (p_data->>'distance_miles')::numeric,
    (p_data->>'price')::numeric,
    v_quantity,
    NULLIF(p_data->>'notes', ''),
    NULLIF(p_data->>'delivery_date', '')::date,
    p_data->>'delivery_day_of_week',
    COALESCE((p_data->>'saturday_surcharge')::boolean, false),
    COALESCE((p_data->>'saturday_surcharge_amount')::int, 0),
    COALESCE(p_data->>'delivery_window', '8:00 AM – 5:00 PM'),
    COALESCE((p_data->>'same_day_requested')::boolean, false),
    v_combined_rate,
    v_total_tax,
    COALESCE(p_data->>'payment_method', 'COD'),
    COALESCE(p_data->>'payment_status', 'pending'),
    NULLIF(p_data->>'lead_reference', ''),
    COALESCE((p_data->>'delivery_terms_accepted')::boolean, false),
    CASE WHEN p_data->>'delivery_terms_timestamp' IS NOT NULL THEN (p_data->>'delivery_terms_timestamp')::timestamptz ELSE NULL END,
    COALESCE((p_data->>'card_authorization_accepted')::boolean, false),
    CASE WHEN p_data->>'card_authorization_timestamp' IS NOT NULL THEN (p_data->>'card_authorization_timestamp')::timestamptz ELSE NULL END,
    CASE WHEN p_data->>'pit_id' IS NOT NULL THEN (p_data->>'pit_id')::uuid ELSE NULL END,
    COALESCE((p_data->>'sunday_surcharge')::boolean, false),
    COALESCE((p_data->>'sunday_surcharge_amount')::int, 0),
    NULLIF(p_data->>'company_name', ''),
    CASE WHEN p_data->>'base_unit_price' IS NOT NULL THEN (p_data->>'base_unit_price')::numeric ELSE NULL END,
    CASE WHEN p_data->>'distance_fee' IS NOT NULL THEN (p_data->>'distance_fee')::numeric ELSE NULL END,
    CASE WHEN p_data->>'processing_fee' IS NOT NULL THEN (p_data->>'processing_fee')::numeric ELSE NULL END,
    v_state_rate,
    v_state_tax_amount,
    v_local_rate,
    v_parish_tax_amount
  )
  RETURNING id, order_number, lookup_token, confirmation_token
  INTO v_id, v_order_number, v_lookup_token, v_confirmation_token;

  v_customer_email := NULLIF(p_data->>'customer_email', '');
  IF v_customer_email IS NOT NULL THEN
    INSERT INTO public.customers (email, name, phone, company, first_order_date, last_order_date, total_orders, total_spent)
    VALUES (
      v_customer_email,
      p_data->>'customer_name',
      p_data->>'customer_phone',
      NULLIF(p_data->>'company_name', ''),
      CURRENT_DATE,
      CURRENT_DATE,
      1,
      (p_data->>'price')::numeric
    )
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      company = COALESCE(EXCLUDED.company, customers.company),
      last_order_date = CURRENT_DATE,
      total_orders = customers.total_orders + 1,
      total_spent = customers.total_spent + EXCLUDED.total_spent,
      updated_at = now()
    RETURNING id INTO v_customer_id;

    UPDATE public.orders SET customer_id = v_customer_id WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'order_number', v_order_number,
    'lookup_token', v_lookup_token,
    'confirmation_token', v_confirmation_token
  );
END;
$function$;