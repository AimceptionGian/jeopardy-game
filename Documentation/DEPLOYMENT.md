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

## 4) Environment Variables in Vercel setzen
Pflicht:
- `MONGODB_URI`
- `MONGODB_DB=jeopardy-online`

Optional für Admin-Features:
- `ADMIN_TOKEN`

Danach neu deployen.

## 5) Nach Deploy testen
- Homepage öffnen
- Room erstellen
- Zwei Spieler joinen
- Eine kurze Runde spielen
- JSON-Import in Lobby testen
- DB-Board-Auswahl in Lobby testen
- Endscreen mit Podium/Rangliste testen
- `New game (same lobby)` testen

## 6) Admin testen (optional)
- `/admin` öffnen
- Admin-Token eingeben
- Board-JSON hochladen
- Match-History ansehen
- Einzelnen History-Eintrag löschen

## Wichtiger Hinweis zum aktuellen MVP
Rooms, Board-Library und Match-History werden in **MongoDB Atlas** gespeichert.

Zusatz:
- Inaktive Rooms werden nach 2 Stunden automatisch über TTL gelöscht.
- Aktive Rooms bleiben durch laufende Poll-Updates erhalten.

Bekannte Architekturgrenze:
- Realtime läuft aktuell über Polling, nicht über WebSockets.

## Kostenlose Alternativen (optional)
- Netlify Free
- Cloudflare Pages Free

Beide sind möglich, aber für Next.js ist Vercel meist am unkompliziertesten.
