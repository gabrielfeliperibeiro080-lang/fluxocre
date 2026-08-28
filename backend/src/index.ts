import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupWhatsAppConnection } from './whatsapp/connection';
import { startWorker } from './whatsapp/worker';
import apiRoutes from './api/routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Rota de saúde para o cron-job.org (Impede o servidor de dormir)
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Rotas da API
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    // 1. Iniciar conexão com WhatsApp
    await setupWhatsAppConnection();

    // 2. Iniciar Worker que verifica mensagens pendentes
    startWorker();

    app.listen(PORT, () => {
      console.log(`[Backend] Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('[Backend] Erro ao iniciar servidor:', error);
  }
}

startServer();
