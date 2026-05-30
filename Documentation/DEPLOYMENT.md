# Deployment (Gratis) - Vercel

## Empfehlung
Für dieses Next.js-Projekt ist der **Vercel Hobby Plan** die einfachste kostenlose Option.

## 1) Vor dem Deploy lokal prüfen
```cmd
cd /d C:\Users\Gian\Desktop\Coding\QuizWebsite\jeopardy-online
"C:\Program Files\nodejs\npm.cmd" install --prefer-offline --no-audit --no-fund
"C:\Program Files\nodejs\npm.cmd" run lint
"C:\Program Files\nodejs\npm.cmd" run build
```

## 2) Code zu GitHub pushen
```cmd
git add .
git commit -m "Prepare Vercel deployment"
git push
```

## 3) Vercel-Projekt anlegen (kostenlos)
1. Auf https://vercel.com einloggen
2. "Add New..." -> "Project"
3. GitHub-Repo importieren
4. Framework: Next.js (wird automatisch erkannt)
5. "Deploy" klicken

## 4) Nach Deploy testen
- Homepage oeffnen
- Room erstellen
- Zwei Spieler joinen
- Eine kurze Runde spielen
- JSON-Import in Lobby testen

## Wichtiger Hinweis zum aktuellen MVP
Aktuell werden Rooms und Match-History **in-memory** gespeichert.

Das bedeutet auf Cloud/Serverless:
- Daten gehen bei Neustarts/Cold Starts verloren
- Mehrere Instanzen teilen den Zustand nicht verlässlich

Fuer echte stabile Online-Runden als naechster Schritt:
1. Persistenz auf DB (z. B. Supabase Postgres) umstellen
2. Optional Realtime-Kanal (SSE/WebSocket) ergänzen

## Kostenlose Alternativen (optional)
- Netlify Free
- Cloudflare Pages Free

Beide sind moeglich, aber fuer Next.js ist Vercel meist am unkompliziertesten.
