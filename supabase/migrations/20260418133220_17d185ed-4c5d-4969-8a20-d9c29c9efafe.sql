
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (type, title, message, entity_type, entity_id)
  VALUES (
    'new_order',
    'New Order',
    COALESCE(NEW.customer_name, 'Customer') || ' placed a ' ||
      COALESCE(NEW.payment_method, 'COD') || ' order for ' ||
      COALESCE(NEW.delivery_address, 'unknown address'),
    'order',
    NEW.id::text
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block order creation if notification fails
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_order ON public.orders;
CREATE TRIGGER trg_notify_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_order();
