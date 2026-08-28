import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Search, Check, X, Pencil } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useToast } from "@/hooks/use-toast";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export function Clientes() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle dos Modais
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    document: '',
    email: '',
    consent_whatsapp: false
  });

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar clientes:', error);
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Abrir Modal de Edição preenchendo os dados
  const handleEditClick = (cliente: any) => {
    setEditingId(cliente.id);
    setFormData({
      name: cliente.name,
      phone: cliente.phone,
      document: cliente.document || '',
      email: cliente.email || '',
      consent_whatsapp: cliente.consent_whatsapp
    });
    setIsEditDialogOpen(true);
  };

  // Lidar com o botão "Novo Cliente"
  const handleNewClick = () => {
    setEditingId(null);
    setFormData({
      name: '',
      phone: '',
      document: '',
      email: '',
      consent_whatsapp: false
    });
    setIsDialogOpen(true);
  };

  const handleSaveCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Atenção', description: 'Você precisa estar logado para cadastrar um cliente.', variant: 'destructive' });
      }

      if (editingId) {
        // Modo Edição (UPDATE)
        const { error } = await supabase
          .from('clients')
          .update({
            name: formData.name,
            phone: formData.phone,
            document: formData.document,
            email: formData.email,
            consent_whatsapp: formData.consent_whatsapp
          })
          .eq('id', editingId);

        if (error) throw error;
        toast({ title: 'Atualizado!', description: 'Cadastro do cliente atualizado com sucesso.' });
        setIsEditDialogOpen(false);
      } else {
        // Modo Criação (INSERT)
        const { error } = await supabase.from('clients').insert([
          {
            name: formData.name,
            phone: formData.phone,
            document: formData.document,
            email: formData.email,
            consent_whatsapp: formData.consent_whatsapp,
            user_id: user?.id || '00000000-0000-0000-0000-000000000000'
          }
        ]);

        if (error) throw error;
        toast({ title: 'Sucesso!', description: 'Cliente cadastrado com sucesso.' });
        setIsDialogOpen(false);
      }

      fetchClientes(); // recarrega a lista
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua base de clientes e consentimentos.</p>
        </div>
        
        <Button onClick={handleNewClick} className="gap-2">
          <UserPlus size={16} />
          Novo Cliente
        </Button>

        {/* Modal Único (Usado tanto para Criar quanto para Editar) */}
        <Dialog open={isDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
            if (!open) {
                setIsDialogOpen(false);
                setIsEditDialogOpen(false);
            }
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Cliente' : 'Cadastrar Cliente'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Atualize as informações do cliente selecionado.' : 'Insira as informações do novo cliente.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveCliente}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input id="name" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                  <Input id="phone" required placeholder="Ex: 11999999999" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="document">CPF / CNPJ</Label>
                  <Input id="document" value={formData.document} onChange={(e) => setFormData({...formData, document: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <input 
                    type="checkbox" 
                    id="consent" 
                    className="w-4 h-4 text-primary rounded border-gray-300"
                    checked={formData.consent_whatsapp}
                    onChange={(e) => setFormData({...formData, consent_whatsapp: e.target.checked})}
                  />
                  <Label htmlFor="consent" className="text-sm font-normal cursor-pointer">
                    Autoriza recebimento de cobranças por WhatsApp
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">{editingId ? 'Salvar Alterações' : 'Salvar Cliente'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Todos os Clientes</CardTitle>
              <CardDescription>Lista completa de clientes cadastrados.</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Buscar cliente..." className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone / WhatsApp</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="text-center">Permite Lembretes?</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">Carregando...</TableCell>
                  </TableRow>
                ) : clientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      Nenhum cliente cadastrado. Clique em "Novo Cliente" para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  clientes.map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell className="font-medium">{cliente.name}</TableCell>
                      <TableCell>{cliente.phone}</TableCell>
                      <TableCell>{cliente.document || '-'}</TableCell>
                      <TableCell className="text-center">
                        {cliente.consent_whatsapp ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <Check className="mr-1 h-3 w-3" /> Sim
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            <X className="mr-1 h-3 w-3" /> Não
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClick(cliente)} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="w-4 h-4 mr-2" /> Editar
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
