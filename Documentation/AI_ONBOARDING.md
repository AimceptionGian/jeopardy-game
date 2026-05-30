# AI Onboarding: Jeopardy Online

## 1) Projektziel
Eine online spielbare Jeopardy-Webseite (React-basiert), die mit Freunden gehostet und gespielt werden kann.

Primäre Ziele:
- Multiplayer mit Raumcode
- Host-gesteuerte Bewertung
- Faire, serverseitige Scoring-Logik
- Final Jeopardy Runde
- Match-History

## 2) Produkt- und Architekturentscheidungen (Planung)
Diese Entscheidungen wurden getroffen:
- Frontend: React + Next.js App Router (TypeScript)
- Backend: Next.js API Routes (kein separates Backend-Projekt)
- Persistenz aktuell: In-Memory Store (MVP/prototypisch)
- Realtime aktuell: Polling vom Client (ca. 1.2s)
- Zugang: Raumcode + Nickname, kein Pflicht-Login
- Quiz-Import: JSON/CSV-Import-Endpoint vorhanden

Warum so:
- Schnell deploybar (Vercel-kompatibel)
- Einfache Iteration des Game-Loops
- Fokus auf spielbare MVP-Funktion statt initialer Infrastrukturkomplexität

## 3) Vereinbarte Spielregeln (Custom House Rules)
Diese Regeln sind verbindlich im aktuellen Stand umgesetzt:

- Der Host spielt nicht mit und ist nur Moderator/Judge.
- Der aktive Spieler (Selector) wählt ein Feld.
- Der Selector beantwortet die gewählte Frage direkt (ohne Buzz als Erstversuch).
- Antworten werden mündlich gegeben; es gibt kein Antwort-Textfeld im UI.
- Erstversuch (Selector):
  - korrekt: voller Kartenwert als Plus
  - falsch: voller Kartenwert als Minus
- Danach Steal-Phase für die übrigen Spieler:
  - Buzz ist erst nach einem falschen Selector-Versuch freigeschaltet
  - Steal korrekt: halber Kartenwert als Plus
  - Steal falsch: halber Kartenwert als Minus
- Ein Spieler darf dieselbe Frage nur einmal versuchen.
- Die Frage bleibt offen, bis entweder:
  - jemand korrekt antwortet, oder
  - alle berechtigten Spieler einen Versuch hatten
- Die Auswahlreihenfolge der Spieler ist strikt reihum (Join-Reihenfolge) und geht nach jeder abgeschlossenen Frage zum nächsten Spieler weiter.
- Steals unterbrechen die Reihenfolge nicht (korrekter Steal gibt Punkte, aber nicht den nächsten Selector-Zug).

## 4) Was bereits implementiert ist
### Core Gameplay
- Room erstellen/joinen
- Lobby + Start durch Host
- Host als reiner Judge (kein Scoring/kein Turn)
- Board mit auswählbaren Clues
- Selector beantwortet direkt (verbal), danach Buzz-Steal (verbal) + Host-Judging
- Scoring gemäß obiger House Rules
- Selector-Wechsel bei korrekter Antwort

### UX / Layout (aktualisiert)
- Spielerliste wird unter dem Board angezeigt
- Aktueller Selector wird visuell hervorgehoben
- Aktuell antwortender Spieler wird visuell hervorgehoben
- Aktive Frage erscheint als Popup/Modal statt unter dem Board (kein Scrollen nötig)

### Final Jeopardy
- Nach Verbrauch aller Clues Übergang in `final`
- Jeder Spieler submittet genau einmal: Wager + Answer
- Host kann final nur auflösen, wenn alle submitted haben
- Finale Auswertung und Übergang in `finished`

### Match-History
- In-Memory History-Liste vorhanden
- API-Endpoint für History vorhanden
- Anzeige im UI vorhanden

### Content Import
- Endpoint für JSON/CSV-Import vorhanden
- Grundvalidierung für Kategorien/Clues vorhanden
- Host kann in der Lobby vor Match-Start ein JSON-Fragenset importieren
- Der Import ersetzt das aktuelle Board im Room (nur vor Start erlaubt)

## 5) Aktuelle technische Struktur
### Wichtige Module
- `src/lib/types.ts`
  - zentrale Typen für Room, PublicRoomState, Final-Daten, History
- `src/lib/game-store.ts`
  - In-Memory State + komplette Game-Logik
