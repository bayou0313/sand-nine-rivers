ALTER TABLE public.orders 
ADD CONSTRAINT orders_pit_id_fkey 
FOREIGN KEY (pit_id) REFERENCES public.pits(id) 
ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';