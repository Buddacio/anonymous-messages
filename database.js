// database.js - Gestione database SQLite
// SQLite non richiede un server separato: il DB e' un singolo file locale.
const Database = require('better-sqlite3');
const path = require('path');

// Percorso del file database (creato automaticamente se non esiste)
const DB_PATH = path.join(__dirname, 'messages.db');
const db = new Database(DB_PATH);

// Crea la tabella messaggi se non esiste
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      content   TEXT    NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Database inizializzato.');
}

// Inserisce un messaggio e restituisce il record completo
function insertMessage(content) {
  const stmt = db.prepare('INSERT INTO messages (content) VALUES (?)');
  const result = stmt.run(content);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
}

// Tutti i messaggi (piu recente prima)
function getAllMessages() {
  return db.prepare('SELECT * FROM messages ORDER BY timestamp DESC').all();
}

// Tutti i messaggi in ordine cronologico (per il PDF)
function getAllMessagesAsc() {
  return db.prepare('SELECT * FROM messages ORDER BY timestamp ASC').all();
}

// Conta il totale dei messaggi
function countMessages() {
  return db.prepare('SELECT COUNT(*) as total FROM messages').get();
}

module.exports = { initDatabase, insertMessage, getAllMessages, getAllMessagesAsc, countMessages };