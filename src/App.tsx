import { useEffect, useState } from 'react';
import { BandsView } from './BandsView.tsx';
import { CampaignView } from './CampaignView.tsx';
import { ExploreView } from './ExploreView.tsx';
import { OnlineView } from './OnlineView.tsx';
import { TablesView } from './TablesView.tsx';
import { useAppState } from './store.ts';
import { onlineAvailable, resume, useSync } from './sync.ts';
import { Toast } from './ui.tsx';

const TABS = [
  ['bande', 'Bande'],
  ['campagna', 'Campagna'],
  ['esplora', 'Esplora'],
  ['tabelle', 'Tabelle'],
  ['online', 'Online'],
] as const;
type Tab = (typeof TABS)[number][0];

const fromHash = (): Tab => {
  const h = location.hash.slice(1);
  return (TABS.find(([id]) => id === h)?.[0]) ?? 'bande';
};

const STATUS: Record<string, string> = {
  off: 'Solo su questo dispositivo',
  connecting: 'Connessione…',
  ok: 'Online · sincronizzato',
  saving: 'Salvataggio…',
  error: 'Online non raggiungibile · dati locali',
  readonly: 'Sola lettura',
};

export default function App() {
  const s = useAppState();
  const sync = useSync();
  const [tab, setTab] = useState<Tab>(fromHash);

  useEffect(() => {
    const on = () => { setTab(fromHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { void resume(); }, []);

  const pill = sync.link ? STATUS[sync.status] : onlineAvailable ? STATUS.off : 'Solo su questo dispositivo';
  const cls = sync.status === 'ok' ? 'ok' : sync.status === 'error' || sync.status === 'readonly' ? 'err' : '';

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1>Cronache di Mordheim</h1>
          <p>{s.campaign.name}</p>
        </div>
        <span className={`sync ${cls}`}>{pill}</span>
      </header>
      <nav className="tabs" aria-label="Sezioni">
        {TABS.map(([id, label]) => (
          <a key={id} href={`#${id}`} aria-current={tab === id ? 'page' : undefined}>{label}</a>
        ))}
      </nav>
      <main>
        {tab === 'bande' && <BandsView />}
        {tab === 'campagna' && <CampaignView />}
        {tab === 'esplora' && <ExploreView />}
        {tab === 'tabelle' && <TablesView />}
        {tab === 'online' && <OnlineView />}
      </main>
      <Toast />
    </div>
  );
}
