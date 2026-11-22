const grid = document.querySelector('#games-grid');
const statusBox = document.querySelector('#status');
const countBox = document.querySelector('#game-count');
const searchInput = document.querySelector('#search-input');
const platformFilter = document.querySelector('#platform-filter');
const sortFilter = document.querySelector('#sort-filter');
const categoryFilter = document.querySelector('#category-filter');
const refreshButton = document.querySelector('#refresh-button');
const emptyState = document.querySelector('#empty-state');

let allGames = [];
let lastUpdated = null;

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

function categoryLabel(category) {
  return ({ permanent: 'GRÁTIS PARA SEMPRE', limited: 'TEMPO LIMITADO', indie: 'INDEPENDENTE' })[category] || 'GRÁTIS';
}

function matchesPlatform(game, selected) {
  if (selected === 'all') return true;
  const text = `${game.platform || ''} ${(game.sources || [game.source]).join(' ')}`.toLowerCase();
  return text.includes(selected);
}

function renderGames() {
  const query = searchInput.value.trim().toLocaleLowerCase('pt-BR');
  const selectedPlatform = platformFilter.value;
  const selectedCategory = categoryFilter.value;
  let filtered = allGames.filter(game => {
    const haystack = `${game.title} ${game.description} ${game.genre} ${game.developer} ${game.publisher}`.toLocaleLowerCase('pt-BR');
    const matchesSearch = haystack.includes(query);
    const categories = game.categories || [game.category];
    const matchesCategory = selectedCategory === 'all' || categories.includes(selectedCategory);
    return matchesSearch && matchesCategory && matchesPlatform(game, selectedPlatform);
  });

  if (sortFilter.value === 'az') filtered.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  else if (sortFilter.value === 'popular') filtered.sort((a, b) => (a.source === 'FreeToGame' ? -1 : 0) - (b.source === 'FreeToGame' ? -1 : 0));
  else filtered.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  countBox.textContent = filtered.length.toLocaleString('pt-BR');
  grid.innerHTML = '';
  emptyState.hidden = filtered.length !== 0;

  for (const game of filtered) {
    const title = escapeHTML(game.title || 'Jogo sem título');
    const description = escapeHTML(game.description || 'Jogo gratuito. Consulte a página oficial para mais informações.');
    const image = escapeHTML(game.image || '');
    const source = escapeHTML(game.source || 'GameVault');
    const genre = escapeHTML(game.genre || 'PC');
    const link = escapeHTML(game.url || '#');
    const card = document.createElement('article');
    card.className = 'game-card';
    card.innerHTML = `
      <div class="game-image-wrap">
        ${image ? `<img class="game-image" src="${image}" alt="${title}" loading="lazy" onerror="this.style.display='none'">` : '<div class="game-image-placeholder">GAMEVAULT</div>'}
        <span class="platform-pill">${source}</span>
      </div>
      <div class="game-content">
        <h3 title="${title}">${title}</h3>
        <p>${description}</p>
        <div class="game-meta-line"><span>${genre}</span><span class="free-label">● ${categoryLabel(game.category)}</span></div>
        <div class="game-bottom"><span class="source-label">${source}</span><a class="details-link" href="${link}" target="_blank" rel="noopener noreferrer">ACESSAR JOGO ↗</a></div>
      </div>`;
    grid.appendChild(card);
  }
}

