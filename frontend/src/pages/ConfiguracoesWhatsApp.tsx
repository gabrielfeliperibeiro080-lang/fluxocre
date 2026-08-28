import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Smartphone, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ConfiguracoesWhatsApp() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'waiting_qr' | 'connected' | 'error' | 'logged_out'>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/whatsapp/status`);
      setStatus(res.data.status);
      setQrCode(res.data.qrCode);
    } catch (error) {
      console.error('Erro ao buscar status do WhatsApp', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll a cada 3 segundos enquanto não estiver conectado
    const interval = setInterval(() => {
      if (status !== 'connected') {
        fetchStatus();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [status]);

  const handleConnect = async () => {
    try {
      setStatus('connecting');
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/whatsapp/connect`);
      toast({ title: "Iniciando conexão", description: "Aguarde a geração do QR Code..." });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao iniciar conexão", variant: "destructive" });
    }
  };

  const handleDisconnect = async () => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/whatsapp/logout`);
      setStatus('disconnected');
      setQrCode(null);
      toast({ title: "Desconectado", description: "Sessão do WhatsApp encerrada." });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao desconectar", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp Web</h1>
        <p className="text-muted-foreground">Gerencie a conexão do WhatsApp para envios automáticos.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Status da Conexão
            </CardTitle>
            <CardDescription>
              Conecte seu celular para automatizar lembretes e cobranças.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
              {status === 'connected' && (
                <>
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">WhatsApp Conectado</p>
                    <p className="text-sm text-muted-foreground">O sistema está pronto para enviar mensagens.</p>
                  </div>
                </>
              )}
              {status === 'waiting_qr' && (
                <>
                  <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                  <div>
                    <p className="font-medium text-yellow-600 dark:text-yellow-400">Aguardando Leitura</p>
                    <p className="text-sm text-muted-foreground">Escaneie o QR Code ao lado.</p>
                  </div>
                </>
              )}
              {status === 'connecting' && (
                <>
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <div>
                    <p className="font-medium text-primary">Conectando...</p>
                    <p className="text-sm text-muted-foreground">Iniciando serviço do WhatsApp.</p>
                  </div>
                </>
              )}
              {(status === 'disconnected' || status === 'logged_out' || status === 'error') && (
                <>
                  <AlertCircle className="w-8 h-8 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Desconectado</p>
                    <p className="text-sm text-muted-foreground">O serviço de mensagens está inativo.</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-4">
              {status === 'connected' ? (
                <Button variant="destructive" onClick={handleDisconnect}>Desconectar</Button>
              ) : (
                <Button onClick={handleConnect} disabled={status === 'connecting' || status === 'waiting_qr'}>
                  {status === 'connecting' || status === 'waiting_qr' ? 'Iniciando...' : 'Conectar WhatsApp'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>QR Code</CardTitle>
            <CardDescription>
              Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie o código abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
            {status === 'waiting_qr' && qrCode ? (
              <div className="p-4 bg-white rounded-xl shadow-sm border animate-in zoom-in duration-300">
                <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
              </div>
            ) : status === 'connected' ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <p className="text-muted-foreground">Sessão ativa. QR Code não necessário.</p>
              </div>
            ) : (
              <div className="text-center p-6 border-2 border-dashed rounded-lg text-muted-foreground">
                Clique em "Conectar WhatsApp" para gerar um novo QR Code.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
