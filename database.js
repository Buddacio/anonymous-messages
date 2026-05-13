// database.js - Gestione database con sql.js (SQLite puro JavaScript)
// Compatibile con tutti gli ambienti incluso Render, StackBlitz.
// I dati sono mantenuti in memoria; per persistenza su disco usa fs.
const initSqlJs = require('sql.js');
const fs         = require('fs');
const path       = require('path');

const DB_PATH = path.join(__dirname, 'messages.db');
let db; // istanza database (inizializzata in modo asincrono)

// Serializza il DB su file (chiamata dopo ogni scrittura)
function saveToDisk() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch(e) { /* ignora errori di scrittura in ambienti read-only */ }
}

// Inizializza il database e crea la tabella se non esiste
async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: file => path.join(path.dirname(require.resolve('sql.js')), file)
  });
  if (fs.existsSync(DB_PATH)) {
    // Carica il DB esistente dal file
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    // Crea un nuovo DB vuoto
    db = new SQL.Database();
  }
  // Crea tabella se non esiste
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      content   TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  saveToDisk();
  console.log('Database SQLite inizializzato con sql.js');
}

// Converte il risultato di db.exec() in array di oggetti
function rowsToObjects(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((c, i) => [c, row[i]]))
  );
}

// Inserisce un messaggio e restituisce l'oggetto inserito
function insertMessage(content) {
  db.run('INSERT INTO messages (content) VALUES (?)', [content]);
  const res = db.exec('SELECT * FROM messages ORDER BY id DESC LIMIT 1');
  const msg = rowsToObjects(res)[0];
  saveToDisk();
  return msg;
}

// Tutti i messaggi (piu recente prima)
function getAllMessages() {
  return rowsToObjects(db.exec('SELECT * FROM messages ORDER BY timestamp DESC'));
}

// Tutti i messaggi in ordine cronologico (per PDF)
function getAllMessagesAsc() {
  return rowsToObjects(db.exec('SELECT * FROM messages ORDER BY timestamp ASC'));
}

// Conta il totale dei messaggi
function countMessages() {
  const res = db.exec('SELECT COUNT(*) as total FROM messages');
  return { total: res[0] ? res[0].values[0][0] : 0 };
}

module.exports = { initDatabase, insertMessage, getAllMessages, getAllMessagesAsc, countMessages };