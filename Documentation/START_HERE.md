# START HERE (Quickstart)

## 1) In den Projektordner wechseln
```cmd
cd /d C:\Users\Gian\Desktop\Coding\QuizWebsite\jeopardy-online
```

## 2) Dependencies installieren (Windows-sicher)
```cmd
"C:\Program Files\nodejs\npm.cmd" install --prefer-offline --no-audit --no-fund
```

## 3) `.env.local` anlegen
- Kopiere `.env.local.example` nach `.env.local`
- Trage mindestens diese Werte ein:
	- `MONGODB_URI`
	- `MONGODB_DB=jeopardy-online`
- Optional für Admin-Funktionen:
	- `ADMIN_TOKEN`

## 4) Dev-Server starten
```cmd
"C:\Program Files\nodejs\npm.cmd" run dev
```

## 5) App öffnen
- Im Browser: http://localhost:3000

## 6) Schneller Funktions-Check (2-3 Spieler)

### A) Online-Modus
1. Browser A: Host erstellt Room (Host spielt nicht mit)
2. In Lobby bleibt Mode auf `Online`
3. Browser B/C: Zwei Spieler joinen den Room
4. Optional: Host importiert JSON-Fragenset in der Lobby oder wählt ein DB-Board aus
5. Optional: Host kann ungewollte Spieler per `Kick` aus der Lobby entfernen
6. Host startet Match
7. Selector wählt Karte und beantwortet direkt mündlich (ohne Buzz als Erstversuch)
8. Host bewertet korrekt/falsch
9. Nur während ein Spieler antwortet (Host-Judging-Popup): Host kann `Start 10s Answer Timer` drücken
10. Prüfen: Timer läuft 10s mit Sound und wird allen als Randbalken angezeigt
11. Bei falsch: anderer Spieler kann buzzen (Steal) und mündlich antworten
12. Wenn niemand buzzen will: Host klickt `Continue without buzz`
13. Prüfen: Nächster Selector bleibt reihum
14. Alle Fragen bis Match-Ende spielen
15. Endscreen zeigt Podium + Rangliste
16. Host klickt optional `New game (same lobby)` und alle landen wieder in derselben Lobby

### B) Local-Modus (ein Gerät)
1. Host erstellt Room
2. In Lobby auf Mode `Local (one device)` wechseln
3. Host fügt lokale Spieler per Name hinzu (`Add player`)
4. Optional: lokale Spieler per `Remove` wieder entfernen
5. Host startet Match
6. Host steuert Spielfluss für alle Spieler auf demselben Gerät
7. In offenen Buzz-Phasen nutzt Host die Local-Buzz-Auswahl

UI-Hinweis:
- Die aktive Frage erscheint als Popup/Modal.
- Die aktive Frage kann minimiert und wieder geöffnet werden.
- Die Spielerliste steht unter dem Board, inkl. Hervorhebung von Selector und aktiv antwortendem Spieler.
- Oben im Screen erscheint bei laufendem Antwort-Timer ein globaler Fortschrittsbalken.
- Mit dem `Sound`-Regler in der Room-Leiste kann die Lautstärke für Timer/Success/Fail zentral eingestellt werden.

## 7) Admin-Konsole (optional)
- URL: http://localhost:3000/admin
- Admin-Token eingeben
- Dort können Board-JSONs in die DB geladen und Match-History-Einträge gelöscht werden

## 8) Wenn Installation "hängt"
- Nur abbrechen, wenn **10+ Minuten** absolut keine neue Zeile kommt.
- Wenn noch neue Zeilen erscheinen (cache miss/stale/hit), weiterlaufen lassen.

## 9) Wenn `npm` in PowerShell blockiert ist
Nutze weiterhin explizit `npm.cmd`:
```cmd
"C:\Program Files\nodejs\npm.cmd" <dein-befehl>
```

## 10) Prüfen, ob Install vollständig ist
```cmd
if exist node_modules\next\package.json (echo NEXT_OK) else (echo NEXT_MISSING)
if exist node_modules\.bin\next.cmd (echo BIN_OK) else (echo BIN_MISSING)
```

## 11) Wenn `NEXT_MISSING` oder `BIN_MISSING`
```cmd
"C:\Program Files\nodejs\npm.cmd" install --prefer-offline --no-audit --no-fund --loglevel verbose
```

## 12) Für die nächste KI
- Volle Projekt-Doku: `Documentation/AI_ONBOARDING.md`
- Enthält Architektur, Regeln, API, offenen Scope und nächste Schritte.

## 13) Deployment (gratis)
- Empfohlen: Vercel Hobby Plan
- Anleitung: `Documentation/DEPLOYMENT.md`
