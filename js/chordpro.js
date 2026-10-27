import { h } from './components.js';

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_ROOTS = new Set([1, 3, 5, 8, 10]);
const META = { t: 'title', title: 'title', st: 'subtitle', subtitle: 'subtitle', a: 'artist', artist: 'artist', key: 'key', capo: 'capo', tempo: 'tempo' };
const START = { soc: 'chorus', start_of_chorus: 'chorus', sov: 'verse', start_of_verse: 'verse', sob: 'bridge', start_of_bridge: 'bridge', sot: 'tab', start_of_tab: 'tab' };
const END = /^(eoc|end_of_chorus|eov|end_of_verse|eob|end_of_bridge|eot|end_of_tab)$/;
const idx = n => { const i = SHARP.indexOf(n); return i < 0 ? FLAT.indexOf(n) : i; };

function segments(line) {
  const out = [], re = /\[([^\]]*)\]/g;
  let chord = null, last = 0, m;
  while ((m = re.exec(line))) {
    const text = line.slice(last, m.index);
    if (chord !== null || text) out.push({ chord, text });
    chord = m[1]; last = re.lastIndex;
  }
  const tail = line.slice(last);
  if (chord !== null || tail) out.push({ chord, text: tail });
  return out;
}

export function parse(src = '') {
  const meta = {}, lines = [];
  let sec = null;
  for (const raw of src.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('#')) continue;
    const d = line.match(/^\s*\{\s*(\w+)\s*(?::\s*(.*?))?\s*\}\s*$/);
    if (d) {
      const name = d[1].toLowerCase(), val = d[2] || '';
      if (META[name]) meta[META[name]] = val;
      else if (START[name]) { sec = START[name]; lines.push({ type: 'label', text: val || (sec === 'chorus' ? 'Chorus' : '') }); }
      else if (END.test(name)) sec = null;
      else if (/^(c|comment|ci|comment_italic)$/.test(name)) lines.push({ type: 'comment', text: val });
      continue;
    }
    if (!line.trim()) lines.push({ type: 'gap' });
    else if (sec === 'tab') lines.push({ type: 'tab', text: line, sec });
    else lines.push({ type: 'lyric', segs: segments(line), sec });
  }
  return { meta, lines };
}

export function transposeChord(chord, n, flat) {
  const m = chord.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!m) return chord;
  const sh = x => (flat ? FLAT : SHARP)[(idx(x) + n + 120) % 12];
  return sh(m[1]) + m[2] + (m[3] ? '/' + sh(m[3]) : '');
}

const prefersFlat = (key, n) => { const r = key?.match(/^[A-G][#b]?/)?.[0]; return r ? FLAT_ROOTS.has((idx(r) + n + 120) % 12) : false; };
export const keyAfter = (key, n) => (key && n ? transposeChord(key, n, prefersFlat(key, n)) : key || '');

export function render(song, { semitones = 0, chords = true } = {}) {
  const flat = prefersFlat(song.meta.key, semitones);
  return h('div', {}, song.lines.map(l => {
    if (l.type === 'gap') return h('div', { class: 'gap' });
    if (l.type === 'label') return l.text ? h('div', { class: 'label' }, l.text) : null;
    if (l.type === 'comment') return h('div', { class: 'comment' }, l.text);
    if (l.type === 'tab') return h('pre', { class: 'tab' }, l.text);
    const cls = l.sec === 'chorus' ? ' chorus' : '';
    if (!chords || l.segs.every(s => s.chord === null)) return h('div', { class: 'plain' + cls }, l.segs.map(s => s.text).join(''));
    return h('div', { class: 'line' + cls }, l.segs.map(s => h('span', { class: 'seg' },
      h('span', { class: 'ch' }, s.chord === null ? ' ' : transposeChord(s.chord, semitones, flat)),
      h('span', { class: 'ly' }, s.text || '\u00a0'))));
  }));
}
