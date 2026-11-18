import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDoc, canonical, docKey, fromDocs, parseKey, toDocMap } from './docs.ts';
import type { Doc } from './docs.ts';
import { newBand, seedState } from './engine.ts';

test('chiavi dei documenti: andata e ritorno', () => {
  assert.equal(docKey('band', 'abc'), 'band/abc');
  assert.deepEqual(parseKey('band/abc/def'), { kind: 'band', id: 'abc/def' });
});

test('canonical non dipende dall’ordine delle chiavi e sopravvive a un giro in jsonb', () => {
  assert.equal(canonical({ b: 1, a: [{ d: 2, c: 3 }] }), canonical({ a: [{ c: 3, d: 2 }], b: 1 }));
  const s = seedState();
  const band = s.bands[0]!;
  const reordered = Object.fromEntries(Object.entries(band).reverse());
  assert.equal(canonical(reordered), canonical(band));
  assert.equal(canonical({ x: undefined, y: 1 }), '{"y":1}');
});

test('toDocMap produce una voce per ogni elemento', () => {
  const s = seedState();
  const m = toDocMap(s);
  assert.ok(m.has('meta/main'));
  assert.equal([...m.keys()].filter((k) => k.startsWith('band/')).length, 1);
  assert.equal([...m.keys()].filter((k) => k.startsWith('table/')).length, 3);
});

test('fromDocs ricostruisce lo stato scomposto', () => {
  const s = seedState();
  const docs: Doc[] = [...toDocMap(s)].map(([key, json]) => {
    const { kind, id } = parseKey(key);
    return { kind, id, data: JSON.parse(json) };
  });
  const back = fromDocs(docs, seedState());
  assert.deepEqual(back.campaign, s.campaign);
  assert.deepEqual(back.bands, s.bands);
  assert.deepEqual(back.tables.map((t) => t.id).sort(), s.tables.map((t) => t.id).sort());
});

test('applyDoc aggiunge, sostituisce e cancella senza toccare il resto', () => {
  const s = seedState();
  const extra = newBand(s.campaign.settings);
  extra.name = 'Nuova';
  let n = applyDoc(s, 'band', extra.id, extra);
  assert.equal(n.bands.length, 2);
  assert.equal(s.bands.length, 1);
  n = applyDoc(n, 'band', extra.id, { ...extra, name: 'Rinominata' });
  assert.equal(n.bands.length, 2);
  assert.equal(n.bands.find((b) => b.id === extra.id)!.name, 'Rinominata');
  n = applyDoc(n, 'band', extra.id, null);
  assert.equal(n.bands.length, 1);
  assert.deepEqual(n.tables, s.tables);
});

test('applyDoc meta cambia la campagna e la cancellazione di meta è ignorata', () => {
  const s = seedState();
  const n = applyDoc(s, 'meta', 'main', { ...s.campaign, week: 7 });
  assert.equal(n.campaign.week, 7);
  assert.equal(applyDoc(n, 'meta', 'main', null).campaign.week, 7);
});
