const { Telegraf } = require('telegraf');
const { addHashtag, getAllStats } = require('./db');

// Регулярка для поиска хештегов (поддерживает кириллицу, латиницу, цифры, подчёркивание)
const HASHTAG_REGEX = /#[\p{L}\p{N}_]+/gu;

function extractHashtags(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(HASHTAG_REGEX) || [];
  return [...new Set(matches.map(m => m.slice(1)))]; // убираем #
}

function createBot(token, onStatsUpdate) {
  const bot = new Telegraf(token);

  const processMessage = (ctx, isChannelPost = false) => {
    const message = isChannelPost ? ctx.channelPost : ctx.message;
    if (!message) return;

    const texts = [];
    if (message.text) texts.push(message.text);
    if (message.caption) texts.push(message.caption);

    const foundTags = [];
    for (const text of texts) {
      const tags = extractHashtags(text);
      tags.forEach(tag => {
        addHashtag(tag);
        foundTags.push(tag);
      });
    }

    if (foundTags.length > 0 && typeof onStatsUpdate === 'function') {
      onStatsUpdate(getAllStats());
    }
  };

  // Сообщения в группах/чатах
  bot.on('text', (ctx) => processMessage(ctx, false));

  // Посты в канале (бот должен быть админом канала!)
  bot.on('channel_post', (ctx) => processMessage(ctx, true));

  // Редактированные сообщения
  bot.on('edited_message', (ctx) => processMessage(ctx, false));
  bot.on('edited_channel_post', (ctx) => processMessage(ctx, true));

  return bot;
}

module.exports = { createBot, extractHashtags, getAllStats };
