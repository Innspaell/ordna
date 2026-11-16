# Ordna

Prosjekt- og hverdagssystem fra InnSpæll AS: innboks, plukkliste, prosjekter, oppgaver, avtaler og dagsoversikt.

## Kom i gang

```bash
npm install
cp .env.example .env.local   # fyll inn Supabase-URL og anon-nøkkel
npx supabase start           # lokal database (krever Docker)
npm run dev
```

## Kommandoer

| Kommando | Hva den gjør |
| --- | --- |
| `npm run dev` | Utviklingsserver |
| `npm run build` | Produksjonsbygg |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript-sjekk |
| `npm test` | Enhetstester (Vitest) |

Se `CLAUDE.md` for prinsipper, datamodell og arbeidsmåte.
