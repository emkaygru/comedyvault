// ── ComedyVault App ──────────────────────────────────────────────────────────

const STORE_KEY      = 'comedyvault_entries';
const CHARS_KEY      = 'comedyvault_characters';
const PROFILE_KEY    = 'comedyvault_profile';
const SYNC_TOKEN_KEY = 'cv_sync_token';

// ── Cloud Sync ────────────────────────────────────────────────────────────────

function getSyncToken() {
  let token = localStorage.getItem(SYNC_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(SYNC_TOKEN_KEY, token);
  }
  return token;
}

let _syncDebounce = null;
function syncPush() {
  clearTimeout(_syncDebounce);
  _syncDebounce = setTimeout(async () => {
    const token = localStorage.getItem(SYNC_TOKEN_KEY);
    if (!token) return;
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          entries: loadEntries(),
          chars:   loadChars(),
          profile: loadProfile(),
        }),
      });
    } catch (e) {
      console.warn('Sync push failed:', e);
    }
  }, 2000);
}

async function syncPull() {
  const token = localStorage.getItem(SYNC_TOKEN_KEY);
  if (!token) return false;
  try {
    const r = await fetch(`/api/sync?token=${encodeURIComponent(token)}`);
    if (!r.ok) return false;
    const data = await r.json();
    if (data.error) return false;
    if (Array.isArray(data.entries)) localStorage.setItem(STORE_KEY,   JSON.stringify(data.entries));
    if (Array.isArray(data.chars))   localStorage.setItem(CHARS_KEY,   JSON.stringify(data.chars));
    if (data.profile && typeof data.profile === 'object')
      localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile));
    return true;
  } catch (e) {
    console.warn('Sync pull failed:', e);
    return false;
  }
}

async function applySyncToken(newToken) {
  newToken = (newToken || '').trim();
  if (!newToken || newToken.length < 10) { showToast('Invalid token'); return; }
  localStorage.setItem(SYNC_TOKEN_KEY, newToken);
  showToast('Pulling from server…');
  const ok = await syncPull();
  renderApp();
  showToast(ok ? 'Synced! ✓' : 'Connected — no data yet');
}

function copySyncToken() {
  const token = getSyncToken();
  navigator.clipboard.writeText(token)
    .then(() => showToast('Token copied ✓'))
    .catch(() => showToast(token));
}

const CATEGORIES = {
  memory: { label: 'Memories', icon: '🧠', color: 'memory' },
  story:  { label: 'Stories',  icon: '📖', color: 'story'  },
  joke:   { label: 'Jokes',    icon: '😂', color: 'joke'   },
  idea:   { label: 'Ideas',    icon: '💡', color: 'idea'   },
  tiktok: { label: 'TikTok',   icon: '🎬', color: 'tiktok' },
  bit:    { label: 'Bits',     icon: '🎭', color: 'bit'    },
};

const STATUSES = {
  raw:        { label: 'Raw',        cls: 'status-raw'        },
  developing: { label: 'Developing', cls: 'status-developing' },
  ready:      { label: 'Ready',      cls: 'status-ready'      },
  performed:  { label: 'Performed ✓', cls: 'status-performed' },
};

const PROMPT_LIBRARY = [
  // Memory
  { cat: 'memory', text: "What's something your family does that you didn't realize was weird until you left home?" },
  { cat: 'memory', text: "Describe the most chaotic holiday dinner you've experienced." },
  { cat: 'memory', text: "What's the first time you realized a parent was just making it up as they went?" },
  { cat: 'memory', text: "What's a mistake you made that still replays in your head at 3am?" },
  { cat: 'memory', text: "When did you realize your hometown wasn't normal?" },
  { cat: 'memory', text: "What did you believe as a kid that turned out to be completely wrong?" },
  { cat: 'memory', text: "Describe the most embarrassing thing that's happened to you on a date." },
  { cat: 'memory', text: "What's a rule you have now that exists entirely because of one specific thing that happened?" },
  { cat: 'memory', text: "Who was 'the character' in your family? What did they do?" },
  { cat: 'memory', text: "What's a moment from your past that explains a lot about who you are now?" },
  // Joke
  { cat: 'joke', text: "What's something that annoys you that nobody ever talks about? Find the absurdity in it." },
  { cat: 'joke', text: "What observation about modern life makes you feel like you're going insane?" },
  { cat: 'joke', text: "What's a double standard everyone accepts that makes no sense when you say it out loud?" },
  { cat: 'joke', text: "What's something you do that you're convinced everyone does but nobody admits?" },
  { cat: 'joke', text: "What's the most relatable 'bad at being an adult' moment you've had this year?" },
  { cat: 'joke', text: "What's a situation where the rules make absolutely no sense — but everyone just accepts it?" },
  // Story
  { cat: 'story', text: "Tell the story of the worst job you've ever had." },
  { cat: 'story', text: "What's a situation where everything went wrong at the same time?" },
  { cat: 'story', text: "When was the last time you were the most embarrassed person in a room?" },
  { cat: 'story', text: "Describe a time you tried hard to be cool and completely failed." },
  { cat: 'story', text: "What's a story you tell at parties that always gets a reaction?" },
  { cat: 'story', text: "Tell the story of a time you had to explain something embarrassing about yourself to a stranger." },
  // Idea
  { cat: 'idea', text: "If your life were a Netflix special, what's the title and one-sentence description?" },
  { cat: 'idea', text: "What topic makes you go on forever once someone brings it up?" },
  { cat: 'idea', text: "What's a pattern in your own life that keeps repeating itself?" },
  { cat: 'idea', text: "What's a 'type' of person you keep running into? Describe them in detail." },
  { cat: 'idea', text: "What are you weirdly an expert on purely because of your life experiences?" },
  // TikTok
  { cat: 'tiktok', text: "What's a hot take about your life or job that would make strangers argue in the comments?" },
  { cat: 'tiktok', text: "What's something that happened to you that sounds fake but is 100% true?" },
  { cat: 'tiktok', text: "What's a 'you had to be there' moment that you can make universal?" },
  { cat: 'tiktok', text: "What life experience do you have that most people have never thought about?" },
  // Bit
  { cat: 'bit', text: "Take your best memory. What's the universal feeling at the core of it?" },
  { cat: 'bit', text: "Who in your life would make the funniest character in a sitcom? Why?" },
  { cat: 'bit', text: "What's something you've always wanted to say but never could?" },
  { cat: 'bit', text: "Pick something that drives you crazy. Build: annoyance → escalate to absurdity → punchline." },
  { cat: 'bit', text: "What version of yourself (past or present) would make a great comedic character?" },
];

// ── Data Layer: Entries ───────────────────────────────────────────────────────

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
  catch { return []; }
}
function saveEntries(entries) { localStorage.setItem(STORE_KEY, JSON.stringify(entries)); syncPush(); }

