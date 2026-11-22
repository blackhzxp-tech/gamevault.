const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'games.json');
const PORT = Number(process.env.PORT || 3000);
const REFRESH_MS = 6 * 60 * 60 * 1000;

let games = [];
let lastUpdated = null;
let refreshing = false;
let sourceStatus = {};

function decodeEntities(value = '') {
  return String(value)
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function cleanText(value = '') {
  return decodeEntities(String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractImage(block) {
  const enclosure = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosure) return decodeEntities(enclosure[1]);
  const image = block.match(/<img[^>]+src=["']([^"']+)["']/i);
  return image ? decodeEntities(image[1]) : '';
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'GameVault/0.2 (+local game discovery project)', 'Accept': 'application/json' }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'GameVault/0.2 (+local game discovery project)', 'Accept': 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function normalizeFreeToGame(item) {
  return {
    id: `ftg-${item.id}`,
    title: item.title || 'Jogo sem título',
    description: item.short_description || 'Jogo gratuito para PC.',
    image: item.thumbnail || '',
    url: item.game_url || item.freetogame_profile_url || 'https://www.freetogame.com/',
    platform: item.platform || 'PC',
    genre: item.genre || 'Não informado',
    developer: item.developer || '',
    publisher: item.publisher || '',
    category: 'permanent',
    source: 'FreeToGame',
    sourceUrl: 'https://www.freetogame.com/',
    updatedAt: new Date().toISOString()
  };
}

function normalizeGiveaway(item) {
  return {
    id: `gp-${item.id}`,
    title: item.title || 'Oferta sem título',
    description: item.description || 'Confira os detalhes desta oferta gratuita.',
    image: item.thumbnail || item.image || '',
    url: item.open_giveaway_url || item.gamerpower_url || 'https://www.gamerpower.com/',
    platform: item.platforms || 'PC',
    genre: 'Oferta',
    developer: '',
    publisher: '',
    category: 'limited',
    endDate: item.end_date || null,
    source: 'GamerPower',
    sourceUrl: 'https://www.gamerpower.com/',
    updatedAt: new Date().toISOString()
  };
}

function parseItchRss(xml) {
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  return items.map((block, index) => {
    const title = cleanText(tagValue(block, 'title'));
    const link = decodeEntities(cleanText(tagValue(block, 'link')));
    const descriptionRaw = tagValue(block, 'description');
    const description = cleanText(descriptionRaw) || 'Jogo independente gratuito no itch.io.';
    if (!title || !link) return null;
    return {
      id: `itch-${Buffer.from(link).toString('base64url').slice(0, 32)}-${index}`,
      title,
      description: description.slice(0, 500),
      image: extractImage(block),
      url: link,
      platform: 'PC',
      genre: 'Independente',
      developer: '',
      publisher: '',
      category: 'indie',
      source: 'itch.io',
      sourceUrl: 'https://itch.io/games/price-free',
      updatedAt: new Date().toISOString()
    };
  }).filter(Boolean);
}

function deduplicate(list) {
  const map = new Map();
  for (const game of list) {
    const key = game.title.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) map.set(key, game);
    else {
      // Keep the richer card while preserving the fact that multiple sources list it.
      if (!existing.image && game.image) existing.image = game.image;
      if (existing.description.length < 45 && game.description.length > existing.description.length) existing.description = game.description;
      existing.sources = [...new Set([...(existing.sources || [existing.source]), game.source])];
      if (existing.category !== game.category) existing.categories = [...new Set([...(existing.categories || [existing.category]), game.category])];
      existing.links = [...(existing.links || [{ name: existing.source, url: existing.url }]), { name: game.source, url: game.url }];
    }
  }
  return [...map.values()];
}

async function refreshCatalog() {
  if (refreshing) return { skipped: true };
  refreshing = true;
  const collected = [];
  const tasks = [
    ['FreeToGame', async () => (await fetchJson('https://www.freetogame.com/api/games')).map(normalizeFreeToGame)],
    ['GamerPower', async () => {
      const data = await fetchJson('https://www.gamerpower.com/api/giveaways?platform=pc&type=game');
      return Array.isArray(data) ? data.map(normalizeGiveaway) : [];
    }],
    ['itch.io', async () => parseItchRss(await fetchText('https://itch.io/games/price-free.xml'))]
  ];

  try {
    const results = await Promise.allSettled(tasks.map(async ([name, run]) => ({ name, items: await run() })));
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const name = tasks[i][0];
      if (result.status === 'fulfilled') {
        collected.push(...result.value.items);
        sourceStatus[name] = { ok: true, count: result.value.items.length, checkedAt: new Date().toISOString() };
      } else {
        sourceStatus[name] = { ok: false, error: result.reason?.message || 'Falha na consulta', checkedAt: new Date().toISOString() };
      }
    }

    if (collected.length > 0) {
      games = deduplicate(collected);
      lastUpdated = new Date().toISOString();
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify({ lastUpdated, games, sourceStatus }, null, 2));
    } else if (games.length === 0) {
      throw new Error('Nenhuma fonte respondeu com jogos. Confira a conexão e tente novamente.');
    }
    console.log(`[GameVault] Catálogo atualizado: ${games.length} jogos únicos.`);
    return { count: games.length, sourceStatus };
  } finally {
    refreshing = false;
  }
}

function loadSavedCatalog() {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    games = Array.isArray(saved.games) ? saved.games : [];
    lastUpdated = saved.lastUpdated || null;
    sourceStatus = saved.sourceStatus || {};
  } catch { games = []; }
}

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }
  if (url.pathname === '/api/games') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ games, count: games.length, lastUpdated, sourceStatus }));
    return;
  }
  if (url.pathname === '/api/refresh' && req.method === 'POST') {
    try {
      const result = await refreshCatalog();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relative);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

loadSavedCatalog();
server.listen(PORT, () => {
  console.log(`\nGameVault rodando em http://localhost:${PORT}`);
  console.log('Servidor ativo. Em hospedagem, o processo continua online sem depender do seu PC.\n');
  refreshCatalog().catch(error => console.error('[GameVault] Erro na primeira coleta:', error.message));
  setInterval(() => refreshCatalog().catch(error => console.error('[GameVault] Erro na coleta:', error.message)), REFRESH_MS);
});
