// server.js - Server principale Express + Socket.io
// Gestisce: QR code, API REST, WebSocket real-time, export PDF
'use strict';

const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const QRCode       = require('qrcode');
const PDFDocument  = require('pdfkit');
const cors         = require('cors');
const path         = require('path');

const {
  initDatabase,
  insertMessage,
  getAllMessages,
  getAllMessagesAsc,
  countMessages,
  clearAllMessages,
  deleteMessage,
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

// =============================================
// === ROUTES HTML ===
// =============================================
app.get('/',         (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/send',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'send.html')));
app.get('/messages', (req, res) => res.sendFile(path.join(__dirname, 'public', 'messages.html')));

// =============================================
// === API REST ===
// =============================================

// GET tutti i messaggi
app.get('/api/messages', async (req, res) => {
  try {
    const msgs = await getAllMessages();
    res.json(msgs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore recupero messaggi' });
  }
});

// POST nuovo messaggio
app.post('/api/messages', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Contenuto obbligatorio' });
    }
    const msg = await insertMessage(content.trim());
    io.emit('new_message', msg);
    res.json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore inserimento messaggio' });
  }
});

// GET conteggio messaggi
app.get('/api/count', async (req, res) => {
  try {
    const count = await countMessages();
    res.json(count);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore conteggio' });
  }
});

// GET QR code
app.get('/api/qr', async (req, res) => {
  try {
    const host = req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const url = `${protocol}://${host}/send`;
    const qr = await QRCode.toDataURL(url);
    res.json({ qr, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore generazione QR' });
  }
});

// GET export PDF
app.get('/api/messages/pdf', async (req, res) => {
  try {
    const msgs = await getAllMessagesAsc();
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="messaggi-anonimi.pdf"');
    doc.pipe(res);
    doc.fontSize(20).text('Messaggi Anonimi', { align: 'center' });
    doc.moveDown();
    if (msgs.length === 0) {
      doc.fontSize(12).text('Nessun messaggio presente.', { align: 'center' });
    } else {
      msgs.forEach((m, i) => {
        const ts = new Date(m.timestamp).toLocaleString('it-IT');
        doc.fontSize(10).fillColor('#888').text(`#${i + 1} - ${ts}`);
        doc.fontSize(13).fillColor('#000').text(m.content);
        doc.moveDown(0.5);
        if (i < msgs.length - 1) doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#ddd').moveDown(0.5);
      });
    }
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore generazione PDF' });
  }
});

// DELETE singolo messaggio per ID
app.delete('/api/messages/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
    const deleted = await deleteMessage(id);
    if (!deleted) return res.status(404).json({ error: 'Messaggio non trovato' });
    io.emit('message_deleted', { id });
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

// DELETE tutti i messaggi
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

// =============================================
// === SOCKET.IO ===
// =============================================
io.on('connection', socket => {
  console.log('Client connesso:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnesso:', socket.id));
});

// =============================================
// === START SERVER ===
// =============================================
initDatabase().then(() => {
  server.listen(PORT, () => console.log(`Server avviato: http://localhost:${PORT}`));
}).catch(err => {
  console.error('Errore inizializzazione DB:', err);
  process.exit(1);
});
