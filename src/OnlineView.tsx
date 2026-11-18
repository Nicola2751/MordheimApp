import { useState } from 'react';
import { createCampaign, joinCampaign, leaveCampaign, onlineAvailable, useSync } from './sync.ts';
import { useAppState } from './store.ts';
import { Confirm, Field, Txt, toast } from './ui.tsx';

const ROLE: Record<string, string> = { owner: 'Organizzatore', editor: 'Giocatore (può modificare)', viewer: 'Spettatore (sola lettura)' };

async function copy(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); toast('Codice copiato'); } catch { toast('Seleziona il codice e copialo'); }
}

export function OnlineView() {
  const s = useAppState();
  const sync = useSync();
  const [code, setCode] = useState('');
  const busy = sync.status === 'connecting';

  if (!onlineAvailable) {
    return (
      <section className="panel">
        <h2>Online</h2>
        <p>Questa copia dell'app non è collegata a un database online, quindi tutto resta su questo dispositivo.</p>
        <p className="muted">Per condividere la campagna con i giocatori serve un progetto Supabase gratuito. I passi sono nel README del repository, sezione “Campagna online”.</p>
      </section>
    );
  }

  const link = sync.link;
  return (
    <>
      <section className="panel">
        <h2>Online</h2>
        {link ? (
          <>
            <p><b>{link.name}</b> · {ROLE[link.role]}</p>
            <p className={`muted ${sync.status === 'error' || sync.status === 'readonly' ? 'warn' : ''}`}>
              {sync.status === 'ok' && 'Sincronizzata. Le modifiche degli altri arrivano da sole.'}
              {sync.status === 'saving' && 'Salvataggio in corso…'}
              {sync.status === 'connecting' && 'Connessione…'}
              {sync.status === 'readonly' && (sync.message || 'Hai solo il permesso di lettura.')}
              {sync.status === 'error' && `${sync.message || 'Errore di rete.'} I dati restano su questo dispositivo e verranno inviati appena torna la connessione.`}
            </p>
            <Confirm className="btn danger" onConfirm={leaveCampaign}>Scollega questo dispositivo</Confirm>
            <p className="hint">Scollegando, la campagna resta qui sul telefono ma smette di sincronizzarsi.</p>
          </>
        ) : (
          <p className="muted nomargin">Crea una campagna online per condividerla con i giocatori, oppure entra in una esistente con un codice.</p>
        )}
      </section>

      {link?.role === 'owner' && (
        <section className="panel">
          <h2>Inviti</h2>
          {sync.codes ? (
            <div className="grid">
              <div className="code"><span>Codice giocatori</span><b className="mono">{sync.codes.edit}</b><button className="btn sm" onClick={() => copy(sync.codes!.edit)}>Copia</button><small className="muted">Possono modificare bande e tabelle.</small></div>
              <div className="code"><span>Codice spettatori</span><b className="mono">{sync.codes.view}</b><button className="btn sm" onClick={() => copy(sync.codes!.view)}>Copia</button><small className="muted">Possono solo guardare.</small></div>
            </div>
          ) : <p className="muted">Caricamento dei codici…</p>}
          <p className="hint">Tutti i giocatori con il codice di modifica possono cambiare qualsiasi banda. Fidati dei tuoi amici.</p>
        </section>
      )}

      {!link && (
        <>
          <section className="panel">
            <h2>Crea una campagna online</h2>
            <p className="muted nomargin">Invia a Supabase la campagna che vedi ora: {s.bands.length} bande, {s.tables.length} tabelle.</p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" disabled={busy} onClick={() => { void createCampaign(s.campaign.name); }}>Crea e condividi</button>
            </div>
          </section>
          <section className="panel">
            <h2>Entra con un codice</h2>
            <form className="row" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void joinCampaign(code); }}>
              <Field label="Codice" className="grow"><Txt value={code} onChange={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck={false} /></Field>
              <button className="btn primary" type="submit" disabled={busy || !code.trim()}>Entra</button>
            </form>
            <p className="hint">I dati di questo dispositivo vengono sostituiti da quelli della campagna.</p>
            {sync.status === 'error' && <p className="warn">{sync.message}</p>}
          </section>
        </>
      )}
    </>
  );
}
