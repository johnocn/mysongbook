import { CONFIG } from './config.js';
import { getToken, signOut } from './auth.js';

const API = 'https://www.googleapis.com/drive/v3';
const UP = 'https://www.googleapis.com/upload/drive/v3';
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const json = { 'Content-Type': 'application/json' };

async function call(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${getToken()}`, ...opts.headers } });
  if (res.status === 401) { signOut(); throw Object.assign(new Error('Session expired'), { code: 'AUTH' }); }
  if (!res.ok) throw new Error(`Google Drive error (${res.status})`);
  return res;
}

export async function folderId() {
  let id = localStorage.getItem('sb.folder');
  if (id) return id;
  const q = encodeURIComponent(`name='${esc(CONFIG.FOLDER_NAME)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  id = (await (await call(`${API}/files?q=${q}&fields=files(id)`)).json()).files[0]?.id;
  if (!id) {
    const body = JSON.stringify({ name: CONFIG.FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' });
    id = (await (await call(`${API}/files`, { method: 'POST', headers: json, body })).json()).id;
  }
  localStorage.setItem('sb.folder', id);
  return id;
}

// Title/artist/key live in appProperties so the library lists without downloading every file.
export async function listSongs() {
  const q = encodeURIComponent(`'${await folderId()}' in parents and trashed=false`);
  const out = [];
  let page = '';
  do {
    const url = `${API}/files?q=${q}&pageSize=200&fields=nextPageToken,files(id,modifiedTime,appProperties)${page ? `&pageToken=${page}` : ''}`;
    const r = await (await call(url)).json();
    out.push(...r.files.map(f => ({
      id: f.id, modified: f.modifiedTime,
      title: f.appProperties?.title || 'Untitled', artist: f.appProperties?.artist || '', key: f.appProperties?.key || '',
    })));
    page = r.nextPageToken;
  } while (page);
  return out;
}

export async function getSong(id) {
  return (await call(`${API}/files/${encodeURIComponent(id)}?alt=media`)).text();
}

export async function saveSong({ id, meta, body }) {
  const clip = s => (s || '').slice(0, 100);
  const md = {
    name: `${clip(meta.title).replace(/[\\/]/g, '-')}.cho`,
    appProperties: { title: clip(meta.title), artist: clip(meta.artist), key: clip(meta.key) },
    ...(id ? {} : { parents: [await folderId()] }),
  };
  const b = 'sb' + Date.now();
  const payload = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(md)}\r\n--${b}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}\r\n--${b}--`;
  const res = await call(`${UP}/files${id ? '/' + encodeURIComponent(id) : ''}?uploadType=multipart&fields=id`, {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body: payload,
  });
  return (await res.json()).id;
}

// Moves to Drive trash (recoverable for 30 days) rather than deleting permanently.
export const trashSong = id => call(`${API}/files/${encodeURIComponent(id)}`, { method: 'PATCH', headers: json, body: JSON.stringify({ trashed: true }) });
