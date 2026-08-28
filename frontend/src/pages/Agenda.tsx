import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useToast } from "@/hooks/use-toast";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export function Agenda() {
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAgenda();
  }, []);

  const fetchAgenda = async () => {
    try {
      setLoading(true);
      
      // Buscar parcelas pendentes ou atrasadas, ordenadas pela data de vencimento mais próxima
      const { data, error } = await supabase
        .from('installments')
        .select('*, clients(name, phone, consent_whatsapp)')
        .neq('status', 'paid') // Exclui as pagas
        .order('due_date', { ascending: true })
        .limit(30);

      if (error) throw error;
      setInstallments(data || []);
    } catch (error) {
      console.error('Erro ao buscar agenda:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (dueDateStr: string, status: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr + 'T00:00:00'); // Fuso local
    
    if (status === 'paid') return <span className="text-green-600 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/> Paga</span>;
    
    if (dueDate < today) {
      return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Atrasada</Badge>;
    } else if (dueDate.getTime() === today.getTime()) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 flex items-center gap-1"><Clock className="w-3 h-3"/> Vence Hoje</Badge>;
    } else {
      return <Badge variant="outline" className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3"/> A Vencer</Badge>;
    }
  };

  const handleManualReminder = async (inst: any) => {
    if (!inst.clients?.consent_whatsapp) {
      toast({ title: 'Atenção', description: 'Este cliente não autorizou mensagens via WhatsApp.', variant: 'destructive' });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('pix_key').eq('id', user.id).single();
      const pixText = profile?.pix_key ? `\n\nChave PIX para pagamento: ${profile.pix_key}` : '';

      const message = `*Luck Cred informa:* Olá ${inst.clients.name}, lembramos que sua parcela ${inst.installment_number} no valor de R$ ${Number(inst.total_amount).toFixed(2)} está agendada para ${new Date(inst.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}. Caso já tenha pago, desconsidere.${pixText}`;

      const { error } = await supabase.from('message_queue').insert([{
        user_id: user.id,
        client_id: inst.client_id,
        installment_id: inst.id,
        phone: inst.clients.phone,
        message: message,
        scheduled_at: new Date().toISOString(), // Disparo imediato
        status: 'pending'
      }]);

      if (error) throw error;
      toast({ title: 'Enviado para a Fila', description: 'A cobrança será disparada pelo robô em instantes!' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agenda de Cobranças</h1>
        <p className="text-muted-foreground">Acompanhe os próximos vencimentos e parcelas em atraso.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximos Vencimentos</CardTitle>
          <CardDescription>Visão geral de quem deve pagar nos próximos dias.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">Carregando...</TableCell>
                  </TableRow>
                ) : installments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                      Nenhuma cobrança pendente para os próximos dias! 🎉
                    </TableCell>
                  </TableRow>
                ) : (
                  installments.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">
                        {new Date(inst.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>{inst.clients?.name}</TableCell>
                      <TableCell>{inst.clients?.phone}</TableCell>
                      <TableCell>{inst.installment_number}ª</TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {Number(inst.total_amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center flex justify-center">
                        {getStatusBadge(inst.due_date, inst.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleManualReminder(inst)}
                          className="border-green-200 text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                        >
                          Cobrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
