import { useState } from 'react';
import { bandTemplate, catalog, equipmentFor, groupByCategory, hiredFor } from './catalog.ts';
import { advReady, bandStats, buyItem, modelFromTemplate, newBand, newModel, nextThreshold, num } from './engine.ts';
import { update, useAppState } from './store.ts';
import { STAT_KEYS } from './types.ts';
import type { Band, Model, Settings } from './types.ts';
import { Area, Confirm, Field, Num, Txt, toast } from './ui.tsx';

type Edit = (fn: (b: Band) => void) => void;

function ModelCard({ band, model, set, edit }: { band: Band; model: Model; set: Settings; edit: Edit }) {
  const [item, setItem] = useState('');
  const hero = model.kind === 'hero';
  const t = nextThreshold(model, set);
  const ready = advReady(model, set);
  const patch = (fn: (m: Model) => void) => edit((b) => { const m = b.models.find((x) => x.id === model.id); if (m) fn(m); });
  const items = equipmentFor(band.templateId);

  return (
    <div className={`model${model.dead ? ' dead' : ''}`}>
      <div className="head">
        <Field label={hero ? (model.hired ? 'Mercenario' : 'Eroe') : 'Gruppo di seguaci'}>
          <Txt value={model.name} onChange={(v) => patch((m) => { m.name = v; })} />
        </Field>
        <Field label="Ruolo"><Txt value={model.role} onChange={(v) => patch((m) => { m.role = v; })} /></Field>
        {!hero && <Field label="Quanti" className="w80"><Num min={1} value={model.count} onChange={(v) => patch((m) => { m.count = Math.max(1, v); })} /></Field>}
        <Field label="Costo (cad.)" className="w90"><Num min={0} value={model.cost} onChange={(v) => patch((m) => { m.cost = v; })} /></Field>
        {ready && <span className="badge adv">AVANZAMENTO!</span>}
      </div>

      <div className="stats">
        {STAT_KEYS.map((k) => (
          <label key={k}>{k}<Num value={model.stats[k]} onChange={(v) => patch((m) => { m.stats[k] = v; })} /></label>
        ))}
      </div>

      <div className="grid">
        <Field label="Equipaggiamento"><Area value={model.equip} onChange={(v) => patch((m) => { m.equip = v; })} /></Field>
        <Field label="Abilità"><Area value={model.skills} onChange={(v) => patch((m) => { m.skills = v; })} /></Field>
        <Field label="Ferite e note"><Area value={model.injuries} onChange={(v) => patch((m) => { m.injuries = v; })} /></Field>
      </div>

      {items.length > 0 && (
        <div className="row buy">
          <select value={item} onChange={(e) => setItem(e.target.value)} aria-label="Oggetto da comprare">
            <option value="">Compra un oggetto…</option>
            {groupByCategory(items).map(([cat, list]) => (
              <optgroup key={cat} label={cat}>
                {list.map((i) => <option key={i.id} value={i.id}>{i.name} · {i.cost} cor.</option>)}
              </optgroup>
            ))}
          </select>
          <button className="btn sm" disabled={!item} onClick={() => {
            const it = catalog.equipment.find((x) => x.id === item);
            if (!it) return;
            let err: string | null = null;
            edit((b) => { const m = b.models.find((x) => x.id === model.id); if (m) err = buyItem(b, m, it); });
            toast(err ?? `${it.name} comprato`);
            if (!err) setItem('');
          }}>Compra</button>
          <span className="muted">Ti restano {num(band.gold)} corone.</span>
        </div>
      )}

      <div className="xp">
        <b>Esperienza</b>
        <Num min={0} value={model.xp} onChange={(v) => patch((m) => { m.xp = Math.max(0, v); })} aria-label="Esperienza" />
        <button className="btn sm" onClick={() => patch((m) => { m.xp = num(m.xp) + 1; })}>+1</button>
        <button className="btn sm" onClick={() => patch((m) => { m.xp = num(m.xp) + 2; })}>+2</button>
        <span className="muted">{t !== undefined ? `prossimo avanzamento a ${t} XP` : 'nessun avanzamento oltre la tabella'} · fatti: {num(model.adv)}</span>
        {ready && <button className="btn sm primary" onClick={() => patch((m) => { m.adv = num(m.adv) + 1; })}>Avanzamento fatto</button>}
        <span className="grow" />
        <label className="check"><input type="checkbox" checked={model.dead} onChange={(e) => patch((m) => { m.dead = e.target.checked; })} /> Fuori dalla banda</label>
        <Confirm onConfirm={() => edit((b) => { b.models = b.models.filter((x) => x.id !== model.id); })}>Elimina</Confirm>
      </div>
    </div>
  );
}

function AddModels({ band, edit }: { band: Band; edit: Edit }) {
  const tpl = bandTemplate(band.templateId);
  const [pick, setPick] = useState('');
  const options: { value: string; label: string }[] = [];
  tpl?.heroes.forEach((h) => options.push({ value: `h:${h.id}`, label: `Eroe · ${h.name} (${h.cost} cor.)` }));
  tpl?.henchmen.forEach((h) => options.push({ value: `s:${h.id}`, label: `Seguaci · ${h.name} (${h.cost} cor.)` }));
  hiredFor(band.templateId).forEach((h) => options.push({ value: `m:${h.id}`, label: `Mercenario · ${h.name} (${h.cost} cor.)` }));

  return (
    <div className="row" style={{ marginBottom: 12 }}>
      {options.length > 0 && (
        <>
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Dal catalogo">
            <option value="">Aggiungi dal catalogo…</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className="btn" disabled={!pick} onClick={() => {
            const [k, id] = pick.split(':') as [string, string];
            const src = k === 'h' ? tpl?.heroes.find((x) => x.id === id) : k === 's' ? tpl?.henchmen.find((x) => x.id === id) : catalog.hired.find((x) => x.id === id);
            if (!src) return;
            const m = modelFromTemplate(src, k === 's' ? 'hench' : 'hero', { hired: k === 'm', count: 3 });
            edit((b) => { b.models.push(m); });
            setPick('');
          }}>Aggiungi</button>
        </>
      )}
      <button className="btn primary" onClick={() => edit((b) => { b.models.push(newModel('hero')); })}>+ Eroe</button>
      <button className="btn" onClick={() => edit((b) => { b.models.push(newModel('hench')); })}>+ Gruppo di seguaci</button>
    </div>
  );
}

