import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advReady, applyRow, bandStats, buyItem, defaultSettings, defaultTables, dieInfo, isValidRoll, matchRow,
  modelFromTemplate, newBand, newModel, rollDie, seedState, standings,
} from './engine.ts';

test('dieInfo: dadi fissi, dinamici e d66', () => {
  assert.deepEqual([dieInfo('d6').min, dieInfo('d6').max], [1, 6]);
  assert.deepEqual([dieInfo('2d6').min, dieInfo('2d6').max], [2, 12]);
  const dyn = dieInfo('Nd6', 3);
  assert.deepEqual([dyn.min, dyn.max, dyn.dyn, dyn.label], [3, 18, true, '3d6']);
  assert.equal(dieInfo('Nd6', 99).count, 20);
  const d66 = dieInfo('d66');
  assert.deepEqual([d66.min, d66.max, d66.d66], [11, 66, true]);
});

test('isValidRoll rifiuta i d66 con unità fuori da 1-6', () => {
  const d66 = dieInfo('d66');
  assert.equal(isValidRoll(d66, 36), true);
  assert.equal(isValidRoll(d66, 37), false);
  assert.equal(isValidRoll(d66, 70), false);
  assert.equal(isValidRoll(dieInfo('2d6'), 13), false);
});

test('rollDie usa il generatore passato', () => {
  const seq = [3, 5];
  let i = 0;
  const rng = () => seq[i++ % seq.length] as number;
  assert.deepEqual(rollDie(dieInfo('2d6'), rng), { value: 8, detail: '3 + 5' });
  i = 0;
  assert.deepEqual(rollDie(dieInfo('d66'), rng), { value: 35, detail: '3 e 5' });
});

test('matchRow trova la riga anche ai bordi dell’intervallo', () => {
  const t = defaultTables()[0]!;
  assert.equal(matchRow(t, 6)?.title, 'Qualche moneta tra i detriti');
  assert.equal(matchRow(t, 8)?.title, 'Qualche moneta tra i detriti');
  assert.equal(matchRow(t, 9)?.title, 'Un bagliore verde');
  assert.equal(matchRow(t, 36)?.shards, 4);
  assert.equal(matchRow(t, 37), null);
  assert.equal(matchRow(t, ''), null);
});

test('le tre tabelle base coprono tutti i tiri possibili', () => {
  const [expl, inj, evt] = defaultTables() as [ReturnType<typeof defaultTables>[0], ReturnType<typeof defaultTables>[0], ReturnType<typeof defaultTables>[0]];
  for (let v = 1; v <= 36; v++) assert.ok(matchRow(expl, v), `esplorazione ${v}`);
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) assert.ok(matchRow(inj, a * 10 + b), `ferite ${a}${b}`);
  for (let v = 1; v <= 6; v++) assert.ok(matchRow(evt, v), `eventi ${v}`);
});

test('bandStats ignora i guerrieri fuori dalla banda e conta i gruppi', () => {
  const set = defaultSettings();
  const b = newBand(set);
  const hero = { ...newModel('hero'), cost: 60, xp: 3 };
  const group = { ...newModel('hench'), count: 3, cost: 25, xp: 1 };
  const gone = { ...newModel('hero'), cost: 100, xp: 10, dead: true };
  b.models = [hero, group, gone];
  const st = bandStats(b, set);
  assert.equal(st.models, 4);
  assert.equal(st.value, 60 + 75);
  assert.equal(st.rating, 5 + 3 + 3 * (5 + 1));
});

test('advReady segue le soglie di eroi e seguaci', () => {
  const set = defaultSettings();
  const hero = { ...newModel('hero'), xp: 1 };
  assert.equal(advReady(hero, set), false);
  hero.xp = 2;
  assert.equal(advReady(hero, set), true);
  hero.adv = 1;
  assert.equal(advReady(hero, set), false);
  hero.xp = 4;
  assert.equal(advReady(hero, set), true);
  const g = { ...newModel('hench'), xp: 5, adv: 1 };
  assert.equal(advReady(g, set), true);
});

test('standings assegna punti e ordina', () => {
  const s = seedState();
  const a = newBand(s.campaign.settings); a.name = 'A';
  const b = newBand(s.campaign.settings); b.name = 'B';
  s.bands = [a, b];
  s.matches = [
    { id: '1', at: 1, week: 1, scenario: '', a: a.id, b: b.id, result: 'b' },
    { id: '2', at: 2, week: 2, scenario: '', a: a.id, b: b.id, result: 'd' },
    { id: '3', at: 3, week: 3, scenario: '', a: a.id, b: 'sconosciuta', result: 'a' },
  ];
  const [first, second] = standings(s);
  assert.equal(first!.band.name, 'B');
  assert.deepEqual([first!.pts, first!.w, first!.d, first!.p], [4, 1, 1, 2]);
  assert.deepEqual([second!.pts, second!.l, second!.p], [1, 1, 2]);
});

test('buyItem scala le corone e aggiunge l’oggetto', () => {
  const b = newBand(defaultSettings());
  b.gold = 15;
  const m = newModel('hero');
  assert.equal(buyItem(b, m, { id: 'x', name: 'Spada', category: 'Armi', cost: 10 }), null);
  assert.deepEqual([b.gold, m.equip], [5, 'Spada']);
  assert.equal(buyItem(b, m, { id: 'y', name: 'Arco', category: 'Armi', cost: 10 }) !== null, true);
  assert.deepEqual([b.gold, m.equip], [5, 'Spada']);
  b.gold = 50;
  buyItem(b, m, { id: 'y', name: 'Arco', category: 'Armi', cost: 10 });
  assert.equal(m.equip, 'Spada, Arco');
});

test('applyRow aggiorna la banda e produce il diario', () => {
  const s = seedState();
  const b = s.bands[0]!;
  const t = s.tables[0]!;
  const start = b.gold;
  const r = matchRow(t, 12)!;
  const entry = applyRow(b, t, 12, r, 4);
  assert.equal(b.gold, start + 20);
  assert.equal(b.shards, 1);
  assert.equal(entry.week, 4);
  assert.match(entry.text, /Cantina dimenticata/);
  const loot = applyRow(b, t, 31, matchRow(t, 31)!, 4);
  assert.deepEqual(b.stash, ['Oggetto raro']);
  assert.match(loot.text, /Oggetto raro/);
});

test('modelFromTemplate copia le statistiche dal catalogo', () => {
  const m = modelFromTemplate({ id: 't', name: 'Capo', role: 'Capo', cost: 60, stats: { M: 4, AC: 4, AB: 3, F: 3, R: 3, Fe: 1, I: 4, A: 1, Ld: 8 } }, 'hero', { hired: true });
  assert.deepEqual([m.name, m.cost, m.stats.Ld, m.hired, m.count], ['Capo', 60, 8, true, 1]);
  const g = modelFromTemplate({ id: 'g', name: 'Seguace', role: 'S', cost: 25, stats: { M: 4, AC: 3, AB: 3, F: 3, R: 3, Fe: 1, I: 3, A: 1, Ld: 7 } }, 'hench', { count: 3 });
  assert.equal(g.count, 3);
});
