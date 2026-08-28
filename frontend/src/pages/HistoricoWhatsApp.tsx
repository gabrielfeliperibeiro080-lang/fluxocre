import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'sent') return <span className="flex items-center text-green-600"><CheckCircle2 className="w-4 h-4 mr-1"/> Enviada</span>;
  if (status === 'pending') return <span className="flex items-center text-yellow-600"><Clock className="w-4 h-4 mr-1"/> Pendente</span>;
  if (status === 'error') return <span className="flex items-center text-red-600"><XCircle className="w-4 h-4 mr-1"/> Erro</span>;
  return null;
};

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
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Histórico do WhatsApp</h1>
        <p className="text-muted-foreground text-sm">Monitore as mensagens enviadas, agendadas e erros.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fila e Histórico</CardTitle>
          <CardDescription>Visualização completa da mensageria.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground px-6">
              Nenhuma mensagem no histórico.
            </div>
          ) : (
            <>
              {/* Cards — Mobile */}
              <div className="divide-y md:hidden">
                {messages.map((msg) => (
                  <div key={msg.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{msg.clients?.name || msg.phone}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(msg.scheduled_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="shrink-0 text-sm">
                      <StatusIcon status={msg.status} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Tabela — Desktop */}
              <div className="hidden md:block rounded-md border">
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
                    {messages.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell className="font-medium">{msg.clients?.name || msg.phone}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{msg.message}</TableCell>
                        <TableCell>{new Date(msg.scheduled_at).toLocaleString()}</TableCell>
                        <TableCell><StatusIcon status={msg.status} /></TableCell>
                      </TableRow>
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