async function loadGames({ refresh = false } = {}) {
  refreshButton.disabled = true;
  statusBox.className = 'status';
  statusBox.innerHTML = '<span class="loader"></span> Atualizando o catálogo de jogos...';
  try {
    if (refresh) {
      const refreshResponse = await fetch('/api/refresh', { method: 'POST' });
      if (!refreshResponse.ok) {
        const problem = await refreshResponse.json().catch(() => ({}));
        throw new Error(problem.error || 'Não foi possível atualizar as fontes agora.');
      }
    }
    const response = await fetch('/api/games', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Servidor respondeu ${response.status}.`);
    const data = await response.json();
    allGames = Array.isArray(data.games) ? data.games : [];
    lastUpdated = data.lastUpdated;
    renderGames();
    const goodSources = Object.entries(data.sourceStatus || {}).filter(([, state]) => state.ok).map(([name]) => name);
    const failedSources = Object.entries(data.sourceStatus || {}).filter(([, state]) => !state.ok).map(([name]) => name);
    const time = lastUpdated ? new Date(lastUpdated).toLocaleString('pt-BR') : 'aguardando primeira coleta';
    statusBox.textContent = `${allGames.length} jogos no catálogo • Fontes ativas: ${goodSources.join(', ') || 'nenhuma'} • Atualizado: ${time}${failedSources.length ? ` • Falha: ${failedSources.join(', ')}` : ''}`;
  } catch (error) {
    console.error(error);
    statusBox.className = 'status error';
    statusBox.textContent = `${error.message} Abra o GameVault pelo endereço http://localhost:3000 usando start.bat.`;
    countBox.textContent = '—';
  } finally {
    refreshButton.disabled = false;
  }
}

searchInput.addEventListener('input', renderGames);
platformFilter.addEventListener('change', renderGames);
categoryFilter.addEventListener('change', renderGames);
sortFilter.addEventListener('change', renderGames);
refreshButton.addEventListener('click', () => loadGames({ refresh: true }));
loadGames();

// Promoções: consulta sob demanda para respeitar a política de uso da CheapShark.
const navButtons = [...document.querySelectorAll('[data-view]')];
const panels = [...document.querySelectorAll('[data-panel]')];
const dealsGrid = document.querySelector('#deals-grid');
const dealsStatus = document.querySelector('#deals-status');
const dealsSearch = document.querySelector('#deals-search');
const dealsStore = document.querySelector('#deals-store');
const dealsSort = document.querySelector('#deals-sort');
const dealsRefresh = document.querySelector('#deals-refresh');
const dealsEmpty = document.querySelector('#deals-empty');
let allDeals = [];
let dealsLoaded = false;
let dealStoreNames = new Map();

function showView(view) {
  panels.forEach(panel => { panel.hidden = panel.dataset.panel !== view; });
  navButtons.forEach(button => button.classList.toggle('active', button.dataset.view === view));
  const cta = document.querySelector('#top-cta');
  cta.href = view === 'promocoes' ? '#promocoes' : '#catalogo';
  cta.innerHTML = view === 'promocoes' ? 'Ver promoções <span>↗</span>' : 'Ver jogos <span>↗</span>';
  if (view === 'promocoes' && !dealsLoaded) loadDeals();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
navButtons.forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));

function dealStoreKey(name = '') {
  const normalized = name.toLowerCase();
  if (normalized.includes('steam')) return 'steam';
  if (normalized.includes('epic')) return 'epic';
  return '';
}

// Os dados de preço vêm da CheapShark, mas os botões levam às lojas oficiais.
function officialStoreUrl(deal) {
  const title = String(deal.title || '').trim();
  const query = encodeURIComponent(title);
  const store = dealStoreKey(deal.storeName);

  if (store === 'steam') {
    // Quando a API fornece o App ID da Steam, abre a página exata do jogo.
    const appId = String(deal.steamAppID || '').trim();
    if (/^\d+$/.test(appId)) {
      return `https://store.steampowered.com/app/${appId}/`;
    }
    return `https://store.steampowered.com/search/?term=${query}`;
  }

  if (store === 'epic') {
    // A Epic não fornece um slug confiável nesse resultado; usa a busca oficial.
    return `https://store.epicgames.com/pt-BR/browse?q=${query}`;
  }

  return '#';
}

