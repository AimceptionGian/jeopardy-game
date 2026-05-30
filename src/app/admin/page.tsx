"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MatchHistoryEntry } from "@/lib/types";

type BoardSummary = {
  id: string;
  name: string;
  categoryCount: number;
  clueCount: number;
  createdAt: number;
  updatedAt: number;
};

const ADMIN_TOKEN_KEY = "jeopardy-admin-token-v1";

async function adminApi<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }
  return data;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("Enter admin token to manage boards and match history.");
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [boardName, setBoardName] = useState("");
  const [boardJson, setBoardJson] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (stored) {
      setToken(stored);
    }
  }, []);

  const historyCount = useMemo(() => history.length, [history.length]);

  const loadData = useCallback(async () => {
    if (!token.trim()) {
      return;
    }

    const [boardsData, historyData] = await Promise.all([
      adminApi<{ boards: BoardSummary[] }>(token, "/api/admin/boards"),
      adminApi<{ matches: MatchHistoryEntry[] }>(token, "/api/admin/history?limit=200"),
    ]);

    setBoards(boardsData.boards);
    setHistory(historyData.matches);
  }, [token]);

  async function connectAdmin() {
    if (!token.trim()) {
      setMessage("Admin token is required.");
      return;
    }

    setLoading(true);
    try {
      await loadData();
      localStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
      setConnected(true);
      setMessage("Admin connected.");
    } catch (error) {
      setConnected(false);
      setMessage(error instanceof Error ? error.message : "Could not connect admin.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadBoard() {
    if (!token.trim()) {
      setMessage("Connect admin first.");
      return;
    }
    if (!boardName.trim() || !boardJson.trim()) {
      setMessage("Board name and JSON content are required.");
      return;
    }

    setLoading(true);
    try {
      await adminApi<{ ok: true; boardId: string }>(token, "/api/admin/boards", {
        method: "POST",
        body: JSON.stringify({ name: boardName.trim(), content: boardJson }),
      });
      setMessage("Board uploaded to DB.");
      setBoardName("");
      setBoardJson("");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Board upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteBoard(boardId: string) {
    setLoading(true);
    try {
      await adminApi<{ ok: true }>(token, `/api/admin/boards/${boardId}`, { method: "DELETE" });
      setMessage("Board deleted.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete board.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteHistoryEntry(entryId: string) {
    setLoading(true);
    try {
      await adminApi<{ ok: true }>(token, `/api/admin/history/${entryId}`, { method: "DELETE" });
      setMessage("History entry deleted.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete history entry.");
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    setLoading(true);
    try {
      await adminApi<{ ok: true }>(token, "/api/admin/history", { method: "DELETE" });
      setMessage("Match history cleared.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not clear history.");
    } finally {
      setLoading(false);
    }
  }

  async function onFilePicked(file: File) {
    try {
      const content = await file.text();
      setBoardJson(content);
      if (!boardName.trim()) {
        const cleaned = file.name.replace(/\.json$/i, "");
        setBoardName(cleaned);
      }
      setMessage("JSON loaded from file.");
    } catch {
      setMessage("Could not read selected file.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <section className="rounded-3xl border border-white/20 bg-slate-900/70 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-cyan-300">Admin Console</h1>
          <a
            href="/"
            className="rounded-xl border border-slate-500 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-300"
          >
            Back to game
          </a>
        </div>

        <p className="mt-2 text-sm text-slate-300">Upload board JSON to DB and manage stored match history.</p>
        <p className="mt-4 rounded-xl bg-slate-900/80 px-3 py-2 text-xs text-cyan-200">{message}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-300 transition focus:ring"
            type="password"
            placeholder="Admin token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <button
            className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            onClick={() => void connectAdmin()}
            disabled={loading}
          >
            Connect
          </button>
        </div>
      </section>

      {connected && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/20 bg-slate-900/70 p-6 shadow-xl backdrop-blur">
            <h2 className="text-lg font-semibold text-white">Board Library</h2>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-300 transition focus:ring"
                placeholder="Board name"
                value={boardName}
                onChange={(event) => setBoardName(event.target.value)}
              />
              <label className="inline-flex cursor-pointer items-center rounded-xl border border-cyan-300/60 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20">
                Load JSON file
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void onFilePicked(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <textarea
                className="h-48 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-300 transition focus:ring"
                placeholder="Paste board JSON here"
                value={boardJson}
                onChange={(event) => setBoardJson(event.target.value)}
              />
              <button
                className="rounded-xl bg-emerald-300 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                onClick={() => void uploadBoard()}
                disabled={loading}
              >
                Upload board to DB
              </button>
            </div>

            <div className="mt-6 space-y-2">
              {boards.length === 0 ? (
                <p className="text-sm text-slate-300">No boards stored yet.</p>
              ) : (
                boards.map((board) => (
                  <div key={board.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-cyan-200">{board.name}</p>
                        <p className="text-xs text-slate-300">
                          {board.categoryCount} categories | {board.clueCount} clues
                        </p>
                        <p className="mt-1 text-xs text-slate-400">Updated: {new Date(board.updatedAt).toLocaleString()}</p>
                      </div>
                      <button
                        className="rounded-lg bg-rose-300 px-3 py-1 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        onClick={() => void deleteBoard(board.id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/20 bg-slate-900/70 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">Match History ({historyCount})</h2>
              <button
                className="rounded-xl bg-rose-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                onClick={() => void clearHistory()}
                disabled={loading || historyCount === 0}
              >
                Delete all
              </button>
            </div>

            <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {historyCount === 0 ? (
                <p className="text-sm text-slate-300">No history entries found.</p>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-cyan-200">
                          Room {entry.roomCode} | Winner: {entry.winnerName} ({entry.winnerScore})
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          {new Date(entry.finishedAt).toLocaleString()} | {entry.players
                            .map((player) => `${player.name}: ${player.score}`)
                            .join(" | ")}
                        </p>
                      </div>
                      <button
                        className="rounded-lg bg-rose-300 px-3 py-1 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        onClick={() => void deleteHistoryEntry(entry.id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
