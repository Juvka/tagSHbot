const socket = io();

// Переключение темы
const STORAGE_KEY = 'tagbot-theme';

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') {
    root.removeAttribute('data-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY) || 'light';
  applyTheme(saved);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem(STORAGE_KEY) === 'auto') applyTheme('auto');
  });
}

initTheme();

const totalTagsEl = document.getElementById('totalTags');
const uniqueTagsEl = document.getElementById('uniqueTags');
const topTagEl = document.getElementById('topTag');
const tagsTbody = document.getElementById('tagsList');
const emptyRowEl = document.getElementById('emptyState');

let rawTags = [];
let rawTotal = 0;
let channelUsername = '';
let sortMode = 'popular';
let searchQuery = '';
let pageSize = 50;
let currentPage = 1;

function formatLastSeen(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  const now = Date.now();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatFreqPerDay(count, firstSeen) {
  if (!firstSeen || count === 0) return '—';
  const days = Math.max(1, Math.floor((Date.now() / 1000 - firstSeen) / 86400));
  const freq = count / days;
  return freq >= 1 ? freq.toFixed(1) : freq.toFixed(2);
}

function getTelegramUrl(tag) {
  if (!channelUsername) return null;
  const base = channelUsername.startsWith('http') ? channelUsername : `https://t.me/${channelUsername.replace(/^@/, '')}`;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}q=%23${encodeURIComponent(tag)}`;
}

function getFilteredTags() {
  let tags = [...rawTags];
  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    tags = tags.filter(t => t.tag.toLowerCase().includes(q));
  }
  if (sortMode === 'popular') {
    tags.sort((a, b) => b.count - a.count);
  } else if (sortMode === 'rare') {
    tags.sort((a, b) => a.count - b.count);
  } else if (sortMode === 'name') {
    tags.sort((a, b) => a.tag.localeCompare(b.tag));
  }
  return tags;
}

function renderTagsList() {
  const tags = getFilteredTags();
  const totalPages = Math.max(1, Math.ceil(tags.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageTags = tags.slice(start, start + pageSize);

  topTagEl.textContent = rawTags.length ? rawTags[0].tag : '—';

  tagsTbody.querySelectorAll('tr:not(#emptyState)').forEach(el => el.remove());

  if (rawTags.length === 0) {
    emptyRowEl.classList.remove('hidden');
    emptyRowEl.querySelector('td').textContent = 'Нет данных. Отправьте сообщения с хештегами в канал.';
    emptyRowEl.querySelector('td').colSpan = 7;
    document.getElementById('paginationWrap').classList.add('hidden');
    return;
  }

  if (tags.length === 0) {
    emptyRowEl.classList.remove('hidden');
    emptyRowEl.querySelector('td').textContent = `По запросу «${searchQuery}» ничего не найдено`;
    emptyRowEl.querySelector('td').colSpan = 7;
    document.getElementById('paginationWrap').classList.add('hidden');
    return;
  }

  emptyRowEl.classList.add('hidden');
  document.getElementById('paginationWrap').classList.remove('hidden');

  pageTags.forEach((tag, idx) => {
    const i = start + idx;
    const rankClass = sortMode === 'popular' && i < 3 ? `rank-${i + 1}` : '';
    const percent = rawTotal ? ((tag.count / rawTotal) * 100).toFixed(1) : 0;
    const lastSeen = formatLastSeen(tag.last_seen);
    const freq = formatFreqPerDay(tag.count, tag.first_seen);
    const tgUrl = getTelegramUrl(tag.tag);
    const linkCell = tgUrl
      ? `<a href="${tgUrl}" target="_blank" rel="noopener" class="tag-link" title="Открыть канал в Telegram" aria-label="Открыть канал в Telegram">↗</a>`
      : '<span class="tag-link-empty" title="Укажите CHANNEL_USERNAME в .env">—</span>';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-rank"><span class="tag-rank ${rankClass}">${i + 1}</span></td>
      <td><span class="tag-name">${escapeHtml(tag.tag)}</span></td>
      <td class="col-count tag-count">${tag.count}</td>
      <td class="col-share tag-share">${percent}%</td>
      <td class="col-freq tag-freq">${freq}</td>
      <td class="col-last tag-last">${escapeHtml(lastSeen)}</td>
      <td class="col-link">${linkCell}</td>
    `;
    tagsTbody.appendChild(tr);
  });

  // Pagination UI
  const infoEl = document.getElementById('paginationInfo');
  infoEl.textContent = `${start + 1}–${Math.min(start + pageSize, tags.length)} из ${tags.length}`;

  const prevBtn = document.getElementById('pagePrev');
  const nextBtn = document.getElementById('pageNext');
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  const pagesEl = document.getElementById('paginationPages');
  pagesEl.textContent = `${currentPage} / ${totalPages}`;
}

function renderStats(data) {
  const { tags, total, channel } = data;
  rawTags = tags;
  rawTotal = total;
  if (channel !== undefined) channelUsername = channel || '';

  totalTagsEl.textContent = total.toLocaleString('ru-RU');
  uniqueTagsEl.textContent = tags.length.toLocaleString('ru-RU');

  renderTagsList();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Фильтрация и сортировка
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sortMode = btn.dataset.sort;
    renderTagsList();
  });
});

document.getElementById('tagSearch').addEventListener('input', (e) => {
  searchQuery = e.target.value;
  currentPage = 1;
  renderTagsList();
});

document.getElementById('pageSize').addEventListener('change', (e) => {
  pageSize = parseInt(e.target.value, 10);
  currentPage = 1;
  renderTagsList();
});

document.getElementById('pagePrev').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderTagsList();
  }
});

document.getElementById('pageNext').addEventListener('click', () => {
  const tags = getFilteredTags();
  const totalPages = Math.ceil(tags.length / pageSize);
  if (currentPage < totalPages) {
    currentPage++;
    renderTagsList();
  }
});

// Начальная загрузка
fetch('/api/stats')
  .then(r => r.json())
  .then(renderStats)
  .catch(() => {});

// Real-time обновления
socket.on('stats', renderStats);