function createEntry({ category, title, content, tags, status, imageUrl }) {
  const entries = loadEntries();
  const entry = {
    id: crypto.randomUUID(), category,
    title: title.trim(), content: content.trim(),
    tags: tags.map(t => t.trim().toLowerCase()).filter(Boolean),
    status: status || 'raw',
    imageUrl: imageUrl || null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  entries.unshift(entry);
  saveEntries(entries);
  return entry;
}

function updateEntry(id, { category, title, content, tags, status, imageUrl }) {
  const entries = loadEntries();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return null;
  entries[idx] = {
    ...entries[idx], category,
    title: title.trim(), content: content.trim(),
    tags: tags.map(t => t.trim().toLowerCase()).filter(Boolean),
    status: status || entries[idx].status || 'raw',
    imageUrl: imageUrl !== undefined ? imageUrl : entries[idx].imageUrl,
    updatedAt: new Date().toISOString(),
  };
  saveEntries(entries);
  return entries[idx];
}

function deleteEntry(id) { saveEntries(loadEntries().filter(e => e.id !== id)); }
function getEntry(id) { return loadEntries().find(e => e.id === id) || null; }
function getByCategory(cat) { return loadEntries().filter(e => e.category === cat); }
function searchEntries(q) {
  const ql = q.toLowerCase();
  return loadEntries().filter(e =>
    e.title.toLowerCase().includes(ql) ||
    e.content.toLowerCase().includes(ql) ||
    e.tags.some(t => t.includes(ql))
  );
}

// ── Data Layer: Characters ────────────────────────────────────────────────────

function loadChars() {
  try { return JSON.parse(localStorage.getItem(CHARS_KEY) || '[]'); }
  catch { return []; }
}
function saveChars(chars) { localStorage.setItem(CHARS_KEY, JSON.stringify(chars)); syncPush(); }

function createChar({ name, relationship, descriptors, notes }) {
  const chars = loadChars();
  const char = {
    id: crypto.randomUUID(), name: name.trim(),
    relationship: relationship.trim(),
    descriptors: descriptors.map(d => d.trim().toLowerCase()).filter(Boolean),
    notes: notes.trim(),
    createdAt: new Date().toISOString(),
  };
  chars.unshift(char);
  saveChars(chars);
  return char;
}

function updateChar(id, { name, relationship, descriptors, notes }) {
  const chars = loadChars();
  const idx = chars.findIndex(c => c.id === id);
  if (idx === -1) return null;
  chars[idx] = {
    ...chars[idx], name: name.trim(), relationship: relationship.trim(),
    descriptors: descriptors.map(d => d.trim().toLowerCase()).filter(Boolean),
    notes: notes.trim(),
  };
  saveChars(chars);
  return chars[idx];
}

function deleteChar(id) { saveChars(loadChars().filter(c => c.id !== id)); }
function getChar(id) { return loadChars().find(c => c.id === id) || null; }

// ── Data Layer: Profile ───────────────────────────────────────────────────────

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); }
  catch { return {}; }
}
function saveProfile(data) { localStorage.setItem(PROFILE_KEY, JSON.stringify(data)); syncPush(); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function catColor(cat) { return CATEGORIES[cat]?.color || 'text'; }
function catIcon(cat)  { return CATEGORIES[cat]?.icon  || '📝'; }
function catLabel(cat) { return CATEGORIES[cat]?.label || cat; }

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Markdown Renderer ─────────────────────────────────────────────────────────

function md_inline(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/_(.+?)_/g,'<em>$1</em>');
}

function renderMd(raw) {
  if (!raw) return '';
  const lines = raw.split('\n');
  const out = [];
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('### '))     out.push(`<h3>${md_inline(trimmed.slice(4))}</h3>`);
    else if (trimmed.startsWith('## ')) out.push(`<h2>${md_inline(trimmed.slice(3))}</h2>`);
    else if (trimmed.startsWith('# '))  out.push(`<h1>${md_inline(trimmed.slice(2))}</h1>`);
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* '))
      out.push(`<li>${md_inline(trimmed.slice(2))}</li>`);
    else if (trimmed === '')            out.push('<br>');
    else                                out.push(`<p>${md_inline(trimmed)}</p>`);
  }
  return out.join('').replace(/(<li>[\s\S]*?<\/li>)+/g, m => `<ul>${m}</ul>`);
}

// ── Format Toolbar ────────────────────────────────────────────────────────────

function fmtToolbar(textareaId) {
  return `<div class="fmt-toolbar">
    <button class="fmt-btn" onclick="wrapText('${textareaId}','**','**')" title="Bold"><strong>B</strong></button>
    <button class="fmt-btn" onclick="wrapText('${textareaId}','*','*')" title="Italic"><em>I</em></button>
    <button class="fmt-btn" onclick="insertLinePrefix('${textareaId}','## ')" title="Heading">H2</button>
    <button class="fmt-btn" onclick="insertLinePrefix('${textareaId}','### ')" title="Sub-heading">H3</button>
    <button class="fmt-btn" onclick="insertLinePrefix('${textareaId}','- ')" title="Bullet">• List</button>
    <button class="fmt-btn" onclick="insertAtCursor('${textareaId}','\n')" title="Line break">↵ Break</button>
  </div>`;
}

function wrapText(id, before, after) {
  const ta = document.getElementById(id);
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const sel = ta.value.slice(start, end) || 'text';
  ta.value = ta.value.slice(0, start) + before + sel + after + ta.value.slice(end);
  ta.selectionStart = start + before.length;
  ta.selectionEnd   = start + before.length + sel.length;
  ta.focus();
}

function insertLinePrefix(id, prefix) {
  const ta = document.getElementById(id);
  if (!ta) return;
  const start = ta.selectionStart;
  const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
  ta.value = ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
  ta.selectionStart = ta.selectionEnd = lineStart + prefix.length;
  ta.focus();
}

function insertAtCursor(id, text) {
  const ta = document.getElementById(id);
  if (!ta) return;
  const start = ta.selectionStart;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(start);
  ta.selectionStart = ta.selectionEnd = start + text.length;
  ta.focus();
}

// ── Image Upload ──────────────────────────────────────────────────────────────

