import { useState } from 'react';
import { bandBalance } from './campaignHelpers.ts';
import { bandStats, standings, uid } from './engine.ts';
import { getState, replaceState, update, useAppState } from './store.ts';
import type { AppState } from './types.ts';
import { Area, Confirm, Field, Num, Txt, toast } from './ui.tsx';

export function CampaignView() {
  const s = useAppState();
  const c = s.campaign;
  const set = c.settings;
  const st = standings(s);
  const nameOf = (id: string) => s.bands.find((b) => b.id === id)?.name || '(banda eliminata)';
  const [d, setD] = useState({ week: c.week, scenario: '', a: '', b: '', result: 'a' as 'a' | 'b' | 'd' });
  const [io, setIo] = useState('');
  const a = s.bands.some((b) => b.id === d.a) ? d.a : s.bands[0]?.id ?? '';
  const b = s.bands.some((x) => x.id === d.b) && d.b !== a ? d.b : s.bands.find((x) => x.id !== a)?.id ?? '';
  const matches = [...s.matches].sort((x, y) => y.week - x.week || y.at - x.at);
  const setC = (fn: (draft: AppState['campaign']) => void) => update((x) => fn(x.campaign));

  return (
    <>
      <section className="panel">
        <h2>Campagna</h2>
        <div className="grid">
          <Field label="Nome della campagna"><Txt value={c.name} onChange={(v) => setC((x) => { x.name = v; })} /></Field>
          <Field label="Settimana in corso">
            <div className="row nowrap">
              <button className="btn" onClick={() => setC((x) => { x.week = Math.max(1, x.week - 1); })}>−</button>
              <Num min={1} value={c.week} onChange={(v) => setC((x) => { x.week = Math.max(1, v); })} />
              <button className="btn" onClick={() => setC((x) => { x.week += 1; })}>+</button>
            </div>
          </Field>
        </div>
      </section>

      <section className="panel">
        <h2>Classifica</h2>
        {st.length === 0 ? <div className="empty">Crea almeno due bande per avere una classifica.</div> : (
          <div className="scroll">
            <table>
              <thead><tr><th>Banda</th><th className="n">G</th><th className="n">V</th><th className="n">P</th><th className="n">S</th><th className="n">Punti</th><th className="n">Rating</th></tr></thead>
              <tbody>
                {st.map((r) => (
                  <tr key={r.band.id}>
                    <td>{r.band.name || 'Senza nome'}<div className="muted small">{r.band.player}</div></td>
                    <td className="n">{r.p}</td><td className="n">{r.w}</td><td className="n">{r.d}</td><td className="n">{r.l}</td>
                    <td className="n"><b>{r.pts}</b></td><td className="n">{bandStats(r.band, set).rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">G giocate, V vinte, P pareggi, S sconfitte.</p>
      </section>

      <section className="panel">
        <h2>Registra una battaglia</h2>
        <div className="grid">
          <Field label="Settimana"><Num min={1} value={d.week} onChange={(v) => setD({ ...d, week: Math.max(1, v) })} /></Field>
          <Field label="Scenario"><Txt value={d.scenario} placeholder="es. Scontro in strada" onChange={(v) => setD({ ...d, scenario: v })} /></Field>
          <Field label="Banda A">
            <select value={a} onChange={(e) => setD({ ...d, a: e.target.value })}>
              {s.bands.map((x) => <option key={x.id} value={x.id}>{x.name || 'Senza nome'}</option>)}
            </select>
          </Field>
          <Field label="Banda B">
            <select value={b} onChange={(e) => setD({ ...d, b: e.target.value })}>
              {s.bands.filter((x) => x.id !== a).map((x) => <option key={x.id} value={x.id}>{x.name || 'Senza nome'}</option>)}
            </select>
          </Field>
          <Field label="Esito">
            <select value={d.result} onChange={(e) => setD({ ...d, result: e.target.value as 'a' | 'b' | 'd' })}>
              <option value="a">Vince A</option><option value="b">Vince B</option><option value="d">Pareggio</option>
            </select>
          </Field>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={!a || !b || a === b} onClick={() => {
            update((x) => { x.matches.push({ id: uid(), at: Date.now(), week: d.week, scenario: d.scenario.trim(), a, b, result: d.result }); });
            setD({ ...d, scenario: '' });
            toast('Battaglia registrata');
          }}>Registra</button>
        </div>
        {matches.length > 0 && (
          <>
            <div className="sep" />
            <ul className="log">
              {matches.map((m) => (
                <li key={m.id} className="row between">
                  <span><b>Sett. {m.week}</b> · {m.scenario || 'Scontro'}: {nameOf(m.a)} contro {nameOf(m.b)} → <b>{m.result === 'd' ? 'pareggio' : `vince ${nameOf(m.result === 'a' ? m.a : m.b)}`}</b></span>
                  <Confirm onConfirm={() => update((x) => { x.matches = x.matches.filter((y) => y.id !== m.id); })}>Elimina</Confirm>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Dopo la battaglia</h2>
        <ol className="steps">
          <li>Tira le ferite gravi per gli eroi messi fuori combattimento.</li>
          <li>Assegna esperienza e controlla gli avanzamenti.</li>
          <li>Esplora la città con gli eroi in piedi.</li>
          <li>Vendi le schegge e compra equipaggiamento.</li>
          <li>Aggiorna il rating e passa alla settimana successiva.</li>
        </ol>
        <p className="hint">Ordine di riferimento, adattalo alle regole che usate.</p>
        {s.bands.length > 0 && <p className="hint">{bandBalance(s)}</p>}
      </section>

      <section className="panel">
        <h2>Appunti</h2>
        <Area value={c.notes} onChange={(v) => setC((x) => { x.notes = v; })} />
      </section>

      <section className="panel">
        <h2>Impostazioni</h2>
        <div className="grid">
          <Field label="Punti per vittoria"><Num value={set.ptsWin} onChange={(v) => setC((x) => { x.settings.ptsWin = v; })} /></Field>
          <Field label="Punti per pareggio"><Num value={set.ptsDraw} onChange={(v) => setC((x) => { x.settings.ptsDraw = v; })} /></Field>
          <Field label="Punti per sconfitta"><Num value={set.ptsLoss} onChange={(v) => setC((x) => { x.settings.ptsLoss = v; })} /></Field>
          <Field label="Rating base per guerriero"><Num value={set.baseRating} onChange={(v) => setC((x) => { x.settings.baseRating = v; })} /></Field>
          <Field label="Corone iniziali"><Num value={set.startGold} onChange={(v) => setC((x) => { x.settings.startGold = v; })} /></Field>
          <Field label="Soglie XP eroi"><Txt value={set.heroAdv} onChange={(v) => setC((x) => { x.settings.heroAdv = v; })} /></Field>
          <Field label="Soglie XP seguaci"><Txt value={set.henchAdv} onChange={(v) => setC((x) => { x.settings.henchAdv = v; })} /></Field>
        </div>
        <p className="hint">Le soglie sono i valori di esperienza ai quali scatta un avanzamento, separati da virgola.</p>
      </section>

      <section className="panel">
        <h2>Esporta e importa</h2>
        <p className="muted nomargin">Copia tutta la campagna in un testo per fare un backup. Incollandolo qui e premendo Importa, sostituisce i dati attuali.</p>
        <textarea rows={4} value={io} onChange={(e) => setIo(e.target.value)} aria-label="Testo di esportazione" />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={async () => {
            const text = JSON.stringify(getState());
            setIo(text);
            try { await navigator.clipboard.writeText(text); toast('Copiato negli appunti'); } catch { toast('Testo pronto: selezionalo e copialo'); }
          }}>Esporta</button>
          <Confirm className="btn danger" onConfirm={() => {
            try {
              const parsed = JSON.parse(io) as AppState;
              if (!parsed?.campaign || !Array.isArray(parsed.bands) || !Array.isArray(parsed.tables)) throw new Error();
              replaceState({ ...parsed, matches: parsed.matches ?? [], log: parsed.log ?? [] }, { local: true });
              setIo('');
              toast('Campagna importata');
            } catch { toast('Testo non valido: serve un export di questa app'); }
          }}>Importa</Confirm>
        </div>
      </section>
    </>
  );
}
