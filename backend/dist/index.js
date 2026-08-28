"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const connection_1 = require("./whatsapp/connection");
const worker_1 = require("./whatsapp/worker");
const routes_1 = __importDefault(require("./api/routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Rota de saúde para o cron-job.org (Impede o servidor de dormir)
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});
// Rotas da API
app.use('/api', routes_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
async function startServer() {
    try {
        // 1. Iniciar conexão com WhatsApp
        await (0, connection_1.setupWhatsAppConnection)();
        // 2. Iniciar Worker que verifica mensagens pendentes
        (0, worker_1.startWorker)();
        app.listen(PORT, () => {
            console.log(`[Backend] Servidor rodando na porta ${PORT}`);
        });
    }
    catch (error) {
        console.error('[Backend] Erro ao iniciar servidor:', error);
    }
}
startServer();
