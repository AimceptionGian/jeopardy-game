# Jeopardy Online MVP

Online Jeopardy game built with Next.js App Router.

## Local Quickstart

See `Documentation/START_HERE.md` for full setup and smoke-test flow.

Minimal commands:

```cmd
cd /d C:\Users\Gian\Desktop\Coding\QuizWebsite\jeopardy-online
"C:\Program Files\nodejs\npm.cmd" install --prefer-offline --no-audit --no-fund
"C:\Program Files\nodejs\npm.cmd" run dev
```

App URL: http://localhost:3000

## Deployment (Free)

Recommended: **Vercel Hobby Plan**

Step-by-step guide:
- `Documentation/DEPLOYMENT.md`

## Current MVP Note

Rooms and history are currently in-memory. This is fine for local demos, but not durable across server restarts or serverless instances.
