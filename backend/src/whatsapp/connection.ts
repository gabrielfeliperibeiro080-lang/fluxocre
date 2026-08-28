import { makeWASocket, DisconnectReason, Browsers, WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import * as QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { useSupabaseAuthState } from './supabaseAuthState';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Estado global do WhatsApp
export let waSocket: WASocket | null = null;
export let waStatus: 'disconnected' | 'connecting' | 'waiting_qr' | 'connected' | 'error' | 'logged_out' = 'disconnected';
export let waQrCode: string | null = null;

export async function setupWhatsAppConnection() {
  waStatus = 'connecting';
  
  const { state, saveCreds } = await useSupabaseAuthState(supabase, 'baileys_session');

  waSocket = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: false,
    logger: pino({ level: 'silent' }) as any
  });

  waSocket.ev.on('creds.update', saveCreds);

  waSocket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      waStatus = 'waiting_qr';
      // Converte o QR Code para base64 image data url para o frontend
      waQrCode = await QRCode.toDataURL(qr);
      console.log('[WhatsApp] QR Code gerado. Aguardando leitura...');
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('[WhatsApp] Conexão fechada. Reconectar:', shouldReconnect);
      
      waStatus = 'disconnected';
      waQrCode = null;

      if (shouldReconnect) {
        waStatus = 'connecting';
        setupWhatsAppConnection();
      } else {
        // Usuário deslogou (ou sessão expirou). Remover a sessão do banco.
        await supabase.from('whatsapp_auth').delete().like('id', 'baileys_session%');
        waStatus = 'logged_out';
      }
    } else if (connection === 'open') {
      console.log('[WhatsApp] 🟢 Conectado ao WhatsApp com sucesso!');
      waStatus = 'connected';
      waQrCode = null;
    }
  });

  waSocket.ev.on('messages.upsert', async (m) => {
    // Para logs ou respostas no futuro
  });
}

export async function logoutWhatsApp() {
  if (waSocket) {
    waSocket.logout();
    waSocket = null;
    waStatus = 'disconnected';
    waQrCode = null;
    await supabase.from('whatsapp_auth').delete().like('id', 'baileys_session%');
  }
}
