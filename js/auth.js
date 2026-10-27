import { CONFIG } from './config.js';
const KEY = 'sb.auth';
let session = null;

const authError = () => Object.assign(new Error('Session expired'), { code: 'AUTH' });

function loadGsi() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Google sign-in. Check your connection.'));
    document.head.append(s);
  });
}

export function restore() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY));
    if (s && s.exp > Date.now() + 60000) session = s;
  } catch { /* ignore */ }
  return !!session;
}
export const isSignedIn = () => !!session && session.exp > Date.now() + 30000;
export const user = () => session?.user || null;
export function getToken() {
  if (!isSignedIn()) throw authError();
  return session.token;
}

export async function signIn() {
  await loadGsi();
  const token = await new Promise((resolve, reject) => {
    google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: r => (r.error ? reject(new Error(r.error_description || r.error)) : resolve(r)),
      error_callback: e => reject(new Error(e.type === 'popup_closed' ? 'Sign-in cancelled.' : 'Sign-in failed.')),
    }).requestAccessToken();
  });
  const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }).then(r => (r.ok ? r.json() : {}));
  session = { token: token.access_token, exp: Date.now() + token.expires_in * 1000, user: info };
  sessionStorage.setItem(KEY, JSON.stringify(session));
  return info;
}

export function signOut() {
  if (session && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(session.token);
  session = null;
  sessionStorage.removeItem(KEY);
  ['sb.folder', 'sb.songs'].forEach(k => localStorage.removeItem(k));
}
