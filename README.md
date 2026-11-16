# Ordna

Prosjekt- og hverdagssystem fra InnSpæll AS: innboks, plukkliste, prosjekter, oppgaver, avtaler og dagsoversikt.

## Kom i gang

```bash
npm install
# Supabase-URL og offentlig nøkkel ligger i src/lib/supabase/config.ts
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
