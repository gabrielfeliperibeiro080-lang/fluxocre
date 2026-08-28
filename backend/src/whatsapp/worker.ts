import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { waSocket, waStatus } from './connection';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: any = null;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

export function startWorker() {
  console.log('[Worker] Iniciando background worker para fila de mensagens...');
  
  // Roda a cada minuto
  cron.schedule('* * * * *', async () => {
    if (waStatus !== 'connected' || !waSocket) {
      return;
    }

    if (!supabase) {
      console.warn('[Worker] Supabase não configurado. Fila não processada.');
      return;
    }

    try {
      // Busca mensagens pendentes que já passaram do horário de agendamento (scheduled_at <= now)
      const { data: messages, error } = await supabase
        .from('message_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString())
        .limit(10); // Processa 10 por vez

      if (error) throw error;
      if (!messages || messages.length === 0) return;

      console.log(`[Worker] Processando ${messages.length} mensagens...`);

      for (const msg of messages) {
        try {
          // Formatar o telefone (Adiciona 55 e @s.whatsapp.net)
          const phone = msg.phone.replace(/\D/g, '');
          const jid = `55${phone}@s.whatsapp.net`;
          
          let msgPayload: any = { text: msg.message };
          
          // Se tiver anexo em base64, converte e envia como documento
          if (msg.media_base64) {
             const base64Data = msg.media_base64.includes(',') ? msg.media_base64.split(',')[1] : msg.media_base64;
             const buffer = Buffer.from(base64Data, 'base64');
             msgPayload = {
                 document: buffer,
                 mimetype: 'application/pdf',
                 fileName: msg.media_name || 'Documento_LuckCred.pdf',
                 caption: msg.message // O texto vai como legenda do arquivo
             };
          }

          await waSocket.sendMessage(jid, msgPayload);
          
          // Marca como enviado
          await supabase
            .from('message_queue')
            .update({ 
                status: 'sent', 
                sent_at: new Date().toISOString(), 
                attempts: msg.attempts + 1 
            })
            .eq('id', msg.id);

          console.log(`[Worker] Mensagem enviada para ${phone}`);
        } catch (sendError: any) {
          console.error(`[Worker] Erro ao enviar mensagem para ${msg.phone}:`, sendError);
          // Marca erro
          await supabase
            .from('message_queue')
            .update({ 
                status: msg.attempts >= 3 ? 'error' : 'pending', 
                error: sendError.message,
                attempts: msg.attempts + 1 
            })
            .eq('id', msg.id);
        }
      }
    } catch (err) {
      console.error('[Worker] Erro ao processar a fila:', err);
    }
  });

  // Roda todo dia às 08:00 AM para gerar as mensagens do dia
  // Para testes rápidos, pode mudar para a cada 5 minutos: '*/5 * * * *'
  cron.schedule('0 8 * * *', async () => {
    if (!supabase) return;
    console.log('[Worker] Rodando rotina diária de verificação de cobranças...');

    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const strToday = today.toISOString().split('T')[0];
      const strTomorrow = tomorrow.toISOString().split('T')[0];

      // Buscar parcelas que vencem amanhã
      const { data: dueTomorrow, error: err1 } = await supabase
        .from('installments')
        .select('*, clients(id, phone, name, consent_whatsapp)')
        .eq('status', 'pending')
        .eq('due_date', strTomorrow);

      // Buscar parcelas que venceram e ainda estão pendentes
      const { data: lateInstallments, error: err2 } = await supabase
        .from('installments')
        .select('*, clients(id, phone, name, consent_whatsapp)')
        .eq('status', 'pending')
        .lt('due_date', strToday);

      if (err1 || err2) throw new Error('Erro ao buscar parcelas');

      // Buscar os perfis para pegar as chaves PIX
      const userIds = [...new Set([
        ...(dueTomorrow || []).map((i: any) => i.user_id),
        ...(lateInstallments || []).map((i: any) => i.user_id)
      ])];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, pix_key')
        .in('id', userIds);
      
      const getPixText = (userId: string) => {
        const profile = profiles?.find((p: any) => p.id === userId);
        return profile?.pix_key ? `\n\nChave PIX para pagamento: ${profile.pix_key}` : '';
      };

      const messagesToQueue = [];

      // Prepara os avisos de vencimento
      for (const inst of (dueTomorrow || [])) {
        if (inst.clients?.consent_whatsapp) {
          messagesToQueue.push({
            user_id: inst.user_id,
            client_id: inst.client_id,
            installment_id: inst.id,
            phone: inst.clients.phone,
            message: `*Luck Cred informa:* Olá ${inst.clients.name}, sua parcela ${inst.installment_number} no valor de R$ ${Number(inst.total_amount).toFixed(2)} vence amanhã (${new Date(inst.due_date).toLocaleDateString('pt-BR')}). Qualquer dúvida, estamos à disposição!${getPixText(inst.user_id)}`,
            scheduled_at: new Date().toISOString(), // Envia logo após gerar
            status: 'pending'
          });
        }
      }

      // Prepara os avisos de atraso
      for (const inst of (lateInstallments || [])) {
        if (inst.clients?.consent_whatsapp) {
          messagesToQueue.push({
            user_id: inst.user_id,
            client_id: inst.client_id,
            installment_id: inst.id,
            phone: inst.clients.phone,
            message: `*Luck Cred informa:* Olá ${inst.clients.name}, notamos que sua parcela ${inst.installment_number} no valor de R$ ${Number(inst.total_amount).toFixed(2)} que venceu em ${new Date(inst.due_date).toLocaleDateString('pt-BR')} ainda consta como pendente. Caso já tenha pago, desconsidere.${getPixText(inst.user_id)}`,
            scheduled_at: new Date().toISOString(),
            status: 'pending'
          });
        }
      }

      if (messagesToQueue.length > 0) {
        const { error: insertError } = await supabase.from('message_queue').insert(messagesToQueue);
        if (insertError) throw insertError;
        console.log(`[Worker] Adicionado ${messagesToQueue.length} cobranças na fila do WhatsApp.`);
      }

    } catch (error) {
      console.error('[Worker] Erro ao gerar cobranças diárias:', error);
    }
  });
}
