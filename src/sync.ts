import { useSyncExternalStore } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { applyDoc, canonical, docKey, fromDocs, parseKey, toDocMap } from './docs.ts';
import type { Doc, DocKind } from './docs.ts';
import { getState, onLocalChange, replaceState } from './store.ts';

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const onlineAvailable = Boolean(SB_URL && ANON);

export type SyncStatus = 'off' | 'connecting' | 'ok' | 'saving' | 'error' | 'readonly';
export type Role = 'owner' | 'editor' | 'viewer';
export interface Link {
  campaignId: string;
  name: string;
  role: Role;
}
export interface SyncSnapshot {
  status: SyncStatus;
  link: Link | null;
  message: string;
  codes: { edit: string; view: string } | null;
}

const LINK_KEY = 'mordheim.link.v1';
const OK_KEY = 'mordheim.lastok.v1';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let client: SupabaseClient | null = null;
const sb = (): SupabaseClient => {
  if (!client) client = createClient(SB_URL as string, ANON as string, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
};

/* ---------- stato osservabile ---------- */
function loadLink(): Link | null {
  try {
    const raw = localStorage.getItem(LINK_KEY);
    return raw ? (JSON.parse(raw) as Link) : null;
  } catch {
    return null;
  }
}
let snap: SyncSnapshot = { status: 'off', link: loadLink(), message: '', codes: null };
const subs = new Set<() => void>();
function setSnap(p: Partial<SyncSnapshot>): void {
  snap = { ...snap, ...p };
  subs.forEach((l) => l());
}
export const useSync = (): SyncSnapshot =>
  useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => snap);

function fail(e: unknown): void {
  const err = e as { code?: string; message?: string } | null;
  if (err?.code === '42501') setSnap({ status: 'readonly', message: 'Hai solo il permesso di lettura.' });
  else setSnap({ status: 'error', message: err?.message ?? 'Errore di rete.' });
}

/* ---------- sincronizzazione ---------- */
let synced = new Map<string, string>(); // ciò che il server ha, in forma canonica
let channel: RealtimeChannel | null = null;
let stopLocal: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let pushing = false;
let again = false;

const markOk = (): void => { try { localStorage.setItem(OK_KEY, String(Date.now())); } catch { /* ignora */ } };
const lastOk = (): number => { try { return Number(localStorage.getItem(OK_KEY)) || 0; } catch { return 0; } };

async function ensureSession(): Promise<void> {
  const { data } = await sb().auth.getSession();
  if (data.session) return;
  const { error } = await sb().auth.signInAnonymously();
  if (error) throw error;
}