async function loadDeals() {
  dealsRefresh.disabled = true;
  dealsStatus.className = 'status';
  dealsStatus.innerHTML = '<span class="loader"></span> Consultando ofertas da Steam e Epic Games...';
  try {
    const storesResponse = await fetch('https://www.cheapshark.com/api/1.0/stores', { cache: 'no-store' });
    if (!storesResponse.ok) throw new Error(`A lista de lojas respondeu ${storesResponse.status}.`);
    const stores = await storesResponse.json();
    const wanted = stores.filter(store => (store.isActive === true || store.isActive === 1 || store.isActive === '1') && dealStoreKey(store.storeName));
    dealStoreNames = new Map(wanted.map(store => [String(store.storeID), store.storeName]));
    const ids = wanted.map(store => store.storeID);
    if (!ids.length) throw new Error('A fonte de promoções não retornou Steam ou Epic Games neste momento.');
    const requests = ids.map(async id => {
      const params = new URLSearchParams({ storeID: String(id), onSale: '1', pageSize: '60', sortBy: 'Savings', desc: '1' });
      const response = await fetch(`https://www.cheapshark.com/api/1.0/deals?${params}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Falha ao consultar uma loja (${response.status}).`);
      return response.json();
    });
    const results = await Promise.allSettled(requests);
    allDeals = results.flatMap((result, index) => result.status === 'fulfilled'
      ? result.value.map(deal => ({ ...deal, storeName: dealStoreNames.get(String(deal.storeID)) || wanted[index].storeName }))
      : []);
    if (!allDeals.length) throw new Error('Nenhuma promoção foi retornada. Tente novamente mais tarde.');
    dealsLoaded = true;
    renderDeals();
    const failed = results.some(result => result.status === 'rejected');
    dealsStatus.textContent = `${allDeals.length} ofertas encontradas • Valores em dólar (USD) • ${new Date().toLocaleString('pt-BR')}${failed ? ' • Uma das lojas não respondeu' : ''}`;
  } catch (error) {
    dealsStatus.className = 'status error';
    dealsStatus.textContent = `${error.message} A lista de ofertas depende da disponibilidade da CheapShark.`;
    dealsGrid.innerHTML = '';
    dealsEmpty.hidden = true;
  } finally {
    dealsRefresh.disabled = false;
  }
}

function renderDeals() {
  const query = dealsSearch.value.trim().toLocaleLowerCase('pt-BR');
  const selectedStore = dealsStore.value;
  let filtered = allDeals.filter(deal => {
    const key = dealStoreKey(deal.storeName);
    return (selectedStore === 'all' || selectedStore === key) && String(deal.title || '').toLocaleLowerCase('pt-BR').includes(query);
  });
  if (dealsSort.value === 'price') filtered.sort((a, b) => Number(a.salePrice) - Number(b.salePrice));
  else if (dealsSort.value === 'recent') filtered.sort((a, b) => Number(b.lastChange) - Number(a.lastChange));
  else filtered.sort((a, b) => Number(b.savings) - Number(a.savings));
  dealsGrid.innerHTML = '';
  dealsEmpty.hidden = filtered.length !== 0;
  for (const deal of filtered) {
    const title = escapeHTML(deal.title || 'Jogo');
    const image = escapeHTML(deal.thumb || '');
    const store = escapeHTML(deal.storeName || 'Loja');
    const price = Number(deal.salePrice || 0);
    const normal = Number(deal.normalPrice || 0);
    const savings = Math.round(Number(deal.savings || 0));
    const link = officialStoreUrl(deal);
    const card = document.createElement('article');
    card.className = 'game-card';
    card.innerHTML = `
      <div class="game-image-wrap">${image ? `<img class="game-image" src="${image}" alt="${title}" loading="lazy" onerror="this.style.display='none'">` : '<div class="game-image-placeholder">GAMEVAULT</div>'}<span class="platform-pill">${store}</span></div>
      <div class="game-content"><h3 title="${title}">${title}</h3>
      <div class="deal-price"><strong>${price.toLocaleString('en-US',{style:'currency',currency:'USD'})}</strong><del>${normal.toLocaleString('en-US',{style:'currency',currency:'USD'})}</del><span class="discount-pill">-${savings}%</span></div>
      <div class="deal-note">Preço informado em USD • pode variar por região</div>
      <div class="game-bottom" style="margin-top:14px"><span class="source-label">${store}</span><a class="details-link" href="${link}" target="_blank" rel="noopener noreferrer">ABRIR NA LOJA OFICIAL ↗</a></div></div>`;
    dealsGrid.appendChild(card);
  }
}

dealsRefresh.addEventListener('click', loadDeals);
dealsSearch.addEventListener('input', renderDeals);
dealsStore.addEventListener('change', renderDeals);
dealsSort.addEventListener('change', renderDeals);
