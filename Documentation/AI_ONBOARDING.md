# AI Onboarding: Jeopardy Online

## 1) Projektziel
Eine online spielbare Jeopardy-Webseite (React-basiert), die mit Freunden gehostet und gespielt werden kann.

Primäre Ziele:
- Multiplayer mit Raumcode
- Host-gesteuerte Bewertung
- Online- und Local-Mode (Single Device)
- Faire, serverseitige Scoring-Logik
- Match-History
- Wiederverwendbare Lobby für mehrere Matches
- Board-Verwaltung über Admin-Konsole

## 2) Produkt- und Architekturentscheidungen (aktuell)
- Frontend: React + Next.js App Router (TypeScript)
- Backend: Next.js API Routes
- Persistenz: MongoDB Atlas
- Realtime: Client-Polling (ca. 1.2s)
- Zugang: Raumcode + Nickname, kein Pflicht-Login
- Spielmodi:
  - `online`: klassische Mehrgeraete-Raumrunde
  - `local`: Host verwaltet Spieler und steuert das gesamte Match auf einem Geraet
- Quiz-Import: JSON/CSV-Import-Endpoint vorhanden
- Admin-Konsole: token-geschützte Admin-URL (`/admin`)

Warum so:
- Schnell deploybar auf Vercel
- Durable State auf Serverless-Infrastruktur
- Einfache Iteration des Game-Loops
- Boards und History können ohne Code-Änderung gepflegt werden

## 3) Vereinbarte Spielregeln (aktueller Stand)
Diese Regeln sind verbindlich im aktuellen Stand umgesetzt:

- Der Host spielt nicht mit und ist nur Moderator/Judge.
- In der Lobby kann der Host zwischen `online` und `local` wechseln.
- Moduswechsel ist nur in der Lobby und nur vor dem Hinzufuegen von Spielern moeglich.
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
- Wenn niemand buzzern möchte, kann der Host `Continue without buzz` klicken.
- Nur waehrend ein Spieler antwortet (Judging-Phase) kann der Host einen 10s Antwort-Timer ausloesen.
- Der Timer wird allen als globaler Rand-Fortschrittsbalken angezeigt und blockiert keine Eingaben.
- Timer-/Success-/Fail-Sounds sind vorhanden; Lautstaerke wird ueber einen globalen UI-Regler gesetzt.
- Die Frage bleibt offen, bis entweder:
  - jemand korrekt antwortet, oder
  - alle berechtigten Spieler einen Versuch hatten, oder
  - der Host die Frage ohne Buzz weiterzieht
- Die Auswahlreihenfolge der Spieler ist strikt reihum (Join-Reihenfolge).
- Steals unterbrechen die Reihenfolge nicht.
- Es gibt **keine Final-Jeopardy-Runde**.
- Nach der letzten normalen Frage endet das Match direkt mit Podium + Rangliste.
- Der Host kann danach `New game (same lobby)` starten, wodurch alle Spieler in dieselbe Lobby zurückkehren.

## 4) Was bereits implementiert ist
### Core Gameplay
- Room erstellen/joinen
- Room-Modus waehlen (`online`/`local`) in der Lobby
- Host kann Lobby-Spieler entfernen (`Kick` in online, `Remove` in local)
- Lobby + Start durch Host
- Host als reiner Judge (kein Scoring/kein Turn)
- Board mit auswählbaren Clues
- Selector beantwortet direkt (verbal), danach Buzz-Steal (verbal) + Host-Judging
- In Local-Mode kann Host stellvertretend fuer lokale Spieler bedienen (u. a. Buzz-Auswahl)
- Host kann offene Buzz-Phasen manuell weiterziehen
- Host kann im Judging-Popup einen 10s Antwort-Timer starten
- Scoring gemäß obiger House Rules
- Selector-Wechsel bei abgeschlossenen Fragen
- Room kann nach Match-Ende wieder auf Lobby zurückgesetzt werden

### UX / Layout
- Spielerliste unter dem Board
- Aktueller Selector visuell hervorgehoben
- Aktuell antwortender Spieler visuell hervorgehoben
- Aktive Frage erscheint als Popup/Modal
- Aktive Frage kann minimiert und wieder geöffnet werden
- Laufender Antwort-Timer als globaler Randbalken
- Globaler Sound-Regler (Timer, korrekt, falsch)
- Endscreen zeigt Podium + Rangliste

### Content / Boards
- Host kann in der Lobby JSON hochladen
- Host kann in der Lobby ein gespeichertes DB-Board auswählen
- Beim Anwenden eines DB-Boards werden Legacy-Daten vorab normalisiert (z. B. fehlende IDs oder numerische Strings), damit gespeicherte Alt-Boards stabil geladen werden
- Admin-Konsole kann Boards als JSON in die DB laden und wieder löschen

### Match-History / Admin
- Match-History wird in MongoDB gespeichert
- Admin-Konsole kann History anzeigen
- Einzelne History-Einträge können gelöscht werden
- Gesamte History kann gelöscht werden

## 5) Aktuelle technische Struktur
### Wichtige Module
- `src/lib/types.ts`
  - zentrale Typen fuer Room, PublicRoomState, History, Room-Mode, Timer/Judge-Events
