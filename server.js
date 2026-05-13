// server.js - Server principale Express + Socket.io
// Gestisce: QR code, API REST, WebSocket real-time, export PDF
'use strict';

const express     = require('express');
const http        = require('http');
const { Server }  = require('socket.io');
const QRCode      = require('qrcode');
const PDFDocument = require('pdfkit');
const cors        = require('cors');
const path        = require('path');

const {
  initDatabase,
  insertMessage,
  getAllMessages,
  getAllMessagesAsc,
  countMessages,
    clearAllMessages,
} = require('./database');

// --- Configurazione server ---
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// Route pagine HTML
// ============================================================
app.get('/',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/send',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'send.html')));
app.get('/messages',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'messages.html')));

// ============================================================
// API REST
// ============================================================

// GET /api/messages - tutti i messaggi
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await getAllMessages();
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nel recupero messaggi' });
  }
});

// POST /api/messages - invia nuovo messaggio
app.post('/api/messages', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Contenuto vuoto' });
    }
    const msg = await insertMessage(content.trim());
    io.emit('new_message', msg);
    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nel salvataggio messaggio' });
  }
});

// GET /api/count - numero totale messaggi
app.get('/api/count', async (req, res) => {
  try {
    const result = await countMessages();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nel conteggio' });
  }
});

// GET /api/qr - genera QR code dell'URL
app.get('/api/qr', async (req, res) => {
  try {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    const qr  = await QRCode.toDataURL(`${url}/send`);
    res.json({ qr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore generazione QR' });
  }
});

// GET /api/messages/pdf - esporta messaggi come PDF
app.get('/api/messages/pdf', async (req, res) => {
  try {
    const messages = await getAllMessagesAsc();
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="messaggi.pdf"');
    doc.pipe(res);
    doc.fontSize(20).text('Messaggi Anonimi', { align: 'center' });
    doc.moveDown();
    messages.forEach((m, i) => {
      const ts = new Date(m.timestamp).toLocaleString('it-IT');
      doc.fontSize(12).text(`${i + 1}. [${ts}]`, { continued: false });
      doc.fontSize(11).text(m.content, { indent: 20 });
      doc.moveDown(0.5);
    });
    doc.end();
    console.log('PDF generato, messaggi:', messages.length);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore generazione PDF' });
  }
});

// ========================================================
// DELETE /api/messages — Svuota tutti i messaggi
// ========================================================
app.delete('/api/messages', async (req, res) => {
  try {
        await clearAllMessages();
    io.emit('messages_cleared');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore eliminazione messaggi' });
  }
});

// ============================================================
// WebSocket: gestione connessioni client
// ============================================================
io.on('connection', socket => {
  console.log('Client connesso:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnesso:', socket.id));
});

// ============================================================
// Avvio server (dopo init database)
// ============================================================
initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server avviato: http://localhost:${PORT}`);
      console.log(`Pagina messaggi: http://localhost:${PORT}/messages`);
      console.log(`Invia messaggi:  http://localhost:${PORT}/send`);
    });
  })
  .catch(err => {
    console.error('Errore inizializzazione database:', err);
    process.exit(1);
  });
