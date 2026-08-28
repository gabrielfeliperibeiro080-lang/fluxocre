import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ChevronDown, ChevronUp, CheckCircle, Clock, FileText } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useToast } from "@/hooks/use-toast";
import { generateLoanTerm, generateReceipt, downloadBase64PDF } from '../lib/pdf';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export function Operacoes() {
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [installmentsMap, setInstallmentsMap] = useState<Record<string, any[]>>({});
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    client_id: '',
    amount: '',
    interest_rate: '',
    installments_count: '1',
    first_due_date: ''
  });

  useEffect(() => {
    fetchOperacoes();
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    const { data } = await supabase.from('clients').select('id, name, document, phone, consent_whatsapp');
    if (data) setClientes(data);
  };

  const fetchOperacoes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('loans')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOperacoes(data || []);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchInstallments = async (loanId: string) => {
    if (installmentsMap[loanId]) {
      setExpandedLoanId(expandedLoanId === loanId ? null : loanId);
      return;
    }

    const { data, error } = await supabase
      .from('installments')
      .select('*')
      .eq('loan_id', loanId)
      .order('installment_number', { ascending: true });

    if (data && !error) {
      setInstallmentsMap(prev => ({ ...prev, [loanId]: data }));
    }
    setExpandedLoanId(expandedLoanId === loanId ? null : loanId);
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const principal = parseFloat(formData.amount);
      const rate = parseFloat(formData.interest_rate) / 100;
      const count = parseInt(formData.installments_count);
      const totalInterest = principal * rate; // Juros simples sobre o total (ex: 10% sobre 1000 = 100)
      const totalAmount = principal + totalInterest;
      
      const principalPerInst = principal / count;
      const interestPerInst = totalInterest / count;
      const totalPerInst = totalAmount / count;

      // 1. Inserir Loan
      const { data: loanData, error: loanError } = await supabase.from('loans').insert([{
        user_id: user.id,
        client_id: formData.client_id,
        amount: principal,
        start_date: new Date().toISOString(),
        interest_rate: parseFloat(formData.interest_rate),
        interest_type: 'simple',
        total_amount: totalAmount,
        installments_count: count,
        periodicity: 'monthly',
        first_due_date: formData.first_due_date
      }]).select().single();

      if (loanError) throw loanError;

      // 2. Inserir Parcelas (Installments)
      const installmentsToInsert = [];
      let currentDate = new Date(formData.first_due_date);
      
      for (let i = 1; i <= count; i++) {
        installmentsToInsert.push({
          user_id: user.id,
          loan_id: loanData.id,
          client_id: formData.client_id,
          installment_number: i,
          due_date: currentDate.toISOString().split('T')[0],
          principal_amount: principalPerInst,
          interest_amount: interestPerInst,
          total_amount: totalPerInst,
          status: 'pending'
        });
        
        // Adiciona 1 mês para a próxima parcela
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      const { error: instError } = await supabase.from('installments').insert(installmentsToInsert);
      if (instError) throw instError;

      // 3. Registrar a SAÍDA de caixa (dinheiro que você entregou ao cliente)
      const client = clientes.find(c => c.id === formData.client_id);
      const clientName = client?.name || 'Cliente';
      const { error: expenseError } = await supabase.from('expenses').insert([{
        user_id: user.id,
        description: `Empréstimo liberado - ${clientName}`,
        amount: principal,
        date: new Date().toISOString().split('T')[0],
        category: 'Crédito/Empréstimo'
      }]);
      if (expenseError) throw expenseError;

      // 4. Gerar Termo em PDF
      const pdfBase64 = generateLoanTerm(client, loanData, installmentsToInsert);
      
      // Enviar Termo por WhatsApp
      if (client?.consent_whatsapp) {
        await supabase.from('message_queue').insert([{
          user_id: user.id,
          client_id: formData.client_id,
          phone: client.phone,
          message: `*Luck Cred informa:* Olá ${clientName}, segue anexo o Termo de Ciência referente ao seu novo empréstimo no valor de R$ ${principal.toFixed(2)}.\n\nPara validarmos a liberação de forma digital, grave um curto vídeo-selfie lendo a frase que está no final do documento em PDF e nos envie por aqui.`,
          scheduled_at: new Date().toISOString(),
          status: 'pending',
          media_base64: pdfBase64,
          media_name: 'Termo_Emprestimo.pdf'
        }]);
      }

      // Download Automático do Termo
      downloadBase64PDF(pdfBase64, `Termo_${clientName.replace(/\s+/g, '_')}.pdf`);

      toast({ title: 'Sucesso', description: 'Operação de crédito criada e Termo gerado!' });
      setIsDialogOpen(false);
      setFormData({ client_id: '', amount: '', interest_rate: '', installments_count: '1', first_due_date: '' });
      fetchOperacoes();

    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handlePayInstallment = async (inst: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Atualizar parcela
      const { error: updateError } = await supabase
        .from('installments')
        .update({ status: 'paid', paid_amount: inst.total_amount })
        .eq('id', inst.id);
      if (updateError) throw updateError;

      // 2. Registrar no Fluxo de Caixa (Income)
      const { error: incomeError } = await supabase.from('income').insert([{
        user_id: user.id,
        description: `Pagamento Parcela ${inst.installment_number} - ${operacoes.find(o => o.id === inst.loan_id)?.clients?.name}`,
        amount: inst.total_amount,
        date: new Date().toISOString(),
        category: 'Crédito/Empréstimo',
        client_id: inst.client_id,
        loan_id: inst.loan_id
      }]);
      if (incomeError) throw incomeError;

      // 3. Colocar recibo na fila do WhatsApp e baixar na máquina
      const client = clientes.find(c => c.id === inst.client_id);
      
      // Gera o Recibo PDF
      const pdfBase64 = generateReceipt(client, inst, new Date().toISOString());
      
      // Dispara o download no navegador do gerente
      downloadBase64PDF(pdfBase64, `Recibo_${inst.installment_number}_${client?.name.replace(/\s+/g, '_')}.pdf`);

      if (client?.consent_whatsapp) {
        await supabase.from('message_queue').insert([{
          user_id: user.id,
          client_id: inst.client_id,
          installment_id: inst.id,
          phone: client.phone,
          message: `*Luck Cred informa:* Recebemos o pagamento da parcela ${inst.installment_number} no valor de R$ ${Number(inst.total_amount).toFixed(2)}. Segue seu recibo anexo!`,
          scheduled_at: new Date().toISOString(),
          status: 'pending',
          media_base64: pdfBase64,
          media_name: 'Recibo_Pagamento.pdf'
        }]);
      }

      toast({ title: 'Parcela Paga', description: 'O pagamento foi registrado e o recibo gerado!' });
      
      // Atualizar interface
      const updatedData = await supabase.from('installments').select('*').eq('loan_id', inst.loan_id).order('installment_number', { ascending: true });
      setInstallmentsMap(prev => ({ ...prev, [inst.loan_id]: updatedData.data || [] }));

    } catch (error: any) {
      toast({ title: 'Erro ao Pagar', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Operações de Crédito</h1>
          <p className="text-muted-foreground text-sm">Gerencie empréstimos, parcelamentos e baixas.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto"><Plus size={16} /> Nova Operação</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Novo Empréstimo</DialogTitle>
              <DialogDescription>Preencha os dados para simular e gerar as parcelas.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateLoan}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Cliente</Label>
                  <select 
                    required 
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={formData.client_id}
                    onChange={e => setFormData({...formData, client_id: e.target.value})}
                  >
                    <option value="" disabled>Selecione o cliente...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Valor Principal (R$)</Label>
                    <Input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Juros Totais (%)</Label>
                    <Input required type="number" step="0.1" value={formData.interest_rate} onChange={e => setFormData({...formData, interest_rate: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Nº de Parcelas</Label>
                    <Input required type="number" min="1" value={formData.installments_count} onChange={e => setFormData({...formData, installments_count: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label>1º Vencimento</Label>
                    <Input required type="date" value={formData.first_due_date} onChange={e => setFormData({...formData, first_due_date: e.target.value})} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Gerar Operação</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Operações</CardTitle>
          <CardDescription>Toque na operação para ver as parcelas.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : operacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground px-6">
              Nenhuma operação cadastrada.
            </div>
          ) : (
            <>
              {/* Cards — Mobile */}
              <div className="divide-y md:hidden">
                {operacoes.map((op) => (
                  <div key={op.id}>
                    <div
                      className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer active:bg-muted/50"
                      onClick={() => fetchInstallments(op.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{op.clients?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(op.start_date).toLocaleDateString('pt-BR')} • {op.installments_count}x
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">R$ {Number(op.amount).toFixed(2)}</span>
                          <span className="text-xs">→</span>
                          <span className="text-sm font-semibold text-primary">R$ {Number(op.total_amount).toFixed(2)}</span>
                        </div>
                      </div>
                      {expandedLoanId === op.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>

                    {expandedLoanId === op.id && installmentsMap[op.id] && (
                      <div className="bg-muted/30 px-4 py-3 border-t">
                        <h4 className="font-semibold mb-2 text-xs text-muted-foreground uppercase tracking-wide">Parcelas</h4>
                        <div className="grid gap-2">
                          {installmentsMap[op.id].map(inst => (
                            <div key={inst.id} className="bg-background p-3 rounded border text-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold">{inst.installment_number}ª parcela</span>
                                <span className="font-medium">R$ {Number(inst.total_amount).toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Vence: {new Date(inst.due_date).toLocaleDateString('pt-BR')}</span>
                                <div className="flex items-center gap-2">
                                  {inst.status === 'paid' ? (
                                    <>
                                      <span className="flex items-center text-green-600 text-xs font-medium"><CheckCircle size={14} className="mr-1"/> Paga</span>
                                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => {
                                        const c = clientes.find(c => c.id === inst.client_id);
                                        const pdf = generateReceipt(c, inst, new Date().toISOString());
                                        downloadBase64PDF(pdf, `Recibo_${inst.installment_number}.pdf`);
                                      }}><FileText size={12} className="mr-1"/> Recibo</Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="flex items-center text-yellow-600 text-xs font-medium"><Clock size={14} className="mr-1"/> Pendente</span>
                                      <Button size="sm" className="h-6 text-xs px-2" onClick={() => handlePayInstallment(inst)}>Baixa</Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Tabela — Desktop */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor Liberado</TableHead>
                      <TableHead>Total c/ Juros</TableHead>
                      <TableHead>Parcelas</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operacoes.map((op) => (
                      <React.Fragment key={op.id}>
                        <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => fetchInstallments(op.id)}>
                          <TableCell className="font-medium">{op.clients?.name}</TableCell>
                          <TableCell>R$ {Number(op.amount).toFixed(2)}</TableCell>
                          <TableCell className="text-primary font-semibold">R$ {Number(op.total_amount).toFixed(2)}</TableCell>
                          <TableCell>{op.installments_count}x</TableCell>
                          <TableCell>{new Date(op.start_date).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell className="text-right">
                            {expandedLoanId === op.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </TableCell>
                        </TableRow>
                        {expandedLoanId === op.id && installmentsMap[op.id] && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={6} className="p-0">
                              <div className="p-4 border-b">
                                <h4 className="font-semibold mb-2 text-sm">Cronograma de Parcelas</h4>
                                <div className="grid gap-2">
                                  {installmentsMap[op.id].map(inst => (
                                    <div key={inst.id} className="flex flex-col gap-2 bg-background p-3 rounded border text-sm sm:flex-row sm:items-center sm:justify-between">
                                      <div className="flex items-center gap-3">
                                        <span className="font-bold w-6">{inst.installment_number}º</span>
                                        <span>Vence: {new Date(inst.due_date).toLocaleDateString('pt-BR')}</span>
                                        <span className="font-medium">R$ {Number(inst.total_amount).toFixed(2)}</span>
                                      </div>
                                      <div className="flex items-center gap-3 justify-end">
                                        {inst.status === 'paid' ? (
                                          <div className="flex gap-2 items-center">
                                            <span className="flex items-center text-green-600 font-medium"><CheckCircle size={16} className="mr-1"/> Paga</span>
                                            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => {
                                              const c = clientes.find(c => c.id === inst.client_id);
                                              const pdf = generateReceipt(c, inst, new Date().toISOString());
                                              downloadBase64PDF(pdf, `Recibo_${inst.installment_number}.pdf`);
                                            }}><FileText size={14} className="mr-1"/> Recibo</Button>
                                          </div>
                                        ) : (
                                          <>
                                            <span className="flex items-center text-yellow-600 font-medium"><Clock size={16} className="mr-1"/> Pendente</span>
                                            <Button size="sm" onClick={() => handlePayInstallment(inst)}>Dar Baixa</Button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

