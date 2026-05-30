# START HERE (Quickstart)

## 1) In den neuen Projektordner wechseln
```cmd
cd /d C:\Users\Gian\Desktop\Coding\QuizWebsite\jeopardy-online
```

## 2) Dependencies installieren (Windows-sicher)
```cmd
"C:\Program Files\nodejs\npm.cmd" install --prefer-offline --no-audit --no-fund
```

## 3) Dev-Server starten
```cmd
"C:\Program Files\nodejs\npm.cmd" run dev
```

## 4) App öffnen
- Im Browser: http://localhost:3000

## 5) Schneller Funktions-Check (2 Spieler)
1. Browser A: Host erstellt Room (Host spielt nicht mit)
2. Browser B/C: Zwei Spieler joinen den Room
3. Optional: Host importiert JSON-Fragenset in der Lobby
4. Host startet Match
5. Selector wählt Karte und beantwortet direkt mündlich (ohne Buzz)
6. Host bewertet korrekt/falsch
7. Bei falsch: anderer Spieler kann buzzen (Steal) und mündlich antworten
8. Host bewertet Steal korrekt/falsch
9. Prüfen: Nächster Selector ist immer der nächste Spieler in Reihenfolge (Steals ändern das nicht)
10. Bis Final Jeopardy spielen und Final auflösen

UI-Hinweis:
- Die aktive Frage erscheint als Popup/Modal.
- Die Spielerliste steht unter dem Board, inkl. Hervorhebung von Selector und aktiv antwortendem Spieler.

## 6) Wenn Installation "hängt"
- Nur abbrechen, wenn **10+ Minuten** absolut keine neue Zeile kommt.
- Wenn noch neue Zeilen erscheinen (cache miss/stale/hit), weiterlaufen lassen.

## 7) Wenn `npm` in PowerShell blockiert ist
Nutze weiterhin explizit `npm.cmd`:
```cmd
"C:\Program Files\nodejs\npm.cmd" <dein-befehl>
```

## 8) Prüfen, ob Install vollständig ist
```cmd
if exist node_modules\next\package.json (echo NEXT_OK) else (echo NEXT_MISSING)
if exist node_modules\.bin\next.cmd (echo BIN_OK) else (echo BIN_MISSING)
```

## 9) Wenn `NEXT_MISSING` oder `BIN_MISSING`
```cmd
"C:\Program Files\nodejs\npm.cmd" install --prefer-offline --no-audit --no-fund --loglevel verbose
```

## 10) Für die nächste KI
- Volle Projekt-Doku: `Documentation/AI_ONBOARDING.md`
- Enthält Architektur, Regeln, API, offenen Scope und nächste Schritte.

## 11) Deployment (gratis)
- Empfohlen: Vercel Hobby Plan
- Anleitung: `Documentation/DEPLOYMENT.md`
