import { useState } from 'react';
import { defaultTables, uid } from './engine.ts';
import { update, useAppState } from './store.ts';
import type { TableDef, TableRow } from './types.ts';
import { Confirm, Field, Num, Txt, toast } from './ui.tsx';

export function TablesView() {
  const s = useAppState();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const patch = (id: string, fn: (t: TableDef) => void) => update((d) => { const t = d.tables.find((x) => x.id === id); if (t) fn(t); });
  const patchRow = (tid: string, rid: string, fn: (r: TableRow) => void) => patch(tid, (t) => { const r = t.rows.find((x) => x.id === rid); if (r) fn(r); });

  return (
    <>
      <section className="panel">
        <h2>Tabelle</h2>
        <p className="muted nomargin">Queste tabelle sono versioni semplificate, scritte come punto di partenza. Modificale con i risultati del vostro regolamento o crea tabelle nuove. Il tiro può essere un intervallo (da – a).</p>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => {
            const id = uid();
            update((d) => { d.tables.push({ id, at: Date.now(), name: 'Nuova tabella', die: 'd6', note: '', rows: [{ id: uid(), from: 1, to: 1, title: 'Risultato', text: '', gold: 0, shards: 0, item: '' }] }); });
            setOpen({ ...open, [id]: true });
          }}>+ Nuova tabella</button>
          <button className="btn" onClick={() => {
            let added = 0;
            update((d) => { for (const t of defaultTables()) if (!d.tables.some((x) => x.id === t.id)) { d.tables.push(t); added++; } });
            toast(added ? 'Tabelle base ripristinate' : 'Le tabelle base ci sono già');
          }}>Ripristina tabelle base mancanti</button>
        </div>
      </section>

      {s.tables.map((t) => (
        <details key={t.id} className="tbl" open={Boolean(open[t.id])} onToggle={(e) => setOpen({ ...open, [t.id]: (e.currentTarget as HTMLDetailsElement).open })}>
          <summary>{t.name} <span className="muted mono">· {t.die} · {t.rows.length} righe</span></summary>
          <div className="in">
            <div className="grid">
              <Field label="Nome"><Txt value={t.name} onChange={(v) => patch(t.id, (x) => { x.name = v; })} /></Field>
              <Field label="Dadi (es. d6, 2d6, d66, Nd6)"><Txt value={t.die} onChange={(v) => patch(t.id, (x) => { x.die = v; })} /></Field>
              <Field label="Nota"><Txt value={t.note} onChange={(v) => patch(t.id, (x) => { x.note = v; })} /></Field>
            </div>
            <p className="hint">“Nd6” significa un d6 per ogni eroe che esplora.</p>
            {t.rows.map((r) => (
              <div className="trow" key={r.id}>
                <Field label="Da" className="s"><Num value={r.from} onChange={(v) => patchRow(t.id, r.id, (x) => { x.from = v; })} /></Field>
                <Field label="A" className="s"><Num value={r.to} onChange={(v) => patchRow(t.id, r.id, (x) => { x.to = v; })} /></Field>
                <Field label="Titolo" className="w"><Txt value={r.title} onChange={(v) => patchRow(t.id, r.id, (x) => { x.title = v; })} /></Field>
                <Field label="Descrizione" className="w"><Txt value={r.text} onChange={(v) => patchRow(t.id, r.id, (x) => { x.text = v; })} /></Field>
                <Field label="Corone" className="m"><Num value={r.gold} onChange={(v) => patchRow(t.id, r.id, (x) => { x.gold = v; })} /></Field>
                <Field label="Schegge" className="m"><Num value={r.shards} onChange={(v) => patchRow(t.id, r.id, (x) => { x.shards = v; })} /></Field>
                <Field label="Oggetto" className="w"><Txt value={r.item} onChange={(v) => patchRow(t.id, r.id, (x) => { x.item = v; })} /></Field>
                <Confirm onConfirm={() => patch(t.id, (x) => { x.rows = x.rows.filter((y) => y.id !== r.id); })}>✕</Confirm>
              </div>
            ))}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => patch(t.id, (x) => {
                const last = x.rows[x.rows.length - 1];
                const from = last ? Math.max(last.from, last.to) + 1 : 1;
                x.rows.push({ id: uid(), from, to: from, title: 'Nuovo risultato', text: '', gold: 0, shards: 0, item: '' });
              })}>+ Riga</button>
              <span className="grow" />
              <Confirm className="btn danger" onConfirm={() => update((d) => { d.tables = d.tables.filter((x) => x.id !== t.id); })}>Elimina tabella</Confirm>
            </div>
          </div>
        </details>
      ))}
    </>
  );
}
