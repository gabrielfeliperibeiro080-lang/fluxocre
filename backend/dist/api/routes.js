"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../whatsapp/connection");
const router = (0, express_1.Router)();
// Retorna o status atual do WhatsApp
router.get('/whatsapp/status', (req, res) => {
    res.json({
        status: connection_1.waStatus,
        qrCode: connection_1.waQrCode
    });
});
// Forçar reconexão ou obter novo QR
router.post('/whatsapp/connect', async (req, res) => {
    if (connection_1.waStatus === 'disconnected' || connection_1.waStatus === 'logged_out' || connection_1.waStatus === 'error') {
        await (0, connection_1.setupWhatsAppConnection)();
    }
    res.json({ success: true, status: connection_1.waStatus });
});
// Desconectar / Fazer logout
router.post('/whatsapp/logout', async (req, res) => {
    await (0, connection_1.logoutWhatsApp)();
    res.json({ success: true, status: connection_1.waStatus });
});
exports.default = router;
