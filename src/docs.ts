import type { AppState } from './types.ts';

/**
 * Per la sincronizzazione online lo stato viene scomposto in "documenti":
 * una riga per banda, battaglia, tabella, voce di diario e una per i dati
 * generali della campagna. Così due giocatori che modificano bande diverse
 * non si sovrascrivono a vicenda.
 */
export type DocKind = 'meta' | 'band' | 'match' | 'table' | 'log';

export interface Doc {
  kind: DocKind;
  id: string;
  data: unknown;
}

export const docKey = (kind: DocKind, id: string): string => `${kind}/${id}`;

/**
 * JSON con le chiavi in ordine alfabetico. Postgres (jsonb) riordina le chiavi,
 * quindi per confrontare "quello che ho scritto" con "quello che torna indietro"
 * serve una forma che non dipenda dall'ordine.
 */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const k of Object.keys(o).sort()) if (o[k] !== undefined) parts.push(`${JSON.stringify(k)}:${canonical(o[k])}`);
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function parseKey(key: string): { kind: DocKind; id: string } {
  const i = key.indexOf('/');
  return { kind: key.slice(0, i) as DocKind, id: key.slice(i + 1) };
}

/** Mappa chiave -> JSON dell'oggetto, usata per capire cosa è cambiato. */
export function toDocMap(s: AppState): Map<string, string> {
  const m = new Map<string, string>();
  m.set(docKey('meta', 'main'), canonical(s.campaign));
  for (const b of s.bands) m.set(docKey('band', b.id), canonical(b));
  for (const x of s.matches) m.set(docKey('match', x.id), canonical(x));
  for (const t of s.tables) m.set(docKey('table', t.id), canonical(t));
  for (const l of s.log) m.set(docKey('log', l.id), canonical(l));
  return m;
}

const byAt = <T extends { at: number }>(a: T, b: T): number => a.at - b.at;

/** Applica un singolo documento (o la sua cancellazione, data = null) allo stato. */
export function applyDoc(s: AppState, kind: DocKind, id: string, data: unknown | null): AppState {
  const next: AppState = { ...s };
  const upsert = <T extends { id: string; at: number }>(list: T[]): T[] => {
    const rest = list.filter((x) => x.id !== id);
    return data === null ? rest : [...rest, data as T].sort(byAt);
  };
  switch (kind) {
    case 'meta':
      if (data !== null) next.campaign = data as AppState['campaign'];
      break;
    case 'band': next.bands = upsert(s.bands); break;
    case 'match': next.matches = upsert(s.matches); break;
    case 'table': next.tables = upsert(s.tables); break;
    case 'log': next.log = upsert(s.log); break;
  }
  return next;
}

/** Ricostruisce lo stato da un elenco di documenti scaricati. */
export function fromDocs(docs: Doc[], fallback: AppState): AppState {
  let s: AppState = { ...fallback, bands: [], matches: [], log: [], tables: [] };
  for (const d of docs) s = applyDoc(s, d.kind, d.id, d.data);
  return s;
}
