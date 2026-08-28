"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.waQrCode = exports.waStatus = exports.waSocket = void 0;
exports.setupWhatsAppConnection = setupWhatsAppConnection;
exports.logoutWhatsApp = logoutWhatsApp;
const baileys_1 = require("@whiskeysockets/baileys");
const pino_1 = __importDefault(require("pino"));
const QRCode = __importStar(require("qrcode"));
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
const supabaseAuthState_1 = require("./supabaseAuthState");
dotenv.config();
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});
// Estado global do WhatsApp
exports.waSocket = null;
exports.waStatus = 'disconnected';
exports.waQrCode = null;
async function setupWhatsAppConnection() {
    exports.waStatus = 'connecting';
    const { state, saveCreds } = await (0, supabaseAuthState_1.useSupabaseAuthState)(supabase, 'baileys_session');
    exports.waSocket = (0, baileys_1.makeWASocket)({
        auth: state,
        printQRInTerminal: true,
        browser: baileys_1.Browsers.macOS('Desktop'),
        syncFullHistory: false,
        logger: (0, pino_1.default)({ level: 'silent' })
    });
    exports.waSocket.ev.on('creds.update', saveCreds);
    exports.waSocket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            exports.waStatus = 'waiting_qr';
            // Converte o QR Code para base64 image data url para o frontend
            exports.waQrCode = await QRCode.toDataURL(qr);
            console.log('[WhatsApp] QR Code gerado. Aguardando leitura...');
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== baileys_1.DisconnectReason.loggedOut;
            console.log('[WhatsApp] Conexão fechada. Reconectar:', shouldReconnect);
            exports.waStatus = 'disconnected';
            exports.waQrCode = null;
            if (shouldReconnect) {
                exports.waStatus = 'connecting';
                setupWhatsAppConnection();
            }
            else {
                // Usuário deslogou (ou sessão expirou). Remover a sessão do banco.
                await supabase.from('whatsapp_auth').delete().like('id', 'baileys_session%');
                exports.waStatus = 'logged_out';
            }
        }
        else if (connection === 'open') {
            console.log('[WhatsApp] 🟢 Conectado ao WhatsApp com sucesso!');
            exports.waStatus = 'connected';
            exports.waQrCode = null;
        }
    });
    exports.waSocket.ev.on('messages.upsert', async (m) => {
        // Para logs ou respostas no futuro
    });
}
async function logoutWhatsApp() {
    if (exports.waSocket) {
        exports.waSocket.logout();
        exports.waSocket = null;
        exports.waStatus = 'disconnected';
        exports.waQrCode = null;
        await supabase.from('whatsapp_auth').delete().like('id', 'baileys_session%');
    }
}
