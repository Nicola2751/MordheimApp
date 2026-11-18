import { STAT_KEYS } from './types.ts';
import type {
  AppState, Band, BandTemplate, EquipmentItem, LogEntry, Model, Settings, Stats, TableDef, TableRow, UnitTemplate,
} from './types.ts';

export const uid = (): string => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 5);

export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ---------- dadi e tabelle ---------- */
export interface DieInfo {
  d66: boolean;
  min: number;
  max: number;
  count: number;
  sides: number;
  dyn: boolean; // "Nd6": numero di dadi scelto al momento
  label: string;
}

export function dieInfo(die: string, n = 1): DieInfo {
  let s = String(die || 'd6').trim();
  if (/^d66$/i.test(s)) return { d66: true, min: 11, max: 66, count: 2, sides: 6, dyn: false, label: 'd66' };
  const dyn = /^n/i.test(s);
  s = s.replace(/^n/i, '');
  const m = /^(\d*)d(\d+)$/i.exec(s) ?? ['', '1', '6'];
  const sides = Number(m[2]) || 6;
  const count = dyn ? Math.max(1, Math.min(20, num(n) || 1)) : m[1] ? Number(m[1]) : 1;
  return { d66: false, min: count, max: count * sides, count, sides, dyn, label: `${count}d${sides}` };
}

export type Rng = (sides: number) => number; // restituisce 1..sides

export const defaultRng: Rng = (k) => {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return (a[0] as number) % k + 1;
};

export function rollDie(info: DieInfo, rng: Rng = defaultRng): { value: number; detail: string } {
  if (info.d66) {
    const a = rng(6);
    const b = rng(6);
    return { value: a * 10 + b, detail: `${a} e ${b}` };
  }
  const ds = Array.from({ length: info.count }, () => rng(info.sides));
  return { value: ds.reduce((x, y) => x + y, 0), detail: ds.join(' + ') };
}

export function isValidRoll(info: DieInfo, v: number): boolean {
  if (!Number.isInteger(v) || v < info.min || v > info.max) return false;
  return info.d66 ? v % 10 >= 1 && v % 10 <= 6 : true;
}

export function matchRow(t: TableDef, roll: string | number): TableRow | null {
  if (roll === '' || roll === null) return null;
  const v = Number(roll);
  if (!Number.isFinite(v)) return null;
  return t.rows.find((r) => v >= num(r.from) && v <= Math.max(num(r.from), num(r.to) || num(r.from))) ?? null;
}

export function effectsText(r: TableRow): string[] {
  const out: string[] = [];
  if (num(r.gold)) out.push(`${num(r.gold) > 0 ? '+' : ''}${num(r.gold)} corone`);
  if (num(r.shards)) out.push(`${num(r.shards) > 0 ? '+' : ''}${num(r.shards)} schegge`);
  if (r.item) out.push(r.item);
  return out;
}

/* ---------- bande ---------- */
export function thresholds(m: Model, set: Settings): number[] {
  return String(m.kind === 'hero' ? set.heroAdv : set.henchAdv).split(',').map(Number).filter((n) => n > 0);
}
export const nextThreshold = (m: Model, set: Settings): number | undefined => thresholds(m, set)[num(m.adv)];
export function advReady(m: Model, set: Settings): boolean {
  const t = nextThreshold(m, set);
  return t !== undefined && num(m.xp) >= t;
}

export function bandStats(b: Band, set: Settings): { models: number; value: number; rating: number } {
  let models = 0, value = 0, rating = 0;
  for (const m of b.models) {
    if (m.dead) continue;
    const c = m.kind === 'hench' ? Math.max(1, num(m.count)) : 1;
    models += c;
    value += num(m.cost) * c;
    rating += c * (num(set.baseRating) + num(m.xp));
  }
  return { models, value, rating };
}

export interface StandingRow { band: Band; p: number; w: number; d: number; l: number; pts: number }

