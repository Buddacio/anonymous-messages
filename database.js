// database.js - PostgreSQL via Render
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id        SERIAL PRIMARY KEY,
      content   TEXT NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Database PostgreSQL inizializzato');
}

async function insertMessage(content) {
  const res = await pool.query(
    'INSERT INTO messages (content) VALUES ($1) RETURNING *',
    [content]
  );
  return res.rows[0];
}

async function getAllMessages() {
  const res = await pool.query('SELECT * FROM messages ORDER BY timestamp DESC');
  return res.rows;
}

async function getAllMessagesAsc() {
  const res = await pool.query('SELECT * FROM messages ORDER BY timestamp ASC');
  return res.rows;
}

async function countMessages() {
  const res = await pool.query('SELECT COUNT(*) as total FROM messages');
  return { total: parseInt(res.rows[0].total, 10) };
}

async function clearAllMessages() {
  await pool.query('DELETE FROM messages');
}

async function deleteMessage(id) {
  const res = await pool.query('DELETE FROM messages WHERE id = $1 RETURNING *', [id]);
  return res.rows[0];
}

module.exports = {
  initDatabase,
  insertMessage,
  getAllMessages,
  getAllMessagesAsc,
  countMessages,
  clearAllMessages,
  deleteMessage
};
