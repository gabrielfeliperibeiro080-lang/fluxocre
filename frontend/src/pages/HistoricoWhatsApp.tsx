import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export function HistoricoWhatsApp() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_queue')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Erro ao buscar fila de mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Histórico do WhatsApp</h1>
        <p className="text-muted-foreground">Monitore as mensagens enviadas, agendadas e erros.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fila e Histórico</CardTitle>
          <CardDescription>Visualização completa da mensageria.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Mensagem (Resumo)</TableHead>
                  <TableHead>Agendado para</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">Carregando...</TableCell>
                  </TableRow>
                ) : messages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                      Nenhuma mensagem no histórico.
                    </TableCell>
                  </TableRow>
                ) : (
                  messages.map((msg) => (
                    <TableRow key={msg.id}>
                      <TableCell className="font-medium">{msg.clients?.name || msg.phone}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{msg.message}</TableCell>
                      <TableCell>{new Date(msg.scheduled_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {msg.status === 'sent' && <span className="flex items-center text-green-600"><CheckCircle2 className="w-4 h-4 mr-1"/> Enviada</span>}
                        {msg.status === 'pending' && <span className="flex items-center text-yellow-600"><Clock className="w-4 h-4 mr-1"/> Pendente</span>}
                        {msg.status === 'error' && <span className="flex items-center text-red-600"><XCircle className="w-4 h-4 mr-1"/> Erro</span>}
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