async function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target.result.split(',')[1];
      try {
        const r = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '-')}`,
            contentType: file.type,
            data: b64,
          }),
        });
        const d = await r.json();
        if (d.error) reject(new Error(d.error)); else resolve(d.url);
      } catch (e) { reject(e); }
    };
    reader.readAsDataURL(file);
  });
}

function openImagePicker() {
  document.getElementById('ed-img-input')?.click();
}

async function handleImageSelect(input) {
  const file = input.files[0];
  if (!file) return;
  showToast('Uploading image…');
  try {
    const url = await uploadImage(file);
    state.editorImageUrl = url;
    const wrap = document.getElementById('ed-img-preview-wrap');
    if (wrap) {
      wrap.innerHTML = `<div class="entry-img-preview-wrap">
        <img src="${esc(url)}" class="entry-img-preview" alt="Attached image">
        <button class="img-remove-btn" onclick="removeEditorImage()">✕</button>
      </div>`;
    }
    showToast('Image uploaded ✓');
  } catch (e) {
    showToast('Upload failed: ' + e.message);
  }
}

function removeEditorImage() {
  state.editorImageUrl = null;
  const wrap = document.getElementById('ed-img-preview-wrap');
  if (wrap) wrap.innerHTML = '';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function statusBadge(status) {
  const s = STATUSES[status] || STATUSES.raw;
  return `<span class="status-badge ${s.cls}">${s.label}</span>`;
}

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  screen: 'home',
  listCat: null,
  editId: null,
  detailId: null,
  editorTags: [],
  editorCat: 'memory',
  editorStatus: 'raw',
  editorImageUrl: null,
  _editorInit: false,
  editCharId: null,
  charTags: [],
  _charInit: false,
  promptFilter: 'all',
  promptIdx: 0,
};

// ── FAB Speed Dial ────────────────────────────────────────────────────────────

let fabOpen = false;
let touchTracking = false;
let lastHoveredItem = null;

function openFab() {
  fabOpen = true;
  document.getElementById('fab').classList.add('open');
  document.getElementById('fab-backdrop').classList.add('open');
  const items = document.querySelectorAll('.fab-item');
  items.forEach((item, i) => {
    // last item (Memory) appears first → delay = 0 for last child
    const delay = (items.length - 1 - i) * 22;
    item.style.transitionDelay = delay + 'ms';
    item.classList.add('open');
  });
}

function closeFab() {
  fabOpen = false;
  document.getElementById('fab').classList.remove('open');
  document.getElementById('fab-backdrop').classList.remove('open');
  const menu = document.getElementById('fab-menu');
  menu.classList.remove('has-hover');
  document.querySelectorAll('.fab-item').forEach(item => {
    item.style.transitionDelay = '0ms';
    item.classList.remove('open', 'touch-hover');
  });
  lastHoveredItem = null;
}

function handleFabAction(action) {
  if (action === 'voice') {
    openVoiceModal();
  } else if (action === 'character') {
    state.charTags = [];
    state._charInit = false;
    navigate('character-editor', { editCharId: null });
  } else {
    state.editorTags = [];
    state._editorInit = false;
    state.editorImageUrl = null;
    navigate('editor', { editId: null, editorCat: action, editorStatus: 'raw' });
  }
}

function initFab() {
  const fab = document.getElementById('fab');
  const backdrop = document.getElementById('fab-backdrop');
  const menu = document.getElementById('fab-menu');

  // Click to toggle
  fab.addEventListener('click', () => {
    if (fabOpen) closeFab(); else openFab();
  });

  // Backdrop click to close
  backdrop.addEventListener('click', closeFab);

  // FAB item clicks (for mouse users)
  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('.fab-btn');
    if (!btn) return;
    const action = btn.closest('.fab-item').dataset.action;
    closeFab();
    handleFabAction(action);
  });

  // Touch: press FAB and slide to item
  fab.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!fabOpen) openFab();
    touchTracking = true;
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!touchTracking) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const btn = el?.closest('.fab-btn');
    const items = document.querySelectorAll('.fab-item');

    items.forEach(item => item.classList.remove('touch-hover'));
    if (btn) {
      const item = btn.closest('.fab-item');
      item.classList.add('touch-hover');
      menu.classList.add('has-hover');
      lastHoveredItem = item;
    } else {
      menu.classList.remove('has-hover');
      lastHoveredItem = null;
    }
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!touchTracking) return;
    touchTracking = false;
    if (lastHoveredItem) {
      const action = lastHoveredItem.dataset.action;
      closeFab();
      handleFabAction(action);
    }
  });

  // Mouse hover effects (desktop)
  menu.addEventListener('mouseover', () => menu.classList.add('has-hover'));
  menu.addEventListener('mouseleave', () => menu.classList.remove('has-hover'));
}

// ── Voice Recording ───────────────────────────────────────────────────────────

let recognition = null;
let voiceTranscript = '';
let voiceRecording = false;

function openVoiceModal() {
  const modal = document.getElementById('voice-modal');
  modal.classList.add('open');
  modal.removeAttribute('aria-hidden');
  clearVoice();
  startVoice();
}

function closeVoiceModal() {
  stopVoice();
  document.getElementById('voice-modal').classList.remove('open');
  document.getElementById('voice-modal').setAttribute('aria-hidden', 'true');
}

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('voice-transcript').textContent =
      'Voice not supported in this browser. Try Chrome or Safari.';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  const display = document.getElementById('voice-transcript');
  display.classList.add('recording');
  voiceRecording = true;

  recognition.onresult = (e) => {
    let interim = '';
    let final = voiceTranscript;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        final += e.results[i][0].transcript + ' ';
      } else {
        interim = e.results[i][0].transcript;
      }
    }
    voiceTranscript = final;
    display.textContent = final + interim;
  };

  recognition.onend = () => {
    voiceRecording = false;
    display.classList.remove('recording');
  };

  recognition.onerror = (e) => {
    if (e.error !== 'aborted') showToast('Mic error: ' + e.error);
    voiceRecording = false;
    display.classList.remove('recording');
  };

  recognition.start();
}

function stopVoice() {
  if (recognition) { recognition.stop(); recognition = null; }
  voiceRecording = false;
  document.getElementById('voice-transcript')?.classList.remove('recording');
}

function clearVoice() {
  stopVoice();
  voiceTranscript = '';
  const display = document.getElementById('voice-transcript');
  if (display) display.textContent = '';
  startVoice();
}

function useVoiceTranscript() {
  const text = document.getElementById('voice-transcript').textContent.trim();
  if (!text) { showToast('Nothing recorded yet'); return; }
  stopVoice();
  closeVoiceModal();
  state.editorTags = [];
  state._editorInit = false;
  navigate('editor', { editId: null, editorCat: state.listCat || 'memory', editorStatus: 'raw' });
  // Pre-fill content after render
  setTimeout(() => {
    const ta = document.getElementById('ed-content');
    if (ta) ta.value = text;
  }, 60);
}

// ── AI Panel ──────────────────────────────────────────────────────────────────

async function callAI(type) {
  const entry = getEntry(state.detailId);
  const apiKey = localStorage.getItem('cv_api_key');
  if (!entry) return;
  if (!apiKey) { showToast('Add API key in My Story'); return; }

  const btns = document.querySelectorAll('.ai-btn');
  btns.forEach(b => { b.disabled = true; });
  const resultEl = document.getElementById('ai-result');
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = '<div class="ai-loading">✨ Claude is thinking…</div>';

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ type, content: entry.content, category: entry.category, title: entry.title }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    resultEl._aiContent = data.result;
    resultEl.innerHTML = `
      <div class="ai-result-text">${esc(data.result)}</div>
      <div class="ai-result-actions">
        <button onclick="copyAIResult()">📋 Copy</button>
        <button onclick="useAIResult('${type}')">✏️ Use This</button>
      </div>`;
  } catch (e) {
    resultEl.innerHTML = `<div class="ai-error">Error: ${esc(e.message)}</div>`;
  } finally {
    btns.forEach(b => { b.disabled = false; });
  }
}

function copyAIResult() {
  const content = document.getElementById('ai-result')._aiContent;
  if (!content) return;
  navigator.clipboard.writeText(content).then(() => showToast('Copied!')).catch(() => showToast('Copy failed'));
}

function useAIResult(type) {
  const content = document.getElementById('ai-result')._aiContent;
  if (!content) return;
  if (type === 'punchup') {
    navigate('editor', { editId: state.detailId });
    setTimeout(() => {
      const ta = document.getElementById('ed-content');
      if (ta) ta.value = content;
    }, 60);
  } else {
    state.editorTags = [];
    state._editorInit = false;
    navigate('editor', { editId: null, editorCat: state.screen === 'detail' ? getEntry(state.detailId)?.category || 'idea' : 'idea', editorStatus: 'raw' });
    setTimeout(() => {
      const ta = document.getElementById('ed-content');
      if (ta) ta.value = content;
    }, 60);
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────

function navigate(screen, opts = {}) {
  Object.assign(state, opts);
  state.screen = screen;
  renderApp();
}

// ── Render Helpers ────────────────────────────────────────────────────────────

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
  const tags = entry.tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join('');
  const status = entry.status && entry.status !== 'raw' ? statusBadge(entry.status) : '';
  return `
    <div class="entry-card" onclick="navigate('detail',{detailId:'${entry.id}'})">
      <div class="ec-top">
        <div class="ec-title">${esc(entry.title)}</div>
        <div class="ec-right">
          <div class="ec-date">${fmtDate(entry.createdAt)}</div>
          ${status}
        </div>
      </div>
      <div class="ec-preview">${esc(entry.content)}</div>
      ${tags ? `<div class="ec-tags">${tags}</div>` : ''}
    </div>`;
}

// ── Screen: Home ──────────────────────────────────────────────────────────────

function renderHome() {
  const entries = loadEntries();
  const profile = loadProfile();
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map(c => [c, 0]));
  entries.forEach(e => { if (counts[e.category] !== undefined) counts[e.category]++; });

  const firstName = profile.name ? profile.name.split(' ')[0] : null;
  const greeting = firstName ? `Hey ${firstName} 👋` : 'ComedyVault 🎤';
  const total = entries.length;
  const subtitle = total
    ? `${total} entry${total !== 1 ? 'ies' : 'y'} in the vault`
    : 'Your story starts here. Tap + to add something.';

  const cards = Object.entries(CATEGORIES).map(([key, cat]) => `
    <div class="cat-card" data-cat="${key}" onclick="navigate('list',{listCat:'${key}'})">
      <div class="cat-icon">${cat.icon}</div>
      <div class="cat-count">${counts[key]}</div>
      <div class="cat-label">${cat.label}</div>
    </div>`).join('');

  const recent = entries.slice(0, 5).map(renderEntryChip).join('');

  return `
    <div class="greeting">${greeting}</div>
    <div class="subtitle">${subtitle}</div>
    <div class="category-grid">${cards}</div>
    ${entries.length ? `
      <div class="section-title">Recently Added</div>
      <div class="recent-list">${recent}</div>` : ''}`;
}

// ── Screen: List ──────────────────────────────────────────────────────────────

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
      oninput="filterList(this.value)">
    <div class="entry-list" id="entry-list">
      ${entries.length
        ? entries.map(renderEntryCard).join('')
        : `<div class="empty-state"><div class="empty-icon">${info.icon}</div>
            <p>No ${info.label.toLowerCase()} yet.<br>Tap + to add your first one.</p></div>`}
    </div>`;
}