export function BandsView() {
  const s = useAppState();
  const set = s.campaign.settings;
  const [sel, setSel] = useState<string | null>(null);
  const [tplId, setTplId] = useState('');
  const [stash, setStash] = useState('');
  const band = s.bands.find((b) => b.id === sel) ?? s.bands[0];

  const edit: Edit = (fn) => {
    if (!band) return;
    update((d) => { const b = d.bands.find((x) => x.id === band.id); if (b) fn(b); });
  };

  const st = band ? bandStats(band, set) : null;
  return (
    <>
      <div className="chips">
        {s.bands.map((b) => (
          <button key={b.id} className={`chip-btn${band && b.id === band.id ? ' on' : ''}`} onClick={() => setSel(b.id)}>{b.name || 'Senza nome'}</button>
        ))}
        <select value={tplId} onChange={(e) => setTplId(e.target.value)} aria-label="Modello di banda" className="auto">
          <option value="">Banda vuota</option>
          {catalog.bands.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn" onClick={() => {
          const nb = newBand(set, catalog.bands.find((t) => t.id === tplId));
          update((d) => { d.bands.push(nb); });
          setSel(nb.id);
        }}>+ Nuova banda</button>
      </div>

      {!band || !st ? <div className="empty">Nessuna banda. Creane una per cominciare la campagna.</div> : (
        <>
          <div className="tiles">
            <div className="tile"><b>{st.rating}</b><span>Rating</span></div>
            <div className="tile"><b>{st.models}</b><span>Guerrieri</span></div>
            <div className="tile"><b>{st.value}</b><span>Valore ingaggio</span></div>
            <div className="tile gold"><b>{num(band.gold)}</b><span>Corone</span></div>
            <div className="tile stone"><b>{num(band.shards)}</b><span>Schegge</span></div>
          </div>

          <section className="panel">
            <h2>Banda</h2>
            <div className="grid">
              <Field label="Nome"><Txt value={band.name} onChange={(v) => edit((b) => { b.name = v; })} /></Field>
              <Field label="Tipo di banda"><Txt value={band.type} onChange={(v) => edit((b) => { b.type = v; })} /></Field>
              <Field label="Giocatore"><Txt value={band.player} onChange={(v) => edit((b) => { b.player = v; })} /></Field>
              <Field label="Corone"><Num value={band.gold} onChange={(v) => edit((b) => { b.gold = v; })} /></Field>
              <Field label="Schegge di pietra magica"><Num min={0} value={band.shards} onChange={(v) => edit((b) => { b.shards = Math.max(0, v); })} /></Field>
            </div>
            <p className="hint">Il rating conta {num(set.baseRating)} punti per guerriero più la sua esperienza (modificabile in Campagna).
              {st.models > (bandTemplate(band.templateId)?.maxModels ?? Infinity) && <b className="warn"> Hai superato il limite di guerrieri della banda.</b>}</p>
          </section>

          <section className="panel">
            <h2>Guerrieri</h2>
            <AddModels band={band} edit={edit} />
            {band.models.length === 0 && <div className="empty">Aggiungi il primo eroe della banda.</div>}
            {[...band.models.filter((m) => m.kind === 'hero'), ...band.models.filter((m) => m.kind !== 'hero')].map((m) => (
              <ModelCard key={m.id} band={band} model={m} set={set} edit={edit} />
            ))}
          </section>

          <section className="panel">
            <h2>Magazzino</h2>
            {band.stash.length === 0
              ? <p className="muted">Nessun oggetto nel magazzino. Gli oggetti trovati esplorando finiscono qui.</p>
              : <ul className="log">{band.stash.map((it, i) => (
                <li key={`${i}-${it}`} className="row between"><span>{it}</span>
                  <button className="btn sm danger" onClick={() => edit((b) => { b.stash.splice(i, 1); })}>Togli</button></li>
              ))}</ul>}
            <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => {
              e.preventDefault();
              const v = stash.trim();
              if (!v) return;
              edit((b) => { b.stash.push(v); });
              setStash('');
            }}>
              <div className="fld grow"><input placeholder="Nuovo oggetto" value={stash} onChange={(e) => setStash(e.target.value)} aria-label="Nuovo oggetto" /></div>
              <button className="btn" type="submit">Aggiungi</button>
            </form>
          </section>

          <section className="panel">
            <h2>Note della banda</h2>
            <Area value={band.notes} onChange={(v) => edit((b) => { b.notes = v; })} />
            <div className="sep" />
            <Confirm className="btn danger" onConfirm={() => { update((d) => { d.bands = d.bands.filter((x) => x.id !== band.id); }); setSel(null); toast('Banda eliminata'); }}>Elimina questa banda</Confirm>
          </section>
        </>
      )}
    </>
  );
}

