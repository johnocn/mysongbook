import { CONFIG } from './config.js';
import * as auth from './auth.js';
import * as drive from './drive.js';
import { parse, render, keyAfter } from './chordpro.js';
import { h, Button, Icon, SongCard, Stat, Empty, Spinner, AppBar, TabBar, toast, confirmDialog } from './components.js';

const root = document.getElementById('app');
const state = { songs: null, bodies: new Map() };
const THEME = 'sb.theme';
const mq = matchMedia('(prefers-color-scheme:dark)');
const TEMPLATE = '{title: }\n{artist: }\n{key: G}\n\n{start_of_verse}\n[G]Amazing [C]grace, how [G]sweet the sound\n{end_of_verse}\n\n{start_of_chorus}\n[D]Chorus lyrics go [G]here\n{end_of_chorus}\n';

/* ---------- helpers ---------- */
function applyTheme() {
  const m = localStorage.getItem(THEME) || 'system';
  document.documentElement.dataset.theme = m === 'system' ? (mq.matches ? 'dark' : 'light') : m;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
}
mq.addEventListener('change', applyTheme);
const fontSize = () => Number(localStorage.getItem('sb.fs')) || 17;
const setFont = px => { localStorage.setItem('sb.fs', px); document.documentElement.style.setProperty('--fs', px + 'px'); };

function shell({ title, tab, back, actions }, ...body) {
  const main = h('main', {}, ...body);
  root.replaceChildren(h('div', { class: 'shell' }, AppBar(title, { back, actions }), main), ...(tab ? [TabBar(tab)] : []));
  window.scrollTo(0, 0);
  return main;
}

async function loadSongs(force = false) {
  if (state.songs && !force) return state.songs;
  try {
    state.songs = await drive.listSongs();
    localStorage.setItem('sb.songs', JSON.stringify(state.songs));
  } catch (e) {
    const cached = localStorage.getItem('sb.songs');
    if (e.code === 'AUTH' || !cached) throw e;
    state.songs = JSON.parse(cached);
    toast('Offline — showing saved list');
  }
  return state.songs;
}
async function loadBody(id) {
  if (!state.bodies.has(id)) state.bodies.set(id, await drive.getSong(id));
  return state.bodies.get(id);
}

/* ---------- views ---------- */
function login(msg) {
  const missing = CONFIG.CLIENT_ID.startsWith('YOUR_');
  const btn = Button('Continue with Google', async () => {
    btn.disabled = true;
    try { await auth.signIn(); route(); } catch (e) { login(e.message); }
  });
  root.replaceChildren(h('div', { class: 'login' },
    h('img', { src: 'icon.svg', width: 72, height: 72, alt: '' }),
    h('h1', {}, 'SongBook'),
    h('p', { class: 'muted' }, 'Your ChordPro library, synced with Google Drive.'),
    missing ? h('p', { class: 'error' }, 'Set CLIENT_ID in js/config.js (see README).') : btn,
    msg ? h('p', { class: 'error', role: 'alert' }, msg) : null));
}

async function dashboard() {
  const main = shell({ title: 'SongBook', tab: 'home' }, Spinner());
  const songs = await loadSongs();
  const recent = [...songs].sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, 5);
  main.replaceChildren(
    h('p', { class: 'muted' }, `Welcome${auth.user()?.given_name ? ', ' + auth.user().given_name : ''}.`),
    h('div', { class: 'grid' },
      Stat('Songs', songs.length),
      Stat('Artists', new Set(songs.map(s => s.artist).filter(Boolean)).size),
      Stat('Keys', new Set(songs.map(s => s.key).filter(Boolean)).size)),
    h('div', { class: 'row' },
      Button('New song', () => (location.hash = '#/edit/new'), { icon: 'plus' }),
      Button('Browse', () => (location.hash = '#/songs'), { variant: 'ghost', icon: 'music' })),
    h('h2', {}, 'Recently updated'),
    recent.length ? recent.map(SongCard) : Empty('No songs yet. Create your first one.'));
}

async function library() {
  const main = shell({ title: 'Songs', tab: 'songs' }, Spinner());
  const songs = [...(await loadSongs())].sort((a, b) => a.title.localeCompare(b.title));
  const list = h('div');
  const draw = q => {
    const s = q.trim().toLowerCase();
    const found = songs.filter(x => `${x.title} ${x.artist}`.toLowerCase().includes(s));
    list.replaceChildren(...(found.length ? found.map(SongCard) : [Empty(songs.length ? 'No matches.' : 'No songs yet.')]));
  };
  main.replaceChildren(h('input', { type: 'search', class: 'input', placeholder: 'Search title or artist', 'aria-label': 'Search songs', onInput: e => draw(e.target.value) }), list);
  draw('');
}