async function fetchDocs(campaignId: string): Promise<Doc[]> {
  const out: Doc[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb()
      .from('mordheim_docs').select('kind,id,data')
      .eq('campaign_id', campaignId).eq('deleted', false).order('id').range(from, from + 999);
    if (error) throw error;
    const rows = (data ?? []) as Doc[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

function schedulePush(): void {
  if (!snap.link || snap.link.role === 'viewer') return;
  setSnap({ status: 'saving', message: '' });
  clearTimeout(timer);
  timer = setTimeout(() => { void push(); }, 600);
}

async function push(): Promise<void> {
  const link = snap.link;
  if (!link || link.role === 'viewer') return;
  if (pushing) { again = true; return; }
  pushing = true;
  try {
    const cur = toDocMap(getState());
    const rows: { campaign_id: string; kind: DocKind; id: string; data: unknown; deleted: boolean }[] = [];
    const after: [string, string | null][] = [];
    for (const [k, v] of cur) {
      if (synced.get(k) === v) continue;
      const { kind, id } = parseKey(k);
      rows.push({ campaign_id: link.campaignId, kind, id, data: JSON.parse(v), deleted: false });
      after.push([k, v]);
    }
    for (const k of synced.keys()) {
      if (cur.has(k) || k.startsWith('meta/')) continue;
      const { kind, id } = parseKey(k);
      rows.push({ campaign_id: link.campaignId, kind, id, data: null, deleted: true });
      after.push([k, null]);
    }
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await sb().from('mordheim_docs').upsert(rows.slice(i, i + 100), { onConflict: 'campaign_id,kind,id' });
      if (error) throw error;
      for (const [k, v] of after.slice(i, i + 100)) {
        if (v === null) synced.delete(k); else synced.set(k, v);
      }
    }
    markOk();
    setSnap({ status: 'ok', message: '' });
  } catch (e) {
    fail(e);
  } finally {
    pushing = false;
    if (again) { again = false; schedulePush(); }
  }
}

function onRemote(row: Record<string, unknown> | undefined): void {
  if (!row || typeof row.kind !== 'string' || typeof row.id !== 'string') return;
  const kind = row.kind as DocKind;
  const id = row.id;
  const gone = row.deleted === true;
  const key = docKey(kind, id);
  const v = gone ? null : canonical(row.data);
  if ((synced.get(key) ?? null) === v) return; // eco di una nostra scrittura
  if (v === null) synced.delete(key); else synced.set(key, v);
  replaceState(applyDoc(getState(), kind, id, gone ? null : row.data));
}

function listen(link: Link): void {
  channel = sb()
    .channel(`mordheim-${link.campaignId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mordheim_docs', filter: `campaign_id=eq.${link.campaignId}` },
      (payload) => onRemote(payload.new as Record<string, unknown> | undefined))
    .subscribe();
  stopLocal = onLocalChange(() => schedulePush());
}

async function loadCodes(link: Link): Promise<void> {
  if (link.role !== 'owner') return;
  const { data } = await sb().from('mordheim_codes').select('code,view_code').eq('campaign_id', link.campaignId).maybeSingle();
  if (data) setSnap({ codes: { edit: data.code as string, view: data.view_code as string } });
}

/** Collega questo dispositivo a una campagna online. mode: 'push' invia lo stato locale, 'pull' scarica quello online. */
async function attach(link: Link, mode: 'push' | 'pull' | 'resume'): Promise<void> {
  detach(false);
  try { localStorage.setItem(LINK_KEY, JSON.stringify(link)); } catch { /* ignora */ }
  setSnap({ link, status: 'connecting', message: '', codes: null });
  if (mode === 'push') {
    synced = new Map();
    await push();
  } else {
    const docs = await fetchDocs(link.campaignId);
    synced = new Map(docs.map((d) => [docKey(d.kind, d.id), canonical(d.data)]));
    let next = fromDocs(docs, getState());
    // Al rientro online, se sul dispositivo ci sono modifiche mai inviate, restano valide e vengono inviate.
    const localNewer = mode === 'resume' && getState().t > lastOk() && link.role !== 'viewer';
    if (localNewer) {
      for (const [k, v] of toDocMap(getState())) {
        if (synced.get(k) === v) continue;
        const { kind, id } = parseKey(k);
        next = applyDoc(next, kind, id, JSON.parse(v));
      }
    }
    replaceState(next, { local: false });
    if (localNewer) await push();
    else { markOk(); setSnap({ status: 'ok' }); }
  }
  listen(link);
  void loadCodes(link);
}

function detach(clearLink: boolean): void {
  clearTimeout(timer);
  stopLocal?.(); stopLocal = null;
  if (channel) { void sb().removeChannel(channel); channel = null; }
  if (clearLink) {
    try { localStorage.removeItem(LINK_KEY); } catch { /* ignora */ }
    setSnap({ link: null, status: 'off', message: '', codes: null });
  }
}

/* ---------- azioni pubbliche ---------- */
const makeCode = (): string => {
  const a = new Uint32Array(8);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');
};

export async function createCampaign(name: string): Promise<void> {
  setSnap({ status: 'connecting', message: '' });
  try {
    await ensureSession();
    const { data: c, error } = await sb().from('mordheim_campaigns').insert({ name: name.trim() || 'Campagna' }).select('id,name').single();
    if (error || !c) throw error ?? new Error('Creazione non riuscita.');
    for (let i = 0; ; i++) {
      const { error: e2 } = await sb().from('mordheim_codes').insert({ campaign_id: c.id, code: makeCode(), view_code: makeCode() });
      if (!e2) break;
      if (e2.code !== '23505' || i >= 4) throw e2;
    }
    await attach({ campaignId: c.id as string, name: c.name as string, role: 'owner' }, 'push');
  } catch (e) {
    fail(e);
  }
}

export async function joinCampaign(code: string): Promise<void> {
  setSnap({ status: 'connecting', message: '' });
  try {
    await ensureSession();
    const { data, error } = await sb().rpc('join_campaign', { p_code: code.trim().toUpperCase() });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { id: string; name: string; role: Role } | undefined;
    if (!row) throw new Error('Codice non valido.');
    await attach({ campaignId: row.id, name: row.name, role: row.role }, 'pull');
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? '';
    setSnap({ status: 'error', message: /codice/i.test(msg) ? 'Codice non valido.' : msg || 'Errore di rete.' });
  }
}

export function leaveCampaign(): void {
  detach(true);
}

/** Da chiamare all'avvio: riprende il collegamento salvato, se c'è. */
export async function resume(): Promise<void> {
  const link = snap.link;
  if (!onlineAvailable || !link) return;
  try {
    await ensureSession();
    await attach(link, 'resume');
  } catch (e) {
    fail(e);
  }
}
