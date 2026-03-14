
ALTER TABLE public.events
ADD COLUMN sinpe_phone text DEFAULT '89406622',
ADD COLUMN bank_name text DEFAULT 'Banco de Costa Rica',
ADD COLUMN bank_account_holder text DEFAULT 'Plusspaz CR',
ADD COLUMN bank_account_number text DEFAULT '',
ADD COLUMN bank_account_type text DEFAULT 'Cuenta corriente colones',
ADD COLUMN bank_cedula text DEFAULT '';
