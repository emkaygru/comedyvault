// ── ComedyVault App ──────────────────────────────────────────────────────────

const STORE_KEY = 'comedyvault_entries';

const CATEGORIES = {
  memory: { label: 'Memories',     icon: '🧠', color: 'memory' },
  story:  { label: 'Stories',      icon: '📖', color: 'story'  },
  joke:   { label: 'Jokes',        icon: '😂', color: 'joke'   },
  idea:   { label: 'Ideas',        icon: '💡', color: 'idea'   },
  tiktok: { label: 'TikTok',       icon: '🎬', color: 'tiktok' },
};

// ── Data Layer ───────────────────────────────────────────────────────────────

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
  catch { return []; }
}

function saveEntries(entries) {
  localStorage.setItem(STORE_KEY, JSON.stringify(entries));
}

function createEntry({ category, title, content, tags }) {
  const entries = loadEntries();
  const entry = {
    id: crypto.randomUUID(),
    category,
    title: title.trim(),
    content: content.trim(),
    tags: tags.map(t => t.trim().toLowerCase()).filter(Boolean),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  entries.unshift(entry);
  saveEntries(entries);
  return entry;
}

function updateEntry(id, { category, title, content, tags }) {
  const entries = loadEntries();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return null;
  entries[idx] = {
    ...entries[idx],
    category,
    title: title.trim(),
    content: content.trim(),
    tags: tags.map(t => t.trim().toLowerCase()).filter(Boolean),
    updatedAt: new Date().toISOString(),
  };
  saveEntries(entries);
  return entries[idx];
}

function deleteEntry(id) {
  saveEntries(loadEntries().filter(e => e.id !== id));
}

function getEntry(id) {
  return loadEntries().find(e => e.id === id) || null;
}

function getByCategory(cat) {
  return loadEntries().filter(e => e.category === cat);
}

function searchEntries(query) {
  const q = query.toLowerCase();
  return loadEntries().filter(e =>
    e.title.toLowerCase().includes(q) ||
    e.content.toLowerCase().includes(q) ||
    e.tags.some(t => t.includes(q))
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function catColor(cat) { return CATEGORIES[cat]?.color || 'text'; }
function catIcon(cat)  { return CATEGORIES[cat]?.icon  || '📝'; }
function catLabel(cat) { return CATEGORIES[cat]?.label || cat; }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ── State ────────────────────────────────────────────────────────────────────

const state = {
  screen: 'home',          // home | list | editor | detail | search
  listCat: null,           // category filter for list screen
  editId: null,            // entry being edited (null = new)
  detailId: null,          // entry being viewed
  editorTags: [],          // tags being built in editor
  editorCat: 'memory',     // selected category in editor
};

// ── Navigation ───────────────────────────────────────────────────────────────

function navigate(screen, opts = {}) {
  Object.assign(state, opts);
  state.screen = screen;
  renderApp();
}

// ── Render Helpers ───────────────────────────────────────────────────────────

function renderEntryChip(entry) {
  const col = catColor(entry.category);
  return `
    <div class="entry-chip" onclick="navigate('detail',{detailId:'${entry.id}'})">
      <div class="chip-dot" style="background:var(--${col})"></div>
      <div>
        <div class="chip-title">${esc(entry.title)}</div>
        <div class="chip-preview">${esc(entry.content)}</div>
        <div class="chip-date">${catLabel(entry.category)} · ${fmtDate(entry.createdAt)}</div>
      </div>
    </div>`;
}

function renderEntryCard(entry) {
  const col = catColor(entry.category);
  const tags = entry.tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join('');
  return `
    <div class="entry-card" onclick="navigate('detail',{detailId:'${entry.id}'})">
      <div class="ec-top">
        <div class="ec-title">${esc(entry.title)}</div>
        <div class="ec-date">${fmtDate(entry.createdAt)}</div>
      </div>
      <div class="ec-preview">${esc(entry.content)}</div>
      ${tags ? `<div class="ec-tags">${tags}</div>` : ''}
    </div>`;
}

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Screen Renderers ─────────────────────────────────────────────────────────

function renderHome() {
  const entries = loadEntries();
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map(c => [c, 0]));
  entries.forEach(e => { if (counts[e.category] !== undefined) counts[e.category]++; });

  const cards = Object.entries(CATEGORIES).map(([key, cat]) => `
    <div class="cat-card" data-cat="${key}" onclick="navigate('list',{listCat:'${key}'})">
      <div class="cat-icon">${cat.icon}</div>
      <div class="cat-count">${counts[key]}</div>
      <div class="cat-label">${cat.label}</div>
    </div>`).join('');

  const recent = entries.slice(0, 5).map(renderEntryChip).join('');

  return `
    <div class="greeting">ComedyVault 🎤</div>
    <div class="subtitle">${entries.length} entry${entries.length !== 1 ? 'ies' : 'y'} in the vault</div>
    <div class="category-grid">${cards}</div>
    ${entries.length ? `
      <div class="section-title">Recently Added</div>
      <div class="recent-list">${recent}</div>` : ''}`;
}

function renderList() {
  const cat = state.listCat;
  const info = CATEGORIES[cat];
  const entries = getByCategory(cat);

  return `
    <div class="list-header">
      <div class="list-title">${info.icon} ${info.label}</div>
      <span class="cat-tag bg-${catColor(cat)}">${entries.length}</span>
    </div>
    <input class="search-bar" id="list-search" placeholder="Search ${info.label.toLowerCase()}…"
      oninput="filterList(this.value)" value="">
    <div class="entry-list" id="entry-list">
      ${entries.length
        ? entries.map(renderEntryCard).join('')
        : `<div class="empty-state"><div class="empty-icon">${info.icon}</div>
            <p>No ${info.label.toLowerCase()} yet.<br>Tap + to add your first one.</p></div>`}
    </div>`;
}

function filterList(q) {
  const cat = state.listCat;
  const all = getByCategory(cat);
  const filtered = q
    ? all.filter(e =>
        e.title.toLowerCase().includes(q.toLowerCase()) ||
        e.content.toLowerCase().includes(q.toLowerCase()) ||
        e.tags.some(t => t.includes(q.toLowerCase())))
    : all;
  document.getElementById('entry-list').innerHTML =
    filtered.length ? filtered.map(renderEntryCard).join('') :
      `<div class="empty-state"><div class="empty-icon">🔍</div><p>No results.</p></div>`;
}

function renderEditor() {
  const entry = state.editId ? getEntry(state.editId) : null;
  const activeCat = entry ? entry.category : state.editorCat;
  if (entry && !state._editorInit) {
    state.editorTags = [...entry.tags];
    state._editorInit = true;
  } else if (!entry && !state._editorInit) {
    state._editorInit = true;
  }

  const catBtns = Object.entries(CATEGORIES).map(([key, cat]) => `
    <button class="cat-btn ${activeCat === key ? 'selected' : ''}" data-cat="${key}"
      onclick="selectCat('${key}')">
      <span class="btn-icon">${cat.icon}</span>${cat.label}
    </button>`).join('');

  const tagsHtml = state.editorTags.map((t,i) =>
    `<span class="tag-pill" onclick="removeTag(${i})">${esc(t)}</span>`).join('');

  return `
    <div class="editor-form">
      <div class="form-group">
        <label>Category</label>
        <div class="cat-selector">${catBtns}</div>
      </div>
      <div class="form-group">
        <label>Title</label>
        <input type="text" id="ed-title" placeholder="Give it a title…"
          value="${entry ? esc(entry.title) : ''}">
      </div>
      <div class="form-group">
        <label>Content</label>
        <textarea id="ed-content" placeholder="Write it all out…">${entry ? esc(entry.content) : ''}</textarea>
      </div>
      <div class="form-group">
        <label>Tags</label>
        <div class="tags-input-wrap">
          <input type="text" id="ed-tag" placeholder="Add a tag…"
            onkeydown="if(event.key==='Enter'||event.key===','){event.preventDefault();addTag()}">
          <button onclick="addTag()">+</button>
        </div>
        ${state.editorTags.length ? `<div class="tags-preview">${tagsHtml}</div>` : ''}
      </div>
      <div class="action-row">
        <button class="btn-save" onclick="saveEntry()">
          ${entry ? 'Save Changes' : '+ Save to Vault'}
        </button>
        ${entry ? `<button class="btn-delete" onclick="confirmDelete('${entry.id}')">🗑</button>` : ''}
      </div>
    </div>`;
}

function renderDetail() {
  const entry = getEntry(state.detailId);
  if (!entry) { navigate('home'); return ''; }
  const col = catColor(entry.category);
  const tags = entry.tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join('');
  return `
    <div class="detail-meta">
      <span class="cat-tag bg-${col}">${catIcon(entry.category)} ${catLabel(entry.category)}</span>
      <span class="detail-date">${fmtDate(entry.createdAt)}</span>
    </div>
    <div class="detail-title">${esc(entry.title)}</div>
    ${tags ? `<div class="ec-tags" style="margin-bottom:16px">${tags}</div>` : ''}
    <div class="detail-body">${esc(entry.content)}</div>
    <div class="detail-actions">
      <button class="btn-edit" onclick="openEditor('${entry.id}')">✏️ Edit</button>
    </div>`;
}

function renderSearch() {
  return `
    <div class="section-title" style="margin-bottom:16px">Search Everything</div>
    <input class="search-bar" id="global-search" placeholder="Search all entries…"
      oninput="doSearch(this.value)" autofocus>
    <div class="entry-list" id="search-results">
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>Start typing to search your vault.</p>
      </div>
    </div>`;
}

function doSearch(q) {
  const container = document.getElementById('search-results');
  if (!q.trim()) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div>
      <p>Start typing to search your vault.</p></div>`;
    return;
  }
  const results = searchEntries(q);
  container.innerHTML = results.length
    ? results.map(renderEntryCard).join('')
    : `<div class="empty-state"><div class="empty-icon">😶</div><p>No results for "${esc(q)}"</p></div>`;
}

// ── Editor Actions ────────────────────────────────────────────────────────────

function selectCat(cat) {
  state.editorCat = cat;
  // re-render just the cat buttons
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.cat === cat);
  });
}

function addTag() {
  const input = document.getElementById('ed-tag');
  const val = input.value.trim().toLowerCase().replace(/,/g,'');
  if (val && !state.editorTags.includes(val)) {
    state.editorTags.push(val);
    renderTagsPreview();
  }
  input.value = '';
  input.focus();
}

function removeTag(i) {
  state.editorTags.splice(i, 1);
  renderTagsPreview();
}

function renderTagsPreview() {
  const wrap = document.querySelector('.tags-preview');
  if (!wrap) return;
  wrap.innerHTML = state.editorTags.map((t,i) =>
    `<span class="tag-pill" onclick="removeTag(${i})">${esc(t)}</span>`).join('');
}

function saveEntry() {
  const title = document.getElementById('ed-title')?.value || '';
  const content = document.getElementById('ed-content')?.value || '';
  if (!title.trim()) { showToast('Add a title first!'); return; }

  const data = { category: state.editorCat, title, content, tags: state.editorTags };

  if (state.editId) {
    updateEntry(state.editId, data);
    showToast('Entry updated ✓');
    navigate('detail', { detailId: state.editId });
  } else {
    const entry = createEntry(data);
    showToast('Saved to vault ✓');
    navigate('detail', { detailId: entry.id });
  }
}

function confirmDelete(id) {
  if (confirm('Delete this entry? This cannot be undone.')) {
    deleteEntry(id);
    showToast('Deleted');
    if (state.listCat) navigate('list');
    else navigate('home');
  }
}

function openEditor(id) {
  state.editorTags = [];
  state._editorInit = false;
  navigate('editor', { editId: id });
}

function openNewEntry(cat) {
  state.editorTags = [];
  state._editorInit = false;
  navigate('editor', { editId: null, editorCat: cat || state.listCat || 'memory' });
}

// ── Main Render ───────────────────────────────────────────────────────────────

function renderApp() {
  const screens = {
    home:   { el: 'home-screen',   content: renderHome,   title: '<span>Comedy</span>Vault', back: false, fab: true  },
    list:   { el: 'list-screen',   content: renderList,   title: `${catIcon(state.listCat)} ${catLabel(state.listCat)}`, back: true,  fab: true  },
    editor: { el: 'editor-screen', content: renderEditor, title: state.editId ? 'Edit Entry' : 'New Entry', back: true,  fab: false },
    detail: { el: 'detail-screen', content: renderDetail, title: '',                          back: true,  fab: false },
    search: { el: 'search-screen', content: renderSearch, title: 'Search',                   back: false, fab: false },
  };

  const cfg = screens[state.screen];

  // Hide all, show current
  Object.values(screens).forEach(s => {
    const el = document.getElementById(s.el);
    if (el) el.classList.remove('active');
  });
  const active = document.getElementById(cfg.el);
  if (active) {
    active.innerHTML = cfg.content();
    active.classList.add('active');
  }

  // Header
  document.querySelector('header h1').innerHTML = cfg.title;
  const backBtn = document.getElementById('back-btn');
  backBtn.classList.toggle('visible', cfg.back);

  // FAB
  document.getElementById('fab').classList.toggle('hidden', !cfg.fab);

  // Nav active state
  document.querySelectorAll('nav#bottom-nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === state.screen);
  });
}

// ── Back Button ──────────────────────────────────────────────────────────────

function goBack() {
  if (state.screen === 'editor') {
    if (state.editId) navigate('detail', { detailId: state.editId });
    else if (state.listCat) navigate('list');
    else navigate('home');
  } else if (state.screen === 'detail') {
    if (state.listCat) navigate('list');
    else navigate('home');
  } else if (state.screen === 'list') {
    navigate('home');
  } else {
    navigate('home');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Back button
  document.getElementById('back-btn').addEventListener('click', goBack);

  // FAB → new entry
  document.getElementById('fab').addEventListener('click', () => openNewEntry());

  // Nav buttons
  document.querySelectorAll('nav#bottom-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      if (screen === 'home') navigate('home');
      else if (screen === 'search') navigate('search');
      else if (screen === 'editor') openNewEntry();
    });
  });

  // Hardware back / swipe back
  window.addEventListener('popstate', goBack);

  renderApp();
});
