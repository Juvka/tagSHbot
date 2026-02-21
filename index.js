require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createBot, getAllStats } = require('./bot');
const { getTotalMessages } = require('./db');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

function parseChannel(value) {
  if (!value || typeof value !== 'string') return '';
  const s = value.trim();
  if (/^https?:\/\/(www\.)?(t\.me|telegram\.me|telegram\.dog)\//i.test(s)) {
    return s.replace(/^https?:\/\/(www\.)?/i, 'https://');
  }
  const m = s.match(/t\.me\/(?:s\/)?(\+?[a-zA-Z0-9_]+)/i) ||
            s.match(/(?:telegram\.me|telegram\.dog)\/(\+?[a-zA-Z0-9_]+)/i) ||
            s.match(/^@?(\+?[a-zA-Z0-9_]+)$/);
  return m ? `https://t.me/${m[1].replace(/^@/, '')}` : (s.match(/^@?(\S+)$/) ? `https://t.me/${s.replace(/^@/, '')}` : '');
}

const CHANNEL = parseChannel(process.env.CHANNEL_USERNAME || process.env.CHANNEL_LINK || '');

if (!BOT_TOKEN) {
  console.error('❌ Укажите BOT_TOKEN в файле .env (скопируйте .env.example)');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/stats', (req, res) => {
  const stats = getAllStats();
  const total = getTotalMessages();
  res.json({ tags: stats, total, channel: CHANNEL });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function broadcastStats() {
  const stats = getAllStats();
  const total = getTotalMessages();
  io.emit('stats', { tags: stats, total, channel: CHANNEL });
}

const bot = createBot(BOT_TOKEN, broadcastStats);

bot.launch().then(() => {
  console.log('✅ Telegram бот запущен');
}).catch(err => {
  console.error('❌ Ошибка запуска бота:', err.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`🌐 Веб-статистика: http://localhost:${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