function filterList(q) {
  const all = getByCategory(state.listCat);
  const ql = q.toLowerCase();
  const filtered = q
    ? all.filter(e =>
        e.title.toLowerCase().includes(ql) ||
        e.content.toLowerCase().includes(ql) ||
        e.tags.some(t => t.includes(ql)))
    : all;
  document.getElementById('entry-list').innerHTML =
    filtered.length ? filtered.map(renderEntryCard).join('')
      : `<div class="empty-state"><div class="empty-icon">🔍</div><p>No results.</p></div>`;
}

// ── Screen: Editor ────────────────────────────────────────────────────────────

function renderEditor() {
  const entry = state.editId ? getEntry(state.editId) : null;
  const activeCat = entry ? entry.category : state.editorCat;

  if (!state._editorInit) {
    state.editorTags = entry ? [...entry.tags] : [];
    state.editorStatus = entry ? (entry.status || 'raw') : (state.editorStatus || 'raw');
    state._editorInit = true;
  }

  const catBtns = Object.entries(CATEGORIES).map(([key, cat]) => `
    <button class="cat-btn ${activeCat === key ? 'selected' : ''}" data-cat="${key}"
      onclick="selectCat('${key}')">
      <span class="btn-icon">${cat.icon}</span>${cat.label}
    </button>`).join('');

  const statusBtns = Object.entries(STATUSES).map(([key]) => `
    <button class="status-btn ${state.editorStatus === key ? 'active-' + key : ''}"
      onclick="selectStatus('${key}')">${STATUSES[key].label}
    </button>`).join('');

  const tagsHtml = state.editorTags.map((t, i) =>
    `<span class="tag-pill" onclick="removeTag(${i})">${esc(t)}</span>`).join('');

  const placeholder = activeCat === 'bit'
    ? 'Setup → what\'s the premise?\nEscalation → push the absurdity\nPunchline → the button'
    : 'Write it all out…';

  const imgUrl = state.editorImageUrl || (entry?.imageUrl) || null;
  if (!state.editorImageUrl && entry?.imageUrl) state.editorImageUrl = entry.imageUrl;

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
        ${fmtToolbar('ed-content')}
        <textarea id="ed-content" placeholder="${placeholder}">${entry ? esc(entry.content) : ''}</textarea>
      </div>
      <div class="form-group">
        <label>Image</label>
        <div class="img-upload-row">
          <button class="img-upload-btn" onclick="openImagePicker()">📷 Attach Image</button>
          <input type="file" id="ed-img-input" accept="image/*"
            onchange="handleImageSelect(this)">
        </div>
        <div id="ed-img-preview-wrap">
          ${imgUrl ? `<div class="entry-img-preview-wrap">
            <img src="${esc(imgUrl)}" class="entry-img-preview" alt="Attached image">
            <button class="img-remove-btn" onclick="removeEditorImage()">✕</button>
          </div>` : ''}
        </div>
      </div>
      <div class="form-group">
        <label>Status</label>
        <div class="status-selector">${statusBtns}</div>
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

// ── Screen: Detail ────────────────────────────────────────────────────────────

function renderDetail() {
  const entry = getEntry(state.detailId);
  if (!entry) { navigate('home'); return ''; }
  const col = catColor(entry.category);
  const tags = entry.tags.map(t => `<span class="tag-pill">${esc(t)}</span>`).join('');
  const hasKey = !!localStorage.getItem('cv_api_key');

  const aiPanel = `
    <div class="ai-panel">
      <div class="ai-panel-title">✨ Ask Claude</div>
      ${hasKey ? `
        <div class="ai-btns">
          <button class="ai-btn" onclick="callAI('punchup')">🥊 Punch Up</button>
          <button class="ai-btn" onclick="callAI('expand')">🌱 Expand It</button>
          <button class="ai-btn" onclick="callAI('tiktok')">🎬 → TikTok</button>
          <button class="ai-btn" onclick="callAI('prompts')">💬 Dig Deeper</button>
        </div>
        <div id="ai-result" class="ai-result hidden"></div>`
      : `<div class="ai-no-key">Add your Anthropic API key in
          <button onclick="navigate('profile')">My Story</button>
          to unlock AI punch-up, expansion, and more.</div>`}
    </div>`;

  return `
    <div class="detail-meta">
      <span class="cat-tag bg-${col}">${catIcon(entry.category)} ${catLabel(entry.category)}</span>
      ${statusBadge(entry.status || 'raw')}
      <span class="detail-date">${fmtDate(entry.createdAt)}</span>
    </div>
    <div class="detail-title">${esc(entry.title)}</div>
    ${tags ? `<div class="ec-tags" style="margin-bottom:16px">${tags}</div>` : ''}
    ${entry.imageUrl ? `<img src="${esc(entry.imageUrl)}" class="detail-img" alt="Entry image">` : ''}
    <div class="detail-body">${renderMd(entry.content)}</div>
    <div class="detail-actions">
      <button class="btn-edit" onclick="openEditor('${entry.id}')">✏️ Edit</button>
      <button class="btn-edit" onclick="confirmDelete('${entry.id}')">🗑 Delete</button>
    </div>
    ${aiPanel}`;
}

// ── Screen: Search ────────────────────────────────────────────────────────────

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

// ── Screen: Characters ────────────────────────────────────────────────────────

function renderCharacters() {
  const chars = loadChars();
  const list = chars.length
    ? chars.map(c => `
        <div class="char-card" onclick="navigate('character-editor',{editCharId:'${c.id}'})">
          <div class="char-avatar">👤</div>
          <div class="char-info">
            <div class="char-name">${esc(c.name)}</div>
            <div class="char-rel">${esc(c.relationship)}</div>
            ${c.descriptors.length ? `
              <div class="char-descriptors">
                ${c.descriptors.map(d => `<span class="tag-pill">${esc(d)}</span>`).join('')}
              </div>` : ''}
          </div>
        </div>`)
      .join('')
    : `<div class="empty-state">
        <div class="empty-icon">👥</div>
        <p>No characters yet.<br>Add the people in your stories.</p>
      </div>`;

  return `
    <div class="section-title" style="margin-bottom:16px">Your Cast</div>
    <div class="char-list">${list}</div>`;
}

// ── Screen: Character Editor ──────────────────────────────────────────────────

function renderCharacterEditor() {
  const char = state.editCharId ? getChar(state.editCharId) : null;
  if (!state._charInit) {
    state.charTags = char ? [...char.descriptors] : [];
    state._charInit = true;
  }

  const tagsHtml = state.charTags.map((t, i) =>
    `<span class="tag-pill" onclick="removeCharTag(${i})">${esc(t)}</span>`).join('');

  return `
    <div class="editor-form">
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="char-name" placeholder="Who are they?" value="${char ? esc(char.name) : ''}">
      </div>
      <div class="form-group">
        <label>Relationship</label>
        <input type="text" id="char-rel" placeholder="Mom, coworker, ex, best friend…"
          value="${char ? esc(char.relationship) : ''}">
      </div>
      <div class="form-group">
        <label>Descriptors</label>
        <div class="tags-input-wrap">
          <input type="text" id="char-desc-input" placeholder="chaotic, loud, hilarious…"
            onkeydown="if(event.key==='Enter'||event.key===','){event.preventDefault();addCharTag()}">
          <button onclick="addCharTag()">+</button>
        </div>
        ${state.charTags.length ? `<div class="tags-preview" id="char-tags-preview">${tagsHtml}</div>` : ''}
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="char-notes" placeholder="Anything else that makes them them…">${char ? esc(char.notes) : ''}</textarea>
      </div>
      <div class="action-row">
        <button class="btn-save" onclick="saveChar()">${char ? 'Save Changes' : '+ Add to Cast'}</button>
        ${char ? `<button class="btn-delete" onclick="confirmDeleteChar('${char.id}')">🗑</button>` : ''}
      </div>
    </div>`;
}

// ── Screen: Profile ───────────────────────────────────────────────────────────

function renderProfile() {
  const p = loadProfile();
  const apiKey = localStorage.getItem('cv_api_key') || '';
  const themeTags = (p.themes || []).map((t, i) =>
    `<span class="tag-pill" onclick="removeProfileTheme(${i})">${esc(t)}</span>`).join('');

  return `
    <div class="profile-section">
      <div class="section-title">About You</div>
      <div class="profile-field">
        <label>Your Name</label>
        <input type="text" id="p-name" placeholder="First and last" value="${esc(p.name || '')}">
      </div>
      <div class="profile-field">
        <label>Hometown</label>
        <input type="text" id="p-hometown" placeholder="Where'd you grow up?" value="${esc(p.hometown || '')}">
      </div>
      <div class="profile-field">
        <label>Current City</label>
        <input type="text" id="p-city" placeholder="Where are you now?" value="${esc(p.currentCity || '')}">
      </div>
      <div class="profile-field">
        <label>What You Do</label>
        <input type="text" id="p-job" placeholder="Job, career, hustle…" value="${esc(p.job || '')}">
      </div>
      <div class="profile-field">
        <label>Family Dynamic</label>
        <input type="text" id="p-family" placeholder="Big Italian family, only child, messy divorce…"
          value="${esc(p.family || '')}">
      </div>
    </div>

    <div class="profile-section">
      <div class="section-title">Your Comedy Voice</div>
      <div class="profile-field">
        <label>Style / Tone</label>
        <input type="text" id="p-voice" placeholder="Self-deprecating, observational, dark, absurdist…"
          value="${esc(p.voice || '')}">
      </div>
      <div class="profile-field">
        <label>Your Story (bio)</label>
        <textarea id="p-bio" placeholder="A few sentences about who you are and what you've been through…">${esc(p.bio || '')}</textarea>
      </div>
      <div class="profile-field">
        <label>Recurring Themes</label>
        <div class="tags-input-wrap">
          <input type="text" id="p-theme-input" placeholder="family, work, dating, anxiety…"
            onkeydown="if(event.key==='Enter'||event.key===','){event.preventDefault();addProfileTheme()}">
          <button onclick="addProfileTheme()">+</button>
        </div>
        ${(p.themes || []).length ? `<div class="tags-preview" id="profile-themes-preview">${themeTags}</div>` : '<div id="profile-themes-preview" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px"></div>'}
      </div>
    </div>

    <button class="btn-profile-save" onclick="saveProfile_()">Save My Story</button>

    <div class="divider"></div>

    <div class="profile-section">
      <div class="section-title">⚡ Claude AI Settings</div>
      <div class="profile-field">
        <label>Anthropic API Key</label>
        <div class="api-key-wrap">
          <input type="password" id="p-apikey" placeholder="sk-ant-…" value="${esc(apiKey)}">
          <button onclick="saveApiKey()">Save</button>
        </div>
        <div class="settings-note">
          Your key is stored locally on this device only. Never shared.<br>
          Get one at console.anthropic.com → API Keys.
        </div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="profile-section">
      <div class="section-title">☁️ Cloud Sync</div>
      <div class="profile-field">
        <label>Your Sync Token</label>
        <div class="api-key-wrap">
          <input type="text" id="p-sync-token" value="${esc(getSyncToken())}" readonly
            style="font-family:monospace;font-size:13px;letter-spacing:.03em">
          <button onclick="copySyncToken()">Copy</button>
        </div>
        <div class="settings-note">
          This token is your vault's ID in the cloud. Copy it to any other device and paste below to sync your data across devices.
        </div>
      </div>
      <div class="profile-field">
        <label>Sync from another device</label>
        <div class="api-key-wrap">
          <input type="text" id="p-new-token" placeholder="Paste token from your other device">
          <button onclick="applySyncToken(document.getElementById('p-new-token').value)">Sync</button>
        </div>
      </div>
      <button class="btn-profile-save" style="margin-top:8px" onclick="syncPull().then(ok=>{renderApp();showToast(ok?'Synced ✓':'Nothing to pull')})">
        Pull Latest from Cloud
      </button>
    </div>`;
}

// ── Screen: Prompts ───────────────────────────────────────────────────────────

function getPersonalizedPrompts(filterCat) {
  const profile = loadProfile();
  const chars = loadChars();
  const entries = loadEntries();

  const prompts = [...PROMPT_LIBRARY];

  // Inject character-specific prompts
  chars.forEach(c => {
    prompts.push({ cat: 'memory', text: `Tell the story of the most ${c.descriptors[0] || 'memorable'} thing ${esc(c.name)} ever did.` });
    prompts.push({ cat: 'bit', text: `If ${esc(c.name)} (${esc(c.relationship)}) were a character in a sitcom, what would their episode be?` });
  });

  // Inject profile-specific prompts
  if (profile.hometown) {
    prompts.push({ cat: 'memory', text: `What's something about growing up in ${esc(profile.hometown)} that still affects you today?` });
  }
  if (profile.job) {
    prompts.push({ cat: 'joke', text: `What's the most absurd thing about being a ${esc(profile.job)} that outsiders would never understand?` });
    prompts.push({ cat: 'tiktok', text: `What's the unwritten rule of your job that nobody talks about?` });
  }
  if (profile.family) {
    prompts.push({ cat: 'memory', text: `Describe a moment that perfectly captures your family dynamic: "${esc(profile.family)}"` });
  }

  // Filter by category if needed
  const filtered = filterCat && filterCat !== 'all'
    ? prompts.filter(p => p.cat === filterCat)
    : prompts;

  // Bias toward categories with fewer entries
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map(c => [c, 0]));
  entries.forEach(e => { if (counts[e.category] !== undefined) counts[e.category]++; });

  return filtered.sort((a, b) => (counts[a.cat] || 0) - (counts[b.cat] || 0));
}

