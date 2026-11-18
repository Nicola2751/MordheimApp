# Catalogo dati

Qui vivono bande, equipaggiamento e mercenari che l'app propone nei menu. I file contengono solo segnaposto: i dati veri si copiano dal manuale che usi.

| File | Contenuto |
| --- | --- |
| `bands.json` | Bande con corone iniziali, limite di guerrieri, eroi e seguaci |
| `equipment.json` | Oggetti acquistabili, con categoria e costo |
| `hired.json` | Mercenari da ingaggiare, con costo e mantenimento |

## Formato

**Banda** (`bands.json`)

```json
{
  "id": "slug-unico",
  "name": "Nome della banda",
  "startGold": 500,
  "maxModels": 15,
  "notes": "Regole speciali in breve",
  "heroes":    [ { "id": "capo", "name": "Capo", "role": "Capo", "cost": 60, "max": 1,
                   "stats": { "M": 4, "AC": 4, "AB": 3, "F": 3, "R": 3, "Fe": 1, "I": 4, "A": 1, "Ld": 8 },
                   "equip": "Equipaggiamento di partenza", "skills": "Abilità iniziali" } ],
  "henchmen":  [ { "id": "seguace", "name": "Seguace", "role": "Seguace", "cost": 25, "stats": { } } ]
}
```

**Oggetto** (`equipment.json`): `id`, `name`, `category`, `cost`, `notes` e, facoltativo, `bands`: elenco di `id` di bande che possono comprarlo.

**Mercenario** (`hired.json`): come un eroe, più `upkeep` (mantenimento) e, facoltativo, `bands`.

Le statistiche sono sempre le nove colonne `M, AC, AB, F, R, Fe, I, A, Ld`.

Dopo aver modificato un file, `npm run dev` lo ricarica da solo.
