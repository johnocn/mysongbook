// Tiny reusable UI kit. All text goes through DOM text nodes, so song content can never inject HTML.
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat(Infinity).filter(k => k != null && k !== false));
  return el;
}

const PATHS = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  plus: 'M12 5v14M5 12h14',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  back: 'M15 18l-6-6 6-6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
};
export function Icon(name, size = 20) {
  const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
  Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }).forEach(([k, v]) => s.setAttribute(k, v));
  p.setAttribute('d', PATHS[name]); s.append(p);
  return s;
}

export const Button = (label, onClick, { variant = 'primary', icon, ...rest } = {}) =>
  h('button', { type: 'button', class: `btn btn-${variant}${icon && !label ? ' btn-icon' : ''}`, onClick, ...rest }, icon && Icon(icon), label);
export const Spinner = () => h('div', { class: 'spinner', role: 'status', 'aria-label': 'Loading' });
export const Empty = (msg, ...extra) => h('div', { class: 'empty muted' }, h('p', {}, msg), ...extra);
export const Stat = (label, value) => h('div', { class: 'stat' }, h('b', {}, value), h('span', {}, label));
export const SongCard = s => h('a', { class: 'card', href: `#/song/${s.id}` },
  h('div', {}, h('strong', {}, s.title), h('div', { class: 'muted sm' }, s.artist || 'Unknown artist')),
  s.key ? h('span', { class: 'badge' }, s.key) : null);

export const AppBar = (title, { back, actions = [] } = {}) => h('header', { class: 'appbar' },
  back ? h('a', { class: 'btn btn-ghost btn-icon', href: back, 'aria-label': 'Back' }, Icon('back')) : null,
  h('h1', {}, title), ...actions);

const TABS = [['home', 'Home', '#/', 'home'], ['songs', 'Songs', '#/songs', 'music'], ['new', 'New', '#/edit/new', 'plus'], ['settings', 'Settings', '#/settings', 'sliders']];
export const TabBar = active => h('nav', { class: 'tabbar', 'aria-label': 'Main' },
  TABS.map(([id, label, href, icon]) => h('a', { href, class: id === active ? 'on' : '', 'aria-current': id === active ? 'page' : null }, Icon(icon, 22), label)));

export function toast(msg, type = 'info') {
  let box = document.getElementById('toasts');
  if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: `toast ${type}` }, msg);
  box.append(t);
  setTimeout(() => t.remove(), 3500);
}

export const confirmDialog = (msg, okLabel = 'Delete') => new Promise(resolve => {
  const d = h('dialog', { class: 'modal' }, h('p', {}, msg),
    h('div', { class: 'row end' }, Button('Cancel', () => d.close('no'), { variant: 'ghost' }), Button(okLabel, () => d.close('yes'), { variant: 'danger' })));
  d.addEventListener('close', () => { resolve(d.returnValue === 'yes'); d.remove(); });
  document.body.append(d);
  d.showModal();
});