function renderPrompts() {
  const filter = state.promptFilter || 'all';
  const prompts = getPersonalizedPrompts(filter);
  const idx = Math.min(state.promptIdx || 0, Math.max(0, prompts.length - 1));
  const featured = prompts[idx];

  const filterBtns = [['all', 'All'], ...Object.entries(CATEGORIES).map(([k, v]) => [k, v.icon])].map(([key, label]) => `
    <button class="filter-btn ${filter === key ? 'active' : ''}"
      onclick="setPromptFilter('${key}')">${label}</button>`).join('');

  const otherPrompts = prompts
    .filter((_, i) => i !== idx)
    .slice(0, 12)
    .map((p, i) => `
      <div class="prompt-card" onclick="writeToPrompt(${PROMPT_LIBRARY.indexOf(p) !== -1 ? PROMPT_LIBRARY.indexOf(p) : 0}, '${p.cat}', ${JSON.stringify(p.text).replace(/'/g, "&#39;")})">
        <div class="prompt-cat-dot" style="background:var(--${catColor(p.cat)})"></div>
        <div class="prompt-card-text">${esc(p.text)}</div>
      </div>`).join('');

  return `
    <div class="prompt-filter">${filterBtns}</div>
    ${featured ? `
      <div class="featured-prompt">
        <div class="featured-label">✨ Write to This</div>
        <div class="featured-text">${esc(featured.text)}</div>
        <div class="featured-actions">
          <button class="btn-write-prompt" onclick="writeToPromptFeatured()">✍️ Start Writing</button>
          <button class="btn-skip-prompt" onclick="skipPrompt()">→ Skip</button>
        </div>
      </div>` : '<div class="empty-state"><div class="empty-icon">🎤</div><p>No prompts for this filter.</p></div>'}
    ${otherPrompts ? `<div class="section-title">More Prompts</div>${otherPrompts}` : ''}`;
}