export function standings(s: AppState): StandingRow[] {
  const set = s.campaign.settings;
  const map = new Map<string, StandingRow>(s.bands.map((b) => [b.id, { band: b, p: 0, w: 0, d: 0, l: 0, pts: 0 }]));
  for (const m of s.matches) {
    const A = map.get(m.a), B = map.get(m.b);
    if (!A || !B) continue;
    A.p++; B.p++;
    if (m.result === 'a') { A.w++; B.l++; A.pts += num(set.ptsWin); B.pts += num(set.ptsLoss); }
    else if (m.result === 'b') { B.w++; A.l++; B.pts += num(set.ptsWin); A.pts += num(set.ptsLoss); }
    else { A.d++; B.d++; A.pts += num(set.ptsDraw); B.pts += num(set.ptsDraw); }
  }
  return [...map.values()].sort((x, y) => y.pts - x.pts || y.w - x.w);
}

export const blankStats = (): Stats => {
  const s = {} as Stats;
  for (const k of STAT_KEYS) s[k] = k === 'M' ? 4 : k === 'Ld' ? 7 : k === 'Fe' || k === 'A' ? 1 : 3;
  return s;
};

export function newModel(kind: 'hero' | 'hench'): Model {
  return {
    id: uid(), kind, name: kind === 'hero' ? 'Nuovo eroe' : 'Nuovi seguaci', role: '', count: kind === 'hero' ? 1 : 3,
    stats: blankStats(), equip: '', skills: '', injuries: '', xp: 0, adv: 0, cost: 0, dead: false,
  };
}

export function modelFromTemplate(t: UnitTemplate, kind: 'hero' | 'hench', opts: { hired?: boolean; count?: number } = {}): Model {
  return {
    id: uid(), kind, ...(opts.hired ? { hired: true } : {}), name: t.name, role: t.role,
    count: kind === 'hench' ? Math.max(1, opts.count ?? 1) : 1,
    stats: { ...blankStats(), ...t.stats }, equip: t.equip ?? '', skills: t.skills ?? '', injuries: '',
    xp: 0, adv: 0, cost: num(t.cost), dead: false,
  };
}

export function newBand(set: Settings, tpl?: BandTemplate): Band {
  return {
    id: uid(), at: Date.now(), name: tpl ? tpl.name : 'Nuova banda', type: tpl ? tpl.name : '', ...(tpl ? { templateId: tpl.id } : {}),
    player: '', gold: tpl ? num(tpl.startGold) : num(set.startGold), shards: 0, notes: '', stash: [], models: [],
  };
}

/** Compra un oggetto per un guerriero. Restituisce un messaggio d'errore oppure null. */
export function buyItem(b: Band, m: Model, item: EquipmentItem): string | null {
  const price = num(item.cost);
  if (num(b.gold) < price) return `Servono ${price} corone, la banda ne ha ${num(b.gold)}.`;
  b.gold = num(b.gold) - price;
  m.equip = m.equip.trim() ? `${m.equip}, ${item.name}` : item.name;
  return null;
}

/** Applica una riga di tabella di esplorazione alla banda e restituisce la voce di diario. */
export function applyRow(b: Band, t: TableDef, roll: string | number, r: TableRow, week: number): LogEntry {
  b.gold = num(b.gold) + num(r.gold);
  b.shards = Math.max(0, num(b.shards) + num(r.shards));
  if (r.item) b.stash.push(r.item);
  const fx = effectsText(r);
  return {
    id: uid(), at: Date.now(), week: num(week), band: b.id,
    text: `${t.name}, tiro ${roll}: ${r.title}${fx.length ? ` (${fx.join(', ')})` : ''}`,
  };
}

/* ---------- dati iniziali ---------- */
const row = (from: number, to: number, title: string, text: string, o: Partial<Pick<TableRow, 'gold' | 'shards' | 'item'>> = {}): TableRow => ({
  id: uid(), from, to, title, text, gold: o.gold ?? 0, shards: o.shards ?? 0, item: o.item ?? '',
});

