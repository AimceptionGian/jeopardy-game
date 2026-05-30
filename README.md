# Jeopardy Online MVP

Online Jeopardy game built with Next.js App Router and MongoDB Atlas.

Current product shape:
- Host is moderator only and does not play.
- Players answer verbally; host judges correct/wrong.
- No Final Jeopardy round.
- Finished matches show a podium and full ranking.
- The same room can be reset back to the lobby for a new match.
- Boards can be imported from JSON or selected from the DB in the lobby.
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

## Current MVP Note

Rooms, board library, and match history are persisted in MongoDB Atlas.

Inactive rooms are automatically removed after 2 hours via MongoDB TTL.