function setPromptFilter(cat) {
  state.promptFilter = cat;
  state.promptIdx = 0;
  navigate('prompts');
}

function skipPrompt() {
  const prompts = getPersonalizedPrompts(state.promptFilter);
  state.promptIdx = ((state.promptIdx || 0) + 1) % prompts.length;
  navigate('prompts');
}

function writeToPromptFeatured() {
  const prompts = getPersonalizedPrompts(state.promptFilter);
  const p = prompts[state.promptIdx || 0];
  if (!p) return;
  state.editorTags = [];
  state._editorInit = false;
  navigate('editor', { editId: null, editorCat: p.cat, editorStatus: 'raw' });
  setTimeout(() => {
    const titleEl = document.getElementById('ed-title');
    const contentEl = document.getElementById('ed-content');
    if (titleEl && !titleEl.value) titleEl.value = '';
    if (contentEl) contentEl.placeholder = p.text;
  }, 60);
}

function writeToPrompt(idx, cat) {
  state.editorTags = [];
  state._editorInit = false;
  navigate('editor', { editId: null, editorCat: cat, editorStatus: 'raw' });
}

// ── Editor Actions ────────────────────────────────────────────────────────────

function selectCat(cat) {
  state.editorCat = cat;
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.cat === cat);
  });
  const ta = document.getElementById('ed-content');
  if (ta && !ta.value) {
    ta.placeholder = cat === 'bit'
      ? 'Setup → what\'s the premise?\nEscalation → push the absurdity\nPunchline → the button'
      : 'Write it all out…';
  }
}

function selectStatus(status) {
  state.editorStatus = status;
  document.querySelectorAll('.status-btn').forEach(b => {
    b.className = 'status-btn';
    if (b.onclick?.toString().includes(`'${status}'`)) {
      b.classList.add('active-' + status);
    }
  });
}

function addTag() {
  const input = document.getElementById('ed-tag');
  const val = input.value.trim().toLowerCase().replace(/,/g, '');
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
  wrap.innerHTML = state.editorTags.map((t, i) =>
    `<span class="tag-pill" onclick="removeTag(${i})">${esc(t)}</span>`).join('');
}

function saveEntry() {
  const title = document.getElementById('ed-title')?.value || '';
  const content = document.getElementById('ed-content')?.value || '';
  if (!title.trim()) { showToast('Add a title first!'); return; }

  const data = {
    category: state.editorCat, title, content,
    tags: state.editorTags, status: state.editorStatus,
    imageUrl: state.editorImageUrl || null,
  };

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
  state.editorImageUrl = null;
  navigate('editor', { editId: id });
}

// ── Character Editor Actions ──────────────────────────────────────────────────

function addCharTag() {
  const input = document.getElementById('char-desc-input');
  const val = input.value.trim().toLowerCase().replace(/,/g, '');
  if (val && !state.charTags.includes(val)) {
    state.charTags.push(val);
    renderCharTagsPreview();
  }
  input.value = '';
  input.focus();
}

function removeCharTag(i) {
  state.charTags.splice(i, 1);
  renderCharTagsPreview();
}

function renderCharTagsPreview() {
  const wrap = document.getElementById('char-tags-preview') || document.querySelector('.tags-preview');
  if (!wrap) return;
  wrap.innerHTML = state.charTags.map((t, i) =>
    `<span class="tag-pill" onclick="removeCharTag(${i})">${esc(t)}</span>`).join('');
}

function saveChar() {
  const name = document.getElementById('char-name')?.value || '';
  const rel  = document.getElementById('char-rel')?.value || '';
  if (!name.trim()) { showToast('Add a name!'); return; }

  const data = { name, relationship: rel, descriptors: state.charTags,
    notes: document.getElementById('char-notes')?.value || '' };

  if (state.editCharId) {
    updateChar(state.editCharId, data);
    showToast('Character updated ✓');
  } else {
    createChar(data);
    showToast('Added to cast ✓');
  }
  navigate('characters');
}

function confirmDeleteChar(id) {
  if (confirm('Remove this character?')) {
    deleteChar(id);
    showToast('Removed');
    navigate('characters');
  }
}

// ── Profile Actions ───────────────────────────────────────────────────────────

function addProfileTheme() {
  const input = document.getElementById('p-theme-input');
  const val = input.value.trim().toLowerCase().replace(/,/g, '');
  const profile = loadProfile();
  const themes = profile.themes || [];
  if (val && !themes.includes(val)) {
    themes.push(val);
    saveProfile({ ...profile, themes });
    const wrap = document.getElementById('profile-themes-preview');
    if (wrap) {
      wrap.innerHTML = themes.map((t, i) =>
        `<span class="tag-pill" onclick="removeProfileTheme(${i})">${esc(t)}</span>`).join('');
    }
  }
  input.value = '';
  input.focus();
}

function removeProfileTheme(i) {
  const profile = loadProfile();
  const themes = profile.themes || [];
  themes.splice(i, 1);
  saveProfile({ ...profile, themes });
  const wrap = document.getElementById('profile-themes-preview');
  if (wrap) {
    wrap.innerHTML = themes.map((t, idx) =>
      `<span class="tag-pill" onclick="removeProfileTheme(${idx})">${esc(t)}</span>`).join('');
  }
}