- `src/lib/game-store.ts`
  - MongoDB-backed State + komplette Game-Logik
- `src/lib/admin-auth.ts`
  - Token-Schutz für Admin-APIs
- `src/app/api/rooms/*`
  - Room-API (create, join, state, actions)
- `src/app/api/questions/import/route.ts`
  - JSON/CSV Import
- `src/app/api/boards/route.ts`
  - öffentliche Board-Liste für Host-Lobby
- `src/app/api/admin/*`
  - Admin-APIs für Boards und History
- `src/app/page.tsx`
  - Haupt-UI für Lobby, Board, Clue, Judging und Endscreen
- `src/app/admin/page.tsx`
  - Admin-Oberfläche

### API-Actions (room actions)
- `start`
- `reset`
- `select`
- `buzz`
- `localBuzz`
- `skipClue`
- `submit`
- `judge`
- `triggerTimer`
- `setCategories`
- `setBoard`
- `setMode`
- `addLocalPlayer`
- `removePlayer`

Hinweis:
- `finalSubmit` und `finalResolve` existieren noch als Altpfad, liefern aber nur noch einen Fehler, da Final Jeopardy deaktiviert ist.

## 6) Persistenz / Datenmodell
- MongoDB Atlas wird für Rooms, Board-Library und Match-History genutzt
- Inaktive Rooms werden über TTL nach 2 Stunden gelöscht
- Match-History ist auf 50 Einträge begrenzt
- Board-Library ist persistent, bis sie im Adminbereich gelöscht wird

## 7) Bekannte Einschränkungen / offene Punkte
- Realtime ist Polling, kein WebSocket
- Rejoin/Disconnect-Handling ist brauchbar, aber nicht voll ausgebaut
- Einmaliges Board-Auto-Loading in der Lobby ist bewusst begrenzt, um UI-Flackern zu vermeiden
- Öffentliche Board-Liste ist nicht admin-geschützt, aber nur lesend und für Host-Lobby gedacht
- Alt-Final-Typen können später komplett aus `types.ts` entfernt werden, falls gewünscht

## 8) Startanleitung lokal
Im Projektordner:

```cmd
cd /d C:\Users\Gian\Desktop\Coding\QuizWebsite\jeopardy-online
"C:\Program Files\nodejs\npm.cmd" install --prefer-offline --no-audit --no-fund
copy .env.local.example .env.local
"C:\Program Files\nodejs\npm.cmd" run dev
```

Pflicht in `.env.local`:
- `MONGODB_URI`
- `MONGODB_DB`

Optional:
- `ADMIN_TOKEN`

## 9) Verifikation (Smoke Tests)
Nach Start:
- Zwei oder drei Browser/Profile öffnen
- Ein Raum erstellen, weitere Spieler joinen
- Optional: auf `Local` wechseln und lokale Spieler im Host-Client hinzufügen
- In der Lobby:
  - JSON-Import testen
  - DB-Board-Auswahl testen
  - Spieler-Kick/Remove testen
- Match starten
- Prüfen:
  - Selector falsch -> voller Abzug
  - Steal richtig -> halber Gewinn
  - Steal falsch -> halber Abzug
  - Host-Timer im Judging-Popup -> 10s Sound + globaler Randbalken
  - Niemand buzzert -> Host klickt `Continue without buzz`
- Alle Clues spielen bis Match-Ende
- Podium und Rangliste prüfen
- `New game (same lobby)` testen
- `/admin` öffnen und Boards/History prüfen

## 10) Deployment / Betrieb
- Bevorzugt auf Vercel
- Erforderliche Env Vars in Vercel:
  - `MONGODB_URI`
  - `MONGODB_DB`
  - optional `ADMIN_TOKEN`

## 11) Priorisierte Next Steps
1. Board-Library weiter ausbauen
- DB-Boards in Admin auch ansehen/downloaden
- Board-Namen umbenennen können

2. Typen aufräumen
- Nicht mehr verwendete Final-Typen und Felder konsequent entfernen

3. Realtime verbessern
- Von Polling auf WebSocket/SSE migrieren

4. QA und Tests
- Unit-Tests für Scoring/State-Machine
- Integrationstests für komplette Match-Flows

## 12) Hinweise für die nächste KI
- `game-store.ts` ist die zentrale State-Maschine; Änderungen dort wirken fast überall
- Bei Lobby-/Polling-Bugs zuerst auf wiederholte Effects oder speichernde Reads in `page.tsx` schauen
- Admin-API ist über `ADMIN_TOKEN` geschützt; für neue Admin-Features dort anknüpfen
- House Rules nicht in Standard-Jeopardy zurückdrehen; der aktuelle Ablauf ist bewusst custom

## 13) Wichtige Entwicklungs-Historie (Windows Setup Problem)
Im alten Workspace gab es massive Probleme mit beschädigtem `node_modules` unter Windows:
- unvollständige Pakete (z. B. `next` ohne `package.json`)
- fehlende `.bin` Shims
- `ENOTEMPTY`/Locking/Permission-Probleme
- PowerShell Script Policy Konflikt (`npm.ps1`)

Lösungspfad:
- Neues Projekt auf C-Laufwerk in frischem Ordner
- Altlasten (`node_modules`, `.next`) nicht mitkopieren
- Installation über explizites `npm.cmd`
