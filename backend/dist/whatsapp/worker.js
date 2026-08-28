"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorker = startWorker;
const node_cron_1 = __importDefault(require("node-cron"));
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
const connection_1 = require("./connection");
dotenv_1.default.config();
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
    });
}
function startWorker() {
    console.log('[Worker] Iniciando background worker para fila de mensagens...');
    // Roda a cada minuto
    node_cron_1.default.schedule('* * * * *', async () => {
        if (connection_1.waStatus !== 'connected' || !connection_1.waSocket) {
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
            if (error)
                throw error;
            if (!messages || messages.length === 0)
                return;
            console.log(`[Worker] Processando ${messages.length} mensagens...`);
            for (const msg of messages) {
                try {
                    // Formatar o telefone (Adiciona 55 e @s.whatsapp.net)
                    const phone = msg.phone.replace(/\D/g, '');
                    const jid = `55${phone}@s.whatsapp.net`;
                    await connection_1.waSocket.sendMessage(jid, { text: msg.message });
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
                }
                catch (sendError) {
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
        }
        catch (err) {
            console.error('[Worker] Erro ao processar a fila:', err);
        }
    });
    // Roda todo dia às 08:00 AM para gerar as mensagens do dia
    // Para testes rápidos, pode mudar para a cada 5 minutos: '*/5 * * * *'
    node_cron_1.default.schedule('0 8 * * *', async () => {
        if (!supabase)
            return;
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
            if (err1 || err2)
                throw new Error('Erro ao buscar parcelas');
            const messagesToQueue = [];
            // Prepara os avisos de vencimento
            for (const inst of (dueTomorrow || [])) {
                if (inst.clients?.consent_whatsapp) {
                    messagesToQueue.push({
                        user_id: inst.user_id,
                        client_id: inst.client_id,
                        installment_id: inst.id,
                        phone: inst.clients.phone,
                        message: `*FluxoCred informa:* Olá ${inst.clients.name}, sua parcela ${inst.installment_number} no valor de R$ ${Number(inst.total_amount).toFixed(2)} vence amanhã (${new Date(inst.due_date).toLocaleDateString('pt-BR')}). Qualquer dúvida, estamos à disposição!`,
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
                        message: `*FluxoCred informa:* Olá ${inst.clients.name}, notamos que sua parcela ${inst.installment_number} no valor de R$ ${Number(inst.total_amount).toFixed(2)} que venceu em ${new Date(inst.due_date).toLocaleDateString('pt-BR')} ainda consta como pendente. Caso já tenha pago, desconsidere.`,
                        scheduled_at: new Date().toISOString(),
                        status: 'pending'
                    });
                }
            }
            if (messagesToQueue.length > 0) {
                const { error: insertError } = await supabase.from('message_queue').insert(messagesToQueue);
                if (insertError)
                    throw insertError;
                console.log(`[Worker] Adicionado ${messagesToQueue.length} cobranças na fila do WhatsApp.`);
            }
        }
        catch (error) {
            console.error('[Worker] Erro ao gerar cobranças diárias:', error);
        }
    });
}