function saveProfile_() {
  const profile = loadProfile();
  saveProfile({
    ...profile,
    name:        document.getElementById('p-name')?.value || '',
    hometown:    document.getElementById('p-hometown')?.value || '',
    currentCity: document.getElementById('p-city')?.value || '',
    job:         document.getElementById('p-job')?.value || '',
    family:      document.getElementById('p-family')?.value || '',
    voice:       document.getElementById('p-voice')?.value || '',
    bio:         document.getElementById('p-bio')?.value || '',
  });
  showToast('Your story saved ✓');
  document.querySelector('header h1').innerHTML = '<span>Comedy</span>Vault';
}

function saveApiKey() {
  const key = document.getElementById('p-apikey')?.value.trim() || '';
  if (key) {
    localStorage.setItem('cv_api_key', key);
    showToast('API key saved ✓');
  } else {
    localStorage.removeItem('cv_api_key');
    showToast('API key removed');
  }
}

// ── Swipe Card Deck ───────────────────────────────────────────────────────────

const SWIPE_YESNO = [
  'Can you make this stranger?',
  'Does this feel true to you?',
  'Have you told this story out loud before?',
  'Is there a bigger laugh hiding in here?',
  'Would your mom be horrified?',
  'Could this open a set?',
  'Is there a callback opportunity here?',
  'Is the punchline in the wrong place?',
  'Can you cut the first 30%?',
  'Does this need a character?',
  'Have you fully committed to the bit?',
  'Is there a real emotion underneath this?',
];

const SWIPE_FILLIN = [
  'The weirdest part was ___',
  'Nobody talks about how ___ it is to ___',
  'I realized I was the problem when ___',
  'My ___ would describe me as ___',
  'The real joke is that ___',
  'It sounds fake but ___',
  "I've never told anyone that ___",
  'Everyone does this but nobody admits ___',
  'The version of me that ___ is still out there somewhere',
  'My ___ era was defined by ___',
];

let swipePool = [];
let swipeIdx  = 0;