- `src/app/api/rooms/*`
  - Room-API (create, join, state, actions)
- `src/app/api/history/route.ts`
  - History-API
- `src/app/api/questions/import/route.ts`
  - JSON/CSV Import
- `src/app/page.tsx`
  - UI für Lobby, Board, Clue, Judging, Final, History

### API-Actions (room actions)
- `start`
- `select`
- `buzz`
- `submit`
- `judge`
- `finalSubmit`
- `finalResolve`

## 6) Bekannte Einschränkungen / offene Punkte
- Persistenz ist noch In-Memory:
  - Prozess-Neustart verliert Rooms/History
- Realtime ist Polling, kein WebSocket
- Rejoin/Disconnect-Handling nur basic
- Final-Antwortmatching ist aktuell einfach (string-basierter Vergleich)
- Keine Auth/Profil/Leaderboard-Features

## 7) Wichtige Entwicklungs-Historie (Windows Setup Problem)
Im alten Workspace gab es massive Probleme mit beschädigtem `node_modules` unter Windows:
- unvollständige Pakete (z. B. `next` ohne `package.json`)
- fehlende `.bin` Shims
- `ENOTEMPTY`/Locking/Permission-Probleme
- PowerShell Script Policy Konflikt (`npm.ps1`)

Lösungspfad:
- Neues Projekt auf C-Laufwerk in frischem Ordner
- Altlasten (`node_modules`, `.next`) nicht mitkopieren
- Installation über explizites `npm.cmd`

## 8) Startanleitung im neuen Workspace
Im neuen Ordner ausführen:

```cmd
cd /d C:\Users\Gian\Desktop\Coding\QuizWebsite\jeopardy-online
"C:\Program Files\nodejs\npm.cmd" install --prefer-offline --no-audit --no-fund
"C:\Program Files\nodejs\npm.cmd" run dev
```

Wenn PowerShell genutzt wird und `npm` blockiert ist:
- weiter über `npm.cmd` mit absolutem Pfad arbeiten

## 9) Verifikation (Smoke Tests)
Nach Start:
- Zwei Browser/Profiles öffnen
- Ein Raum erstellen, zweiter Spieler joint
- Match starten
- Prüfen:
  - Selector falsch -> voller Abzug
  - Steal richtig -> halber Gewinn
  - Steal falsch -> halber Abzug
- Alle Clues spielen bis Final
- Alle Spieler submitten Final
- Host resolved Final
- Match in History sichtbar

## 10) Priorisierte Next Steps für die nächste KI
1. Stabilisierung Laufzeit/Install
- Sicherstellen, dass `package-lock.json` sauber erzeugt ist
- `npm ci` als Standard für reproduzierbare lokale Setups

2. Persistenz auf echte DB umstellen (Supabase/Postgres)
- Rooms, players, score events, history persistieren
- Rejoin-Tokens/Sessions sauber modellieren

3. Realtime verbessern
- Von Polling auf WebSocket/SSE migrieren
- Serverseitige Event-Reihenfolge klar versionieren

4. Rejoin-Robustheit
- Disconnect-Fenster + State-Recovery
- Idempotente Action-Verarbeitung

5. QA und Tests
- Unit-Tests für Scoring/State-Machine
- Integrationstests für komplette Match-Flows

## 11) Definition of Done für "MVP online mit Freunden"
- Öffentliche URL erreichbar
- 2-6 Spieler können eine Runde komplett spielen
- House Rules korrekt umgesetzt
- Final Jeopardy inkl. Auswertung funktioniert
- Match-History nach Spielende einsehbar
- Keine kritischen Abstürze im Normalfluss

## 12) Hinweise für die nächste KI
- Zuerst Installationsintegrität prüfen:
  - `node_modules/next/package.json`
  - `node_modules/.bin/next.cmd`
  - `package-lock.json`
- Bei ungewöhnlichem Installverhalten nicht endlos abbrechen/restarten, sondern:
  - Logs aus `C:\Users\Gian\AppData\Local\npm-cache\_logs` auswerten
  - Danach gezielt korrigieren
- Spielregeln nicht "Jeopardy-standard" zurückdrehen: House Rules sind gewollt.

---
Status beim Erstellen dieser Dokumentation:
- Planung + Kernimplementierung vorhanden
- Setup auf neuem C-Workspace vorbereitet
- Nächster Fokus: stabile Dependency-Installation und danach Smoke-Test
