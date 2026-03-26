
-- Add order_number column
ALTER TABLE public.orders ADD COLUMN order_number TEXT UNIQUE;

-- Add tax columns
ALTER TABLE public.orders ADD COLUMN tax_rate NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN tax_amount NUMERIC NOT NULL DEFAULT 0;

-- Create sequence for order numbers starting at 1001
CREATE SEQUENCE public.order_number_seq START WITH 1001;

-- Create function to auto-generate order number RS-YY-NNNN
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.order_number := 'RS-' || to_char(now(), 'YY') || '-' || nextval('public.order_number_seq');
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate order number on insert
CREATE TRIGGER set_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_order_number();
