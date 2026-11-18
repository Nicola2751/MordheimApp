import { bandStats, num } from './engine.ts';
import type { AppState } from './types.ts';

/** Riga di riepilogo: corone e schegge totali in campagna. */
export function bandBalance(s: AppState): string {
  const gold = s.bands.reduce((a, b) => a + num(b.gold), 0);
  const shards = s.bands.reduce((a, b) => a + num(b.shards), 0);
  const top = [...s.bands].sort((x, y) => bandStats(y, s.campaign.settings).rating - bandStats(x, s.campaign.settings).rating)[0];
  return `In campagna ci sono ${s.bands.length} bande, ${gold} corone e ${shards} schegge in totale.${top ? ` Rating più alto: ${top.name || 'Senza nome'}.` : ''}`;
}
