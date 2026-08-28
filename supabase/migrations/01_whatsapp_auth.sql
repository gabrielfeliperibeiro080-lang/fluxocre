-- Tabela para armazenar a sessão e chaves do WhatsApp (Baileys)
CREATE TABLE IF NOT EXISTS public.whatsapp_auth (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Como isso é gerenciado 100% pelo servidor backend usando a chave service_role,
-- não precisamos abrir políticas de RLS para o front-end acessar.
ALTER TABLE public.whatsapp_auth ENABLE ROW LEVEL SECURITY;

-- Reload do schema (por precaução)
NOTIFY pgrst, 'reload schema';
