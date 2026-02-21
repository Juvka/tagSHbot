const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'tags.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    return { hashtags: {} };
  }
}

function save(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function addHashtag(tag) {
  const normalized = tag.toLowerCase().trim();
  if (!normalized) return;

  const data = load();
  const now = Math.floor(Date.now() / 1000);
  if (!data.hashtags[normalized]) {
    data.hashtags[normalized] = { count: 0, last_seen: 0, first_seen: now };
  }
  data.hashtags[normalized].count++;
  data.hashtags[normalized].last_seen = now;
  if (!data.hashtags[normalized].first_seen) {
    data.hashtags[normalized].first_seen = now;
  }
  save(data);
  return normalized;
}

function getAllStats() {
  const data = load();
  return Object.entries(data.hashtags)
    .map(([tag, { count, last_seen, first_seen }]) => ({
      tag, count, last_seen,
      first_seen: first_seen || last_seen
    }))
    .sort((a, b) => b.count - a.count);
}

function getTotalMessages() {
  const data = load();
  return Object.values(data.hashtags).reduce((sum, { count }) => sum + count, 0);
}

module.exports = { addHashtag, getAllStats, getTotalMessages };
