import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useToast } from "@/hooks/use-toast";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export function FluxoCaixa() {
  const [entradas, setEntradas] = useState<any[]>([]);
  const [saidas, setSaidas] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: 'Operacional'
  });

  useEffect(() => {
    fetchCaixa();
  }, []);

  const fetchCaixa = async () => {
    const [inRes, outRes] = await Promise.all([
      supabase.from('income').select('*').order('date', { ascending: false }).limit(15),
      supabase.from('expenses').select('*').order('date', { ascending: false }).limit(15)
    ]);
    
    if (inRes.data) setEntradas(inRes.data);
    if (outRes.data) setSaidas(outRes.data);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from('expenses').insert([{
        user_id: user.id,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: formData.date,
        category: formData.category
      }]);

      if (error) throw error;
      
      toast({ title: 'Sucesso', description: 'Despesa registrada com sucesso.' });
      setIsDialogOpen(false);
      fetchCaixa();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fluxo de Caixa</h1>
          <p className="text-muted-foreground">Controle suas entradas e saídas financeiras.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="gap-2"><Plus size={16} /> Nova Saída</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Registrar Despesa</DialogTitle>
              <DialogDescription>Insira os dados da saída financeira (contas, infraestrutura, salários).</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddExpense}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Descrição</Label>
                  <Input required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Valor (R$)</Label>
                    <Input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Data</Label>
                    <Input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Categoria</Label>
                  <select 
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="Operacional">Operacional (Sistemas, Internet)</option>
                    <option value="Folha">Folha de Pagamento</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Impostos">Impostos / Taxas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Salvar Despesa</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-green-100">
          <CardHeader className="bg-green-50/50 dark:bg-green-900/10">
            <CardTitle className="flex items-center text-green-700 dark:text-green-400">
              <ArrowUpCircle className="mr-2 h-5 w-5" /> Entradas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entradas.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center h-20 text-muted-foreground">Nenhuma entrada.</TableCell></TableRow>
                ) : entradas.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">+ R$ {Number(e.amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-red-100">
          <CardHeader className="bg-red-50/50 dark:bg-red-900/10">
            <CardTitle className="flex items-center text-red-700 dark:text-red-400">
              <ArrowDownCircle className="mr-2 h-5 w-5" /> Saídas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saidas.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center h-20 text-muted-foreground">Nenhuma saída.</TableCell></TableRow>
                ) : saidas.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{new Date(s.date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{s.description}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">- R$ {Number(s.amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
