# Cronache di Mordheim

App per gestire una campagna di Mordheim con gli amici: bande, campagna ed esplorazione a tabelle. Si usa dal browser, si installa come app sul telefono e può diventare un APK Android.

## Cosa fa

- **Bande**: eroi, gruppi di seguaci e mercenari con le nove caratteristiche, equipaggiamento, abilità, esperienza e avanzamenti. Rating, valore e limite di guerrieri calcolati da soli. Acquisto di oggetti dal catalogo con scalo delle corone. Magazzino.
- **Campagna**: settimane, battaglie, classifica, appunti e impostazioni (punti, soglie di esperienza).
- **Esplora**: scegli la tabella, scrivi il tiro uscito (o fai tirare all'app) e leggi il risultato. “Applica” aggiunge corone, schegge e oggetti alla banda e scrive nel diario.
- **Tabelle**: modificabili riga per riga. Dadi supportati: `d6`, `2d6`, `d66` e `Nd6` (un d6 per ogni eroe che esplora).
- **Online**: la campagna si condivide con un codice. Chi ha il codice giocatore modifica, chi ha il codice spettatore guarda.
- **Offline**: tutto funziona anche senza rete, i dati restano sul dispositivo.

## Sviluppo

```bash
npm install
npm run dev        # sito in locale
npm test           # test della logica
npm run build      # controllo dei tipi e build in dist/
```

Servono Node 22 o più recente.

## Mettere i tuoi dati dal manuale

Bande, oggetti e mercenari stanno in `src/data/*.json`. Ci sono solo segnaposto: il formato è spiegato in [`src/data/README.md`](src/data/README.md). Le tabelle di esplorazione, ferite ed eventi sono semplificate e si correggono dall'app, nella scheda Tabelle, oppure nei valori iniziali di `src/engine.ts`.

## Pubblicare il sito su GitHub Pages

1. Crea un repository vuoto sul tuo account GitHub e carica questi file.
2. In **Settings → Pages**, alla voce *Source* scegli **GitHub Actions**.
3. Fai una release con un tag uguale alla versione di `package.json`:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

Il sito esce su `https://<tuo-utente>.github.io/<nome-repo>/`. Ogni push su `main` esegue solo test e build, senza pubblicare nulla.

## Campagna online (Supabase)

Facoltativo. Senza, l'app resta locale.

1. Crea un progetto gratuito su [supabase.com](https://supabase.com).
2. Apri **SQL Editor**, incolla il contenuto di [`supabase/mordheim.sql`](supabase/mordheim.sql) e premi Run. Si può rieseguire.
3. In **Authentication → Sign In / Providers** abilita **Allow anonymous sign-ins**.
4. In **Project Settings → API** copia *Project URL* e la chiave *anon public*.
5. In locale: copia `.env.example` in `.env` e incolla i due valori.
6. Per il sito pubblicato: nel repository, **Settings → Secrets and variables → Actions → Variables**, crea `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

Le due chiavi sono pubbliche per natura: a proteggere i dati sono le regole di sicurezza per riga dello schema SQL.

Nell'app, scheda **Online**: l'organizzatore preme “Crea e condividi” e manda ai giocatori il codice giocatore. Gli altri scrivono il codice in “Entra con un codice”.

### Come funziona la sincronizzazione

Ogni banda, battaglia, tabella e voce di diario è una riga separata, quindi due giocatori che toccano bande diverse non si sovrascrivono. Se due persone modificano la stessa banda nello stesso momento, vince l'ultima scrittura.

## App Android

```bash
npm run android    # build, sincronizza e apre Android Studio
```

Con un tag di versione la workflow `release.yml` pubblica anche `mordheim.apk` tra gli asset della release. L'APK è firmato con la chiave di debug: per far installare ogni release sopra la precedente, salva la tua chiave in base64 nel secret `ANDROID_DEBUG_KEYSTORE`.

## Struttura

```
src/engine.ts      regole e calcoli (puri, con test)
src/docs.ts        scomposizione dello stato in righe per la sincronizzazione
src/sync.ts        Supabase: accesso anonimo, codici, tempo reale
src/store.ts       stato dell'app e salvataggio locale
src/data/          bande, oggetti e mercenari dal manuale
supabase/          schema SQL con sicurezza per riga
.github/workflows/ test e build, release con Pages e APK
```

## Licenza

MIT.

Mordheim è un marchio di Games Workshop. Questo progetto non è affiliato né approvato da Games Workshop e non include il testo del regolamento.
