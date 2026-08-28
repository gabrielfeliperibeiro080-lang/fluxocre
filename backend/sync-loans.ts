import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function syncOldLoans() {
  console.log('🔄 Sincronizando empréstimos antigos com o Fluxo de Caixa...');

  // 1. Busca todos os empréstimos e os nomes dos clientes
  const { data: loans, error: loansError } = await supabase
    .from('loans')
    .select('*, clients(name)');

  if (loansError) {
    console.error('Erro ao buscar empréstimos:', loansError);
    return;
  }

  if (!loans || loans.length === 0) {
    console.log('Nenhum empréstimo encontrado.');
    return;
  }

  // 2. Busca todas as saídas da categoria de empréstimo para não duplicar
  const { data: expenses, error: expensesError } = await supabase
    .from('expenses')
    .select('*')
    .eq('category', 'Crédito/Empréstimo');

  if (expensesError) {
    console.error('Erro ao buscar despesas:', expensesError);
    return;
  }

  let insertedCount = 0;

  for (const loan of loans) {
    const clientName = loan.clients?.name || 'Cliente';
    const description = `Empréstimo liberado - ${clientName}`;
    const date = new Date(loan.start_date).toISOString().split('T')[0];
    
    // Verifica se já existe uma saída com essa mesma descrição, data e valor (evita duplicar)
    const alreadyExists = expenses?.some(e => 
        e.description === description && 
        Number(e.amount) === Number(loan.amount) &&
        e.date === date
    );

    if (!alreadyExists) {
      const { error: insertError } = await supabase.from('expenses').insert([{
        user_id: loan.user_id,
        description: description,
        amount: loan.amount,
        date: date,
        category: 'Crédito/Empréstimo'
      }]);

      if (insertError) {
        console.error(`Erro ao inserir saída para o empréstimo de ${clientName}:`, insertError.message);
      } else {
        console.log(`✅ Adicionado ao caixa: Saída de R$ ${loan.amount} (${clientName})`);
        insertedCount++;
      }
    }
  }

  console.log(`\n🎉 Sincronização concluída! ${insertedCount} novas saídas retroativas foram adicionadas ao caixa.`);
}

syncOldLoans();
