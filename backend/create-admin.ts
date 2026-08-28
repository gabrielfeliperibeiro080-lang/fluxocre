import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createAdmin() {
  const email = 'admin@fluxocred.com';
  const password = 'admin';

  console.log('Tentando criar usuário:', email);
  
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true // Pula a verificação de e-mail!
  });

  if (error) {
    if (error.message.includes('User already registered')) {
        console.log('Usuário já existe! Ignorando...');
        return;
    }
    console.error('Erro ao criar usuário:', error.message);
    process.exit(1);
  }

  console.log('Usuário criado com sucesso e e-mail validado automaticamente!');
  console.log('ID do usuário:', data.user.id);
}

createAdmin();