function buildSwipePool() {
  const pool = [];
  loadEntries().forEach(e => pool.push({ type: 'entry', entry: e }));
  loadChars().forEach(c => pool.push({ type: 'char', char: c }));
  SWIPE_YESNO.forEach(q => pool.push({ type: 'yesno', text: q }));
  SWIPE_FILLIN.forEach(t => pool.push({ type: 'fillin', text: t }));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function renderSwipeCard(card) {
  if (!card) return `
    <div class="swipe-card swipe-empty" id="swipe-card">
      <div class="swipe-card-inner" style="text-align:center;gap:16px">
        <div class="swipe-type-label">All Done!</div>
        <div class="swipe-card-text">You've gone through everything.<br>Shuffle for another round.</div>
        <button class="btn-save" style="margin-top:16px"
          onclick="swipePool=buildSwipePool();swipeIdx=0;document.getElementById('swipe-container').innerHTML=renderSwipeCard(swipePool[0]);initSwipeGestures()">
          🔀 Shuffle Again
        </button>
      </div>
    </div>`;

  if (card.type === 'entry') {
    const col = catColor(card.entry.category);
    const preview = card.entry.content.slice(0, 220) + (card.entry.content.length > 220 ? '…' : '');
    return `
      <div class="swipe-card" id="swipe-card">
        <div class="swipe-card-inner">
          <div class="swipe-type-label" style="color:var(--${col})">${catIcon(card.entry.category)} ${catLabel(card.entry.category)}</div>
          <div class="swipe-card-title">${esc(card.entry.title)}</div>
          <div class="swipe-card-text">${esc(preview)}</div>
          <div class="swipe-hint-labels">
            <span class="swipe-hint">← Skip</span>
            <span class="swipe-hint">⭐ Star ↑</span>
            <span class="swipe-hint">↓ Use</span>
            <span class="swipe-hint">Develop →</span>
          </div>
        </div>
      </div>`;
  }

  if (card.type === 'char') {
    const desc = card.char.descriptors.slice(0,3).join(', ');
    return `
      <div class="swipe-card" id="swipe-card">
        <div class="swipe-card-inner">
          <div class="swipe-type-label" style="color:var(--memory)">👤 Character</div>
          <div class="swipe-card-title">${esc(card.char.name)}</div>
          <div class="swipe-card-text">${esc(card.char.relationship)}${desc ? ' · ' + esc(desc) : ''}</div>
          <div class="swipe-hint-labels">
            <span class="swipe-hint">← Skip</span>
            <span class="swipe-hint">Write About →</span>
          </div>
        </div>
      </div>`;
  }

  if (card.type === 'yesno') {
    return `
      <div class="swipe-card swipe-card-prompt" id="swipe-card">
        <div class="swipe-card-inner">
          <div class="swipe-type-label" style="color:var(--idea)">💬 Yes or No?</div>
          <div class="swipe-card-big">${esc(card.text)}</div>
          <div class="swipe-hint-labels">
            <span class="swipe-hint">← No</span>
            <span class="swipe-hint">Yes →</span>
          </div>
        </div>
      </div>`;
  }

  if (card.type === 'fillin') {
    return `
      <div class="swipe-card swipe-card-prompt" id="swipe-card">
        <div class="swipe-card-inner">
          <div class="swipe-type-label" style="color:var(--bit)">✏️ Fill In</div>
          <div class="swipe-card-big">${esc(card.text)}</div>
          <div class="swipe-hint-labels">
            <span class="swipe-hint">← Skip</span>
            <span class="swipe-hint">Write →</span>
          </div>
        </div>
      </div>`;
  }
  return '';
}

function renderSwipe() {
  if (!swipePool.length) swipePool = buildSwipePool();
  const card = swipePool[swipeIdx];
  const progress = swipeIdx < swipePool.length
    ? `${swipeIdx + 1} of ${swipePool.length}`
    : `Done! ${swipePool.length} cards`;
  return `
    <div class="swipe-progress">${progress}</div>
    <div class="swipe-container" id="swipe-container">
      ${renderSwipeCard(card)}
    </div>
    <div class="swipe-actions">
      <button class="swipe-action-btn" onclick="swipeAction('left')"  title="Skip">←</button>
      <button class="swipe-action-btn" onclick="swipeAction('up')"    title="Star">⭐</button>
      <button class="swipe-action-btn" onclick="swipeAction('down')"  title="Use as Prompt">📝</button>
      <button class="swipe-action-btn" onclick="swipeAction('right')" title="Develop">→</button>
    </div>`;
}

function swipeAdvance(dir) {
  const container = document.getElementById('swipe-container');
  const cardEl    = document.getElementById('swipe-card');
  if (cardEl) {
    const cls = { left: 'swipe-out-left', right: 'swipe-out-right', up: 'swipe-out-up', down: 'swipe-out-down' }[dir];
    cardEl.classList.add(cls);
  }
  swipeIdx = Math.min(swipeIdx + 1, swipePool.length);
  const prog = document.querySelector('.swipe-progress');
  if (prog) {
    prog.textContent = swipeIdx < swipePool.length
      ? `${swipeIdx + 1} of ${swipePool.length}`
      : `Done! ${swipePool.length} cards`;
  }
  setTimeout(() => {
    if (container) container.innerHTML = renderSwipeCard(swipePool[swipeIdx]);
    initSwipeGestures();
  }, 290);
}

function swipeAction(dir) {
  const card = swipePool[swipeIdx];
  if (!card) return;

  if (dir === 'up' && card.type === 'entry') {
    const entries = loadEntries();
    const i = entries.findIndex(e => e.id === card.entry.id);
    if (i !== -1) { entries[i].status = 'ready'; saveEntries(entries); showToast('⭐ Starred as Ready!'); }
    swipeAdvance(dir);
    return;
  }

  if (dir === 'down') {
    if (card.type === 'entry') {
      state.editorTags = []; state._editorInit = false;
      navigate('editor', { editId: null, editorCat: card.entry.category, editorStatus: 'developing' });
      setTimeout(() => {
        const ta = document.getElementById('ed-content');
        if (ta) ta.value = `Based on: ${card.entry.title}\n\n`;
      }, 60);
      return;
    }
    if (card.type === 'yesno' || card.type === 'fillin') {
      state.editorTags = []; state._editorInit = false;
      navigate('editor', { editId: null, editorCat: 'idea', editorStatus: 'raw' });
      setTimeout(() => {
        const ta = document.getElementById('ed-content');
        if (ta) ta.value = card.text + '\n\n';
      }, 60);
      return;
    }
  }

  if (dir === 'right') {
    if (card.type === 'entry') { navigate('detail', { detailId: card.entry.id }); return; }
    if (card.type === 'char') {
      state.editorTags = []; state._editorInit = false;
      navigate('editor', { editId: null, editorCat: 'memory', editorStatus: 'raw' });
      setTimeout(() => {
        const ta = document.getElementById('ed-content');
        if (ta) ta.value = `About ${card.char.name}: `;
      }, 60);
      return;
    }
    if (card.type === 'yesno' || card.type === 'fillin') {
      state.editorTags = []; state._editorInit = false;
      navigate('editor', { editId: null, editorCat: 'idea', editorStatus: 'raw' });
      setTimeout(() => {
        const ta = document.getElementById('ed-content');
        if (ta) ta.value = card.text + '\n\n';
      }, 60);
      return;
    }
  }

  swipeAdvance(dir);
}

function initSwipeGestures() {
  const card = document.getElementById('swipe-card');
  if (!card || card.classList.contains('swipe-empty')) return;

  let startX = 0, startY = 0, dragging = false;

  function onStart(x, y) { startX = x; startY = y; dragging = true; }

  function onMove(x, y) {
    if (!dragging) return;
    const dx = x - startX, dy = y - startY;
    card.style.transform  = `translate(${dx}px,${dy}px) rotate(${dx * 0.035}deg)`;
    card.style.transition = 'none';
    if (Math.abs(dx) > Math.abs(dy)) {
      card.style.boxShadow = dx > 40
        ? '0 8px 40px rgba(52,211,153,0.35), inset 0 1px 0 rgba(255,255,255,0.1)'
        : dx < -40 ? '0 8px 40px rgba(248,113,113,0.35), inset 0 1px 0 rgba(255,255,255,0.1)'
        : '';
    }
  }

  function onEnd(x, y) {
    if (!dragging) return;
    dragging = false;
    card.style.transition  = '';
    card.style.boxShadow   = '';
    const dx = x - startX, dy = y - startY;
    const T = 80;
    if (Math.abs(dx) > Math.abs(dy)) {
      if      (dx >  T) swipeAction('right');
      else if (dx < -T) swipeAction('left');
      else card.style.transform = '';
    } else {
      if      (dy < -T) swipeAction('up');
      else if (dy >  T) swipeAction('down');
      else card.style.transform = '';
    }
  }

  card.addEventListener('touchstart', e => { const t = e.touches[0]; onStart(t.clientX, t.clientY); }, { passive: true });
  card.addEventListener('touchmove',  e => { const t = e.touches[0]; onMove(t.clientX, t.clientY); },  { passive: true });
  card.addEventListener('touchend',   e => { const t = e.changedTouches[0]; onEnd(t.clientX, t.clientY); });
  card.addEventListener('mousedown',  e => onStart(e.clientX, e.clientY));

  const onMM = e => { if (dragging) onMove(e.clientX, e.clientY); };
  const onMU = e => { if (dragging) onEnd(e.clientX, e.clientY); };
  document.addEventListener('mousemove', onMM);
  document.addEventListener('mouseup',   onMU, { once: false });
}

// ── Main Render ───────────────────────────────────────────────────────────────

const SCREEN_CFG = {
  home:             { el: 'home-screen',        fn: renderHome,            title: () => '<span>Comedy</span>Vault', back: false, fab: true,  nav: 'home'       },
  list:             { el: 'list-screen',         fn: renderList,            title: () => `${catIcon(state.listCat)} ${catLabel(state.listCat)}`, back: true, fab: true, nav: null },
  editor:           { el: 'editor-screen',       fn: renderEditor,          title: () => state.editId ? 'Edit Entry' : 'New Entry', back: true, fab: false, nav: null },
  detail:           { el: 'detail-screen',       fn: renderDetail,          title: () => '', back: true, fab: false, nav: null },
  search:           { el: 'search-screen',       fn: renderSearch,          title: () => 'Search', back: false, fab: false, nav: null },
  characters:       { el: 'characters-screen',   fn: renderCharacters,      title: () => '👥 Your Cast', back: false, fab: true, nav: 'characters' },
  'character-editor':{ el: 'char-editor-screen', fn: renderCharacterEditor, title: () => state.editCharId ? 'Edit Person' : 'Add Person', back: true, fab: false, nav: null },
  profile:          { el: 'profile-screen',      fn: renderProfile,         title: () => '🪞 My Story', back: false, fab: false, nav: 'profile' },
  prompts:          { el: 'prompts-screen',      fn: renderPrompts,         title: () => '🎤 Prompt Me', back: false, fab: false, nav: 'prompts' },
  swipe:            { el: 'swipe-screen',        fn: renderSwipe,           title: () => '🃏 Card Deck', back: false, fab: false, nav: 'swipe'   },
};

function renderApp() {
  const cfg = SCREEN_CFG[state.screen];
  if (!cfg) return;

  // Show active screen
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const activeEl = document.getElementById(cfg.el);
  if (activeEl) {
    activeEl.innerHTML = cfg.fn();
    activeEl.classList.add('active');
    if (state.screen === 'swipe') initSwipeGestures();
  }

  // Header
  document.querySelector('header h1').innerHTML = cfg.title();
  document.getElementById('back-btn').classList.toggle('visible', cfg.back);
  const searchBtn = document.getElementById('search-btn');
  searchBtn.classList.toggle('hidden', state.screen === 'search' || state.screen === 'editor');

  // FAB
  document.getElementById('fab-wrap').classList.toggle('hidden', !cfg.fab);

  // Nav
  document.querySelectorAll('nav#bottom-nav button').forEach(b => {
    b.classList.toggle('active', cfg.nav && b.dataset.screen === cfg.nav);
  });
}

// ── Back Button ───────────────────────────────────────────────────────────────

function goBack() {
  if (fabOpen) { closeFab(); return; }
  switch (state.screen) {
    case 'editor':
      state._editorInit = false;
      if (state.editId) navigate('detail', { detailId: state.editId });
      else if (state.listCat) navigate('list');
      else navigate('home');
      break;
    case 'detail':
      if (state.listCat) navigate('list');
      else navigate('home');
      break;
    case 'list':
      navigate('home');
      break;
    case 'character-editor':
      navigate('characters');
      break;
    default:
      navigate('home');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  getSyncToken(); // ensure token exists before anything else

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  initFab();

  document.getElementById('back-btn').addEventListener('click', goBack);
  window.addEventListener('popstate', goBack);

  document.querySelectorAll('nav#bottom-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      if (screen) navigate(screen);
    });
  });

  // Render immediately with local data, then refresh with cloud data
  renderApp();
  syncPull().then(ok => { if (ok) renderApp(); }).catch(() => {});
});
