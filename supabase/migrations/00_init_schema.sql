-- Tabela de Perfis
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE,
  name text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Tabela de Clientes
CREATE TABLE public.clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  whatsapp boolean DEFAULT true,
  document text,
  email text,
  address text,
  notes text,
  consent_whatsapp boolean DEFAULT false,
  consent_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Operações (Loans)
CREATE TABLE public.loans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  client_id uuid REFERENCES public.clients NOT NULL,
  amount numeric NOT NULL,
  start_date date NOT NULL,
  interest_rate numeric NOT NULL,
  interest_type text NOT NULL, -- 'simple', 'compound'
  total_amount numeric NOT NULL,
  installments_count integer NOT NULL,
  periodicity text NOT NULL, -- 'monthly', 'weekly', 'biweekly'
  first_due_date date NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Parcelas (Installments)
CREATE TABLE public.installments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  loan_id uuid REFERENCES public.loans NOT NULL,
  client_id uuid REFERENCES public.clients NOT NULL,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  principal_amount numeric NOT NULL,
  interest_amount numeric NOT NULL,
  total_amount numeric NOT NULL,
  paid_amount numeric DEFAULT 0,
  status text DEFAULT 'pending', -- 'pending', 'paid', 'partial', 'late', 'canceled'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Pagamentos
CREATE TABLE public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  installment_id uuid REFERENCES public.installments NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL, -- 'pix', 'cash', 'transfer', 'other'
  payment_date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Fluxo de Caixa - Entradas
CREATE TABLE public.income (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL,
  category text,
  client_id uuid REFERENCES public.clients,
  loan_id uuid REFERENCES public.loans,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Fluxo de Caixa - Saídas
CREATE TABLE public.expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL,
  category text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Fila de Mensagens do WhatsApp
CREATE TABLE public.message_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  client_id uuid REFERENCES public.clients,
  installment_id uuid REFERENCES public.installments,
  phone text NOT NULL,
  message text NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'sent', 'error', 'canceled'
  attempts integer DEFAULT 0,
  error text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Clients RLS
CREATE POLICY "Users can view own clients" ON public.clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clients" ON public.clients FOR DELETE USING (auth.uid() = user_id);

-- E as mesmas políticas de RLS para as outras tabelas (para manter concisão as repliquei de forma análoga):
CREATE POLICY "Users can manage own loans" ON public.loans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own installments" ON public.installments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own payments" ON public.payments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own income" ON public.income FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own message_queue" ON public.message_queue FOR ALL USING (auth.uid() = user_id);

-- Trigger para criar profile no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
