import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp, AlertTriangle, Percent, CheckCircle2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export function Dashboard() {
  const [metrics, setMetrics] = useState({
    totalConcedido: 0,
    lucroJuros: 0,
    valorRecebido: 0,
    valoresAtraso: 0,
    clientesAtivos: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      
      // Busca todas as operações para calcular o total concedido e o lucro projetado
      const { data: loans, error: loansError } = await supabase.from('loans').select('amount, total_amount');
      
      // Busca clientes
      const { count: clientsCount, error: clientsError } = await supabase.from('clients').select('*', { count: 'exact', head: true });

      // Busca todas as parcelas
      const { data: allInstallments, error: installmentsError } = await supabase
        .from('installments')
        .select('total_amount, paid_amount, status, due_date');

      if (loansError || clientsError || installmentsError) {
        throw new Error("Erro ao buscar dados do Supabase");
      }

      let totalConcedido = 0;
      let lucroJuros = 0;

      loans?.forEach(loan => {
        totalConcedido += Number(loan.amount);
        lucroJuros += (Number(loan.total_amount) - Number(loan.amount)); // Juros projetado
      });

      let valoresAtraso = 0;
      let valorRecebido = 0;
      
      const today = new Date().toISOString().split('T')[0];

      allInstallments?.forEach(inst => {
        // Se a parcela não está paga e a data de vencimento já passou
        if (inst.status !== 'paid' && inst.due_date < today) {
          valoresAtraso += (Number(inst.total_amount) - Number(inst.paid_amount || 0));
        }
        if (Number(inst.paid_amount) > 0) {
          valorRecebido += Number(inst.paid_amount);
        }
      });

      setMetrics({
        totalConcedido,
        lucroJuros,
        valorRecebido,
        valoresAtraso,
        clientesAtivos: clientsCount || 0,
      });

    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral financeira do seu negócio.</p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Concedido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : formatCurrency(metrics.totalConcedido)}
            </div>
            <p className="text-xs text-muted-foreground">Capital principal emprestado</p>
          </CardContent>
        </Card>

        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Lucro de Juros</CardTitle>
            <Percent className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {loading ? '...' : formatCurrency(metrics.lucroJuros)}
            </div>
            <p className="text-xs text-primary/80">Rendimento total projetado</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/50 bg-green-500/5 dark:bg-green-500/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400">Valor Recebido</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {loading ? '...' : formatCurrency(metrics.valorRecebido)}
            </div>
            <p className="text-xs text-green-600/80 dark:text-green-400/80">Total pago pelos clientes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valores em Atraso</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {loading ? '...' : formatCurrency(metrics.valoresAtraso)}
            </div>
            <p className="text-xs text-muted-foreground">Soma de parcelas vencidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : metrics.clientesAtivos}
            </div>
            <p className="text-xs text-muted-foreground">Na base de dados</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
