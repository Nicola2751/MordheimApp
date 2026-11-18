import { useState } from 'react';
import { applyRow, dieInfo, effectsText, isValidRoll, matchRow, num, rollDie } from './engine.ts';
import { update, useAppState } from './store.ts';
import { Field, Num, toast } from './ui.tsx';

export function ExploreView() {
  const s = useAppState();
  const [bandId, setBandId] = useState('');
  const [tableId, setTableId] = useState('');
  const [n, setN] = useState(2);
  const [roll, setRoll] = useState('');
  const [detail, setDetail] = useState('');
  const [applied, setApplied] = useState(false);

  const band = s.bands.find((b) => b.id === bandId) ?? s.bands[0];
  const table = s.tables.find((t) => t.id === tableId) ?? s.tables[0];
  if (!table) return <div className="empty">Nessuna tabella. Creane una nella sezione Tabelle.</div>;

  const info = dieInfo(table.die, n);
  const value = Number(roll);
  const valid = roll !== '' && isValidRoll(info, value);
  const row = valid ? matchRow(table, value) : null;
  const log = s.log.filter((l) => !band || l.band === band.id).sort((x, y) => y.at - x.at).slice(0, 25);

  const reset = () => { setApplied(false); setDetail(''); };

  return (
    <>
      <section className="panel">
        <h2>Esplora</h2>
        <div className="grid">
          <Field label="Banda">
            <select value={band?.id ?? ''} onChange={(e) => { setBandId(e.target.value); reset(); }}>
              {s.bands.length === 0 && <option value="">— nessuna banda —</option>}
              {s.bands.map((b) => <option key={b.id} value={b.id}>{b.name || 'Senza nome'}</option>)}
            </select>
          </Field>
          <Field label="Tabella">
            <select value={table.id} onChange={(e) => { setTableId(e.target.value); setRoll(''); reset(); }}>
              {s.tables.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.die})</option>)}
            </select>
          </Field>
          {info.dyn && <Field label="Eroi che esplorano (numero di dadi)"><Num min={1} max={20} value={n} onChange={(v) => { setN(Math.max(1, Math.min(20, v))); setRoll(''); reset(); }} /></Field>}
          <Field label={`Tiro uscito (${info.min}–${info.max})`}>
            <input type="number" inputMode="numeric" value={roll} onChange={(e) => { setRoll(e.target.value); reset(); }} />
          </Field>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => { const r = rollDie(info); setRoll(String(r.value)); setDetail(r.detail); setApplied(false); }}>Tira per me ({info.label})</button>
        </div>
        {table.note && <p className="hint">{table.note}</p>}
      </section>

      {roll === '' && <div className="empty">Inserisci il tiro uscito (da {info.min} a {info.max}) oppure premi “Tira per me”.</div>}
      {roll !== '' && !valid && <div className="result bad"><b>Tiro non valido.</b> Con {info.label} il risultato va da {info.min} a {info.max}{info.d66 ? ', con unità da 1 a 6' : ''}.</div>}
      {valid && !row && <div className="result warnbox"><b>Nessuna riga per {value}.</b> Controlla gli intervalli nella tabella.</div>}
      {valid && row && (
        <div className="result">
          <div className="muted mono small">{table.name} · tiro {value}{detail ? ` (${detail})` : ''}</div>
          <h3>{row.title}</h3>
          <div>{row.text}</div>
          <div className="effects">
            {num(row.gold) !== 0 && <span className="fx gold">{num(row.gold) > 0 ? '+' : ''}{num(row.gold)} corone</span>}
            {num(row.shards) !== 0 && <span className="fx stone">{num(row.shards) > 0 ? '+' : ''}{num(row.shards)} schegge</span>}
            {row.item && <span className="fx">{row.item}</span>}
          </div>
          <button className="btn primary" disabled={!band || applied} onClick={() => {
            if (!band) return;
            update((d) => {
              const b = d.bands.find((x) => x.id === band.id);
              const t = d.tables.find((x) => x.id === table.id);
              const r = t?.rows.find((x) => x.id === row.id);
              if (b && t && r) d.log.push(applyRow(b, t, value, r, d.campaign.week));
            });
            setApplied(true);
            toast(`Applicato a ${band.name || 'banda'}`);
          }}>{applied ? 'Applicato' : band ? `Applica a ${band.name || 'banda'}` : 'Scegli una banda'}</button>
          {effectsText(row).length === 0 && <span className="muted"> Nessun effetto automatico, annotalo a mano se serve.</span>}
        </div>
      )}

      <section className="panel">
        <h2>{table.name}</h2>
        <div className="scroll">
          <table>
            <thead><tr><th className="n">Tiro</th><th>Risultato</th><th>Effetto</th></tr></thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r.id} className={row && row.id === r.id ? 'hit' : ''}>
                  <td className="n">{num(r.from)}{num(r.to) && num(r.to) !== num(r.from) ? `–${num(r.to)}` : ''}</td>
                  <td><b>{r.title}</b><div className="muted small">{r.text}</div></td>
                  <td>{effectsText(r).length ? effectsText(r).join(' · ') : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Diario</h2>
        {log.length === 0 ? <p className="muted">Gli esiti applicati compaiono qui.</p> : (
          <ul className="log">
            {log.map((l) => (
              <li key={l.id}><span className="muted mono small">Sett. {l.week} · {s.bands.find((b) => b.id === l.band)?.name || '(banda eliminata)'}</span><br />{l.text}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