export function defaultTables(): TableDef[] {
  const at = Date.now();
  return [
    { id: 't-expl', at, name: 'Esplorazione', die: 'Nd6', note: 'Dopo la battaglia: un d6 per ogni eroe che esplora. Inserisci la somma dei dadi.', rows: [
      row(1, 5, 'Solo polvere e macerie', 'Gli eroi tornano a mani vuote.'),
      row(6, 8, 'Qualche moneta tra i detriti', 'Una borsa strappata a uno scheletro.', { gold: 15 }),
      row(9, 11, 'Un bagliore verde', 'Una scheggia di pietra magica incastrata in un muro.', { shards: 1 }),
      row(12, 14, 'Cantina dimenticata', 'Una scheggia e un po’ di denaro.', { shards: 1, gold: 20 }),
      row(15, 17, 'Cadavere ben equipaggiato', 'Il bottino è un oggetto comune a scelta.', { item: 'Oggetto comune' }),
      row(18, 21, 'Vena di pietra magica', 'Due schegge raccolte con cautela.', { shards: 2 }),
      row(22, 25, 'Magazzino di un mercante', 'Schegge e monete nascoste sotto il pavimento.', { shards: 2, gold: 30 }),
      row(26, 29, 'Cripta contaminata', 'Tre schegge, ma l’aria è pesante.', { shards: 3 }),
      row(30, 33, 'Baule sigillato', 'Dentro c’è un oggetto raro.', { item: 'Oggetto raro' }),
      row(34, 36, 'Il tesoro di un nobile', 'Quattro schegge e una fortuna.', { shards: 4, gold: 50 }),
    ] },
    { id: 't-inj', at: at + 1, name: 'Ferite gravi', die: 'd66', note: 'Per un eroe messo fuori combattimento. Tira due d6: il primo è la decina, il secondo l’unità (11–66).', rows: [
      row(11, 15, 'Morto', 'L’eroe non si rialza. Rimuovilo dalla banda.'),
      row(16, 21, 'Ferita multipla', 'Salta la prossima battaglia, poi si riprende.'),
      row(22, 25, 'Gamba spezzata', 'Movimento ridotto in modo permanente.'),
      row(26, 31, 'Braccio malconcio', 'Perde forza nei colpi per le prossime partite.'),
      row(32, 35, 'Ferita alla testa', 'Resta stordito, rischia di perdere un turno.'),
      row(36, 41, 'Ferita al torace', 'Cicatrice profonda, Resistenza a rischio.'),
      row(42, 45, 'Cicatrice vistosa', 'Solo un segno, nessun danno grave.'),
      row(46, 55, 'Pieno recupero', 'Si rialza senza conseguenze.'),
      row(56, 63, 'Notte febbrile', 'Ripreso, ma salta la fase di esplorazione.'),
      row(64, 66, 'Salvato dai compagni', 'Nessuna conseguenza e un po’ di esperienza.'),
    ] },
    { id: 't-evt', at: at + 2, name: 'Eventi in città', die: 'd6', note: 'Un evento casuale per ogni settimana di campagna.', rows: [
      row(1, 1, 'Notte di nebbia', 'Nessun effetto, ma tutti dormono male.'),
      row(2, 2, 'Mercante di passaggio', 'Una banda a scelta può comprare un oggetto comune a metà prezzo.'),
      row(3, 3, 'Rissa in taverna', 'Un eroe a caso perde una moneta in scommesse.', { gold: -10 }),
      row(4, 4, 'Voci di un tesoro', 'La prossima esplorazione tira un dado in più.'),
      row(5, 5, 'Cacciatori di taglie', 'Una banda a scelta incontra guai: gioca un’escaramuccia extra.'),
      row(6, 6, 'Pioggia di pietra magica', 'Una scheggia in regalo alla banda col rating più basso.', { shards: 1 }),
    ] },
  ];
}

export function defaultSettings(): Settings {
  return {
    ptsWin: 3, ptsDraw: 1, ptsLoss: 0, baseRating: 5, startGold: 500,
    heroAdv: '2,4,6,8,11,14,17,20,24,28,32,36,40,44,48', henchAdv: '2,5,9,14',
  };
}

export function seedState(): AppState {
  const model = (kind: 'hero' | 'hench', name: string, role: string, count: number, cost: number, equip: string): Model => ({
    ...newModel(kind), name, role, count, cost, equip,
  });
  const band = newBand(defaultSettings());
  band.name = 'Banda d’esempio (modificami)';
  band.type = 'Mercenari';
  band.models = [model('hero', 'Capitano (esempio)', 'Capo', 1, 60, 'Spada, pugnale'), model('hench', 'Spadaccini (esempio)', 'Seguaci', 3, 25, 'Spada')];
  return {
    v: 1, t: 0,
    campaign: { name: 'La Città dei Dannati', week: 1, notes: '', settings: defaultSettings() },
    bands: [band], matches: [], log: [], tables: defaultTables(),
  };
}
