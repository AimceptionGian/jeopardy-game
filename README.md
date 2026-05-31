# Jeopardy Online MVP

Online Jeopardy game built with Next.js App Router and MongoDB Atlas.

Current product shape:
- Host is moderator only and does not play.
- Lobby supports `online` mode and `local` mode (single-device play controlled by host).
- Players answer verbally; host judges correct/wrong.
- Host can remove/kick players in the lobby.
- During active answers, host can trigger a 10s answer timer from the question popup.
- Timer is shown to all players as a screen-edge progress bar and includes dramatic countdown audio.
- Global sound volume slider controls timer, success, and fail sounds.
- No Final Jeopardy round.
- Finished matches show a podium and full ranking.
- The same room can be reset back to the lobby for a new match.
- Boards can be imported from JSON or selected from the DB in the lobby.
- DB board selection in lobby now normalizes legacy board data (for example missing IDs/string values) before applying.
- New rooms now default to the latest DB board (same source as lobby dropdown), not a hardcoded sample board.
- Lobby board dropdown is synced with server-side `currentBoardId` to reliably show the actually active board.
- An admin console can upload boards to the DB and manage match history.

## Local Quickstart

See `Documentation/START_HERE.md` for full setup and smoke-test flow.

Minimal commands:

```cmd
cd /d C:\Users\Gian\Desktop\Coding\QuizWebsite\jeopardy-online
"C:\Program Files\nodejs\npm.cmd" install --prefer-offline --no-audit --no-fund
"C:\Program Files\nodejs\npm.cmd" run dev
```

App URL: http://localhost:3000

Required environment variables:
- `MONGODB_URI`
- `MONGODB_DB`

Optional but recommended:
- `ADMIN_TOKEN`

## Deployment (Free)

Recommended: **Vercel Hobby Plan**

Step-by-step guide:
- `Documentation/DEPLOYMENT.md`

## Admin Console

Admin UI:
- `/admin`

Current admin capabilities:
- upload board JSON into MongoDB
- list stored boards
- delete stored boards
- view match history
- delete individual history entries
- clear all history

## Gameplay Modes

- `Online`: players join with room code on their own devices.
- `Local`: host adds players in lobby and runs the full game from one device.

## Current MVP Note

Rooms, board library, and match history are persisted in MongoDB Atlas.

Inactive rooms are automatically removed after 2 hours via MongoDB TTL.