async function viewer(id) {
  shell({ title: '', back: '#/songs' }, Spinner());
  const song = parse(await loadBody(id));
  let n = 0, chords = true;
  const out = h('article', { class: 'song' });
  const keyLbl = h('span', { class: 'badge' });
  const draw = () => {
    out.replaceChildren(render(song, { semitones: n, chords }));
    keyLbl.textContent = song.meta.key ? `Key ${keyAfter(song.meta.key, n)}` : `${n > 0 ? '+' : ''}${n}`;
  };
  const move = d => () => { n = (n + d + 12) % 12 > 6 ? (n + d + 12) % 12 - 12 : (n + d + 12) % 12; draw(); };
  const toggle = Button('Chords', () => { chords = !chords; toggle.className = `btn btn-${chords ? 'primary' : 'ghost'}`; draw(); });
  const del = async () => {
    if (!(await confirmDialog(`Move “${song.meta.title || 'this song'}” to Drive trash?`))) return;
    try { await drive.trashSong(id); await loadSongs(true); location.hash = '#/songs'; } catch (e) { toast(e.message, 'error'); }
  };
  shell({ title: song.meta.title || 'Untitled', back: '#/songs', actions: [
    h('a', { class: 'btn btn-ghost btn-icon', href: `#/edit/${id}`, 'aria-label': 'Edit' }, Icon('edit')),
    Button('', del, { variant: 'ghost', icon: 'trash', 'aria-label': 'Delete' })] },
    h('p', { class: 'muted' }, [song.meta.artist, song.meta.capo && `Capo ${song.meta.capo}`].filter(Boolean).join(' · ')),
    h('div', { class: 'row' },
      Button('−', move(-1), { variant: 'ghost', 'aria-label': 'Transpose down' }), keyLbl,
      Button('+', move(1), { variant: 'ghost', 'aria-label': 'Transpose up' }), toggle,
      Button('A−', () => setFont(Math.max(12, fontSize() - 1)), { variant: 'ghost', 'aria-label': 'Smaller text' }),
      Button('A+', () => setFont(Math.min(32, fontSize() + 1)), { variant: 'ghost', 'aria-label': 'Larger text' })),
    out);
  draw();
}

async function editor(id) {
  const isNew = id === 'new';
  const main = shell({ title: isNew ? 'New song' : 'Edit song', back: isNew ? '#/songs' : `#/song/${id}` }, Spinner());
  const ta = h('textarea', { class: 'editor', spellcheck: false, value: isNew ? TEMPLATE : await loadBody(id), 'aria-label': 'ChordPro source' });
  const preview = h('div', { class: 'song', hidden: true });
  let previewing = false;
  const toggle = Button('Preview', () => {
    previewing = !previewing;
    if (previewing) preview.replaceChildren(render(parse(ta.value)));
    ta.hidden = previewing; preview.hidden = !previewing;
    toggle.textContent = previewing ? 'Edit' : 'Preview';
  }, { variant: 'ghost' });
  const save = Button('Save', async () => {
    const meta = parse(ta.value).meta;
    if (!meta.title?.trim()) return toast('Add a {title: …} line first', 'error');
    save.disabled = true;
    try {
      const newId = await drive.saveSong({ id: isNew ? null : id, meta, body: ta.value });
      state.bodies.set(newId, ta.value);
      await loadSongs(true);
      toast('Saved');
      location.hash = `#/song/${newId}`;
    } catch (e) { save.disabled = false; e.code === 'AUTH' ? fail(e) : toast(e.message, 'error'); }
  });
  main.replaceChildren(h('div', { class: 'row' }, toggle, save), ta, preview);
}

let installPrompt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });

async function settings() {
  const cur = localStorage.getItem(THEME) || 'system';
  const u = auth.user();
  const themeBtn = m => Button(m[0].toUpperCase() + m.slice(1), () => { localStorage.setItem(THEME, m); applyTheme(); settings(); }, { variant: cur === m ? 'primary' : 'ghost' });
  const fid = localStorage.getItem('sb.folder');
  shell({ title: 'Settings', tab: 'settings' },
    h('h2', {}, 'Appearance'), h('div', { class: 'row' }, ['system', 'light', 'dark'].map(themeBtn)),
    h('h2', {}, 'Account'),
    h('div', { class: 'card block' }, h('strong', {}, u?.name || 'Signed in'), h('div', { class: 'muted sm' }, u?.email || '')),
    h('div', { class: 'row' },
      fid ? h('a', { class: 'btn btn-ghost', href: `https://drive.google.com/drive/folders/${fid}`, target: '_blank', rel: 'noopener' }, 'Open Drive folder') : null,
      Button('Refresh songs', async () => { try { await loadSongs(true); toast('Library refreshed'); } catch (e) { fail(e); } }, { variant: 'ghost' }),
      Button('Sign out', () => { auth.signOut(); state.songs = null; state.bodies.clear(); login(); }, { variant: 'danger' })),
    h('h2', {}, 'Install'),
    installPrompt ? Button('Install app', async () => { installPrompt.prompt(); installPrompt = null; settings(); }) : h('p', { class: 'muted sm' }, 'Use your browser menu → “Add to Home Screen” (iOS: Share → Add to Home Screen).'));
}

/* ---------- router ---------- */
const routes = [[/^#\/?$/, dashboard], [/^#\/songs$/, library], [/^#\/song\/(.+)$/, viewer], [/^#\/edit\/(.+)$/, editor], [/^#\/settings$/, settings]];

function fail(e) {
  if (e.code === 'AUTH') return login('Session expired. Please sign in again.');
  shell({ title: 'Something went wrong', tab: 'home' }, Empty(e.message || 'Unexpected error.', h('div', { class: 'row', style: 'justify-content:center' }, Button('Retry', route))));
}

async function route() {
  if (!auth.isSignedIn()) return login();
  for (const [re, fn] of routes) {
    const m = (location.hash || '#/').match(re);
    if (m) { try { await fn(...m.slice(1).map(decodeURIComponent)); } catch (e) { fail(e); } return; }
  }
  location.hash = '#/';
}

applyTheme();
setFont(fontSize());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
auth.restore();
addEventListener('hashchange', route);
route();
