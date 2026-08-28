import { Router } from 'express';
import { waStatus, waQrCode, logoutWhatsApp, setupWhatsAppConnection } from '../whatsapp/connection';

const router = Router();

// Retorna o status atual do WhatsApp
router.get('/whatsapp/status', (req, res) => {
  res.json({
    status: waStatus,
    qrCode: waQrCode
  });
});

// Forçar reconexão ou obter novo QR
router.post('/whatsapp/connect', async (req, res) => {
  if (waStatus === 'disconnected' || waStatus === 'logged_out' || waStatus === 'error') {
    await setupWhatsAppConnection();
  }
  res.json({ success: true, status: waStatus });
});

// Desconectar / Fazer logout
router.post('/whatsapp/logout', async (req, res) => {
  await logoutWhatsApp();
  res.json({ success: true, status: waStatus });
});

export default router;
