
-- Add stage column to delivery_leads
ALTER TABLE delivery_leads 
ADD COLUMN IF NOT EXISTS stage text DEFAULT 'new';

-- Add check constraint for stage values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_leads_stage_check'
  ) THEN
    ALTER TABLE delivery_leads ADD CONSTRAINT delivery_leads_stage_check 
    CHECK (stage IN ('new','called','quoted','won','lost'));
  END IF;
END $$;

-- Add lead_number column
ALTER TABLE delivery_leads 
ADD COLUMN IF NOT EXISTS lead_number text;

-- Add ip_address column (may already exist)
ALTER TABLE delivery_leads 
ADD COLUMN IF NOT EXISTS ip_address text;

-- Add notes column for lead notes
ALTER TABLE delivery_leads 
ADD COLUMN IF NOT EXISTS notes text;

-- Add lead_reference to orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS lead_reference text;

-- Lead number trigger
CREATE OR REPLACE FUNCTION public.generate_lead_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  year_str text;
  state_str text;
  zip_str text;
  next_seq integer;
  new_number text;
BEGIN
  year_str := to_char(NOW(), 'YY');
  state_str := UPPER(COALESCE(
    (regexp_match(NEW.address, ',\s+([A-Z]{2})\s+\d{5}'))[1], 'XX'));
  zip_str := COALESCE(
    (regexp_match(NEW.address, '\b(\d{5})\b'))[1],
    '00000');
  SELECT COUNT(*) + 1 INTO next_seq
  FROM public.delivery_leads
  WHERE lead_number LIKE 
    'RS-' || year_str || '-' || state_str || '-' || zip_str || '-%';
  new_number := 'RS-' || year_str || '-' || 
    state_str || '-' || zip_str || '-' || 
    LPAD(next_seq::text, 5, '0');
  NEW.lead_number := new_number;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_lead_number ON delivery_leads;

CREATE TRIGGER set_lead_number
BEFORE INSERT ON delivery_leads
FOR EACH ROW
WHEN (NEW.lead_number IS NULL)
EXECUTE FUNCTION public.generate_lead_number();
