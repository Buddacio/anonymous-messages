// server.js - Server principale Express + Socket.io
// Gestisce: QR code generato dinamicamente, API REST, WebSocket real-time, export PDF
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
  countMessages
} = require('./database');

// --- Configurazione server ---
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());          // parsing body JSON
app.use(express.static(path.join(__dirname, 'public')));  // file statici

// Inizializza il database SQLite all'avvio
initDatabase().catch(console.error);

// ====================================================
// ROUTE: Pagine HTML
// ====================================================
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/send', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'send.html')));

app.get('/messages', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'messages.html')));

// ====================================================
// API: Genera QR code come base64 PNG
// GET /api/qrcode
// ====================================================
app.get('/api/qrcode', async (req, res) => {
  try {
    // Costruisce l'URL della pagina /send (quello che il QR puntera')
    const sendUrl = req.protocol + '://' + req.get('host') + '/send';
    const qr = await QRCode.toDataURL(sendUrl, {
      width: 300, margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    });
    res.json({ success: true, qrCode: qr, sendUrl });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Errore generazione QR' });
  }
});

// ====================================================
// API: Invia un messaggio anonimo
// POST /api/messages  body: { content: 'testo' }
// ====================================================
app.post('/api/messages', (req, res) => {
  const { content } = req.body;

  // Validazione
  if (!content || content.trim().length === 0)
    return res.status(400).json({ success: false, error: 'Messaggio vuoto.' });
  if (content.trim().length > 1000)
    return res.status(400).json({ success: false, error: 'Massimo 1000 caratteri.' });

  // Salva nel DB e notifica tutti i client connessi via WebSocket
  const msg = insertMessage(content.trim());
  io.emit('new_message', msg);   // aggiornamento real-time
  console.log('Nuovo messaggio ricevuto, ID:', msg.id);

  res.status(201).json({ success: true, message: msg });
});

// ====================================================
// API: Leggi tutti i messaggi (per caricamento iniziale)
// GET /api/messages
// ====================================================
app.get('/api/messages', (req, res) => {
  const messages = getAllMessages();
  const { total } = countMessages();
  res.json({ success: true, total, messages });
});

// ====================================================
// API: Scarica tutti i messaggi come PDF
// GET /api/messages/pdf
// ====================================================
app.get('/api/messages/pdf', (req, res) => {
  const messages = getAllMessagesAsc();  // ordine cronologico

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=messaggi_anonimi.pdf');

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 60, left: 60, right: 60 }
  });
  doc.pipe(res);

  // Intestazione
  doc.fontSize(22).fillColor('#1a1a2e').text('Messaggi Anonimi', { align: 'center' });
  doc.fontSize(10).fillColor('#666')
     .text('Esportato: ' + new Date().toLocaleString('it-IT') + '  |  Tot: ' + messages.length,
           { align: 'center' });
  doc.moveTo(60, doc.y + 6).lineTo(535, doc.y + 6).strokeColor('#ccc').stroke();
  doc.moveDown(1);

  if (messages.length === 0) {
    doc.fontSize(12).fillColor('#999').text('Nessun messaggio.', { align: 'center' });
  } else {
    messages.forEach((m, i) => {
      if (doc.y > 700) doc.addPage();
      const d = new Date(m.timestamp).toLocaleString('it-IT');
      doc.fontSize(8).fillColor('#999').text('#' + (i + 1) + '  ' + d);
      doc.fontSize(11).fillColor('#222').text(m.content, { indent: 10, width: 475 });
      doc.moveTo(60, doc.y + 3).lineTo(535, doc.y + 3)
         .strokeColor('#eee').lineWidth(0.5).stroke();
      doc.moveDown(0.7);
    });
  }
  doc.end();
  console.log('PDF generato, messaggi:', messages.length);
});

// ====================================================
// WebSocket: gestione connessioni client
// ====================================================
io.on('connection', socket => {
  console.log('Client connesso:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnesso:', socket.id));
});

// ====================================================
// Avvio server
// ====================================================
server.listen(PORT, () => {
  console.log('Server avviato: http://localhost:' + PORT);
  console.log('Pagina messaggi: http://localhost:' + PORT + '/messages');
  console.log('Invia messaggi:  http://localhost:' + PORT + '/send');
});