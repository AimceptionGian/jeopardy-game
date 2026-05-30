"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category, MatchHistoryEntry, PublicRoomState } from "@/lib/types";

type Session = {
  roomCode: string;
  playerId: string;
  name: string;
};

const STORAGE_KEY = "jeopardy-session-v1";

function readStoredSession(): Session | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Session;
    if (parsed.roomCode && parsed.playerId && parsed.name) {
      return parsed;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }
  return data;
}

export default function Home() {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [finalWager, setFinalWager] = useState("0");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [historyMenuOpen, setHistoryMenuOpen] = useState(false);
  const [importingQuestions, setImportingQuestions] = useState(false);
  const [message, setMessage] = useState("Create or join a room to begin.");
  const [loading, setLoading] = useState(false);
  const roomNotFoundCount = useState(0);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api<{ matches: MatchHistoryEntry[] }>("/api/history?limit=8");
      setHistory(data.matches);
    } catch {
      // History is optional for gameplay, so keep the app running if this request fails.
    }
  }, []);

  useEffect(() => {
    const restoreSession = setTimeout(() => {
      const storedSession = readStoredSession();
      if (!storedSession) {
        return;
      }
      setSession(storedSession);
      setName(storedSession.name);
    }, 0);

    return () => clearTimeout(restoreSession);
  }, []);

  const pollRoom = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const state = await api<PublicRoomState>(
        `/api/rooms/${session.roomCode}?playerId=${encodeURIComponent(session.playerId)}`,
      );
      roomNotFoundCount[1](0);
      setRoom(state);
      setMessage(`Room ${state.code} | Phase: ${state.phase}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to sync room state.";
      if (errorMessage.toLowerCase().includes("player not found")) {
        clearSession();
        setMessage("Your player session is no longer valid. Please join or create a room again.");
        return;
      }
      if (errorMessage.toLowerCase().includes("room not found")) {
        roomNotFoundCount[1]((prev) => {
          const next = prev + 1;
          if (next >= 4) {
            setSession(null);
            setRoom(null);
            localStorage.removeItem(STORAGE_KEY);
            setMessage("Your previous room no longer exists. Please create or join a new room.");
          } else {
            setMessage("Room temporarily unavailable, retrying…");
          }
          return next;
        });
        return;
      }
      setMessage(errorMessage);
    }
  }, [session, roomNotFoundCount, clearSession]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const initialSync = setTimeout(() => {
      void pollRoom();
    }, 0);
    const timer = setInterval(() => {
      void pollRoom();
    }, 1200);
    return () => {
      clearTimeout(initialSync);
      clearInterval(timer);
    };
  }, [pollRoom, session]);

  useEffect(() => {
    const initialHistorySync = setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => clearTimeout(initialHistorySync);
  }, [loadHistory]);

  useEffect(() => {
    if (room?.phase === "finished") {
      const refreshHistory = setTimeout(() => {
        void loadHistory();
      }, 0);
      return () => clearTimeout(refreshHistory);
    }
  }, [loadHistory, room?.phase]);

  const self = useMemo(
    () => room?.players.find((player) => player.id === session?.playerId),
    [room, session?.playerId],
  );
  const contestants = room?.players.filter((player) => !player.isHost) ?? [];
  const hostPlayer = room?.players.find((player) => player.isHost);

  const isHost = Boolean(self?.isHost);
  const isSelector = Boolean(room && session && room.selectorId === session.playerId);
  const answeringPlayerId =
    room?.phase === "judging" ? (room.activeClue?.buzzedPlayerId ?? room.selectorId) : undefined;
  const answeringPlayer = room?.players.find((player) => player.id === answeringPlayerId);
  const selectorIndex = contestants.findIndex((player) => player.id === room?.selectorId);
  const selectorName = contestants.find((player) => player.id === room?.selectorId)?.name ?? "Unknown";
  const turnPosition = selectorIndex >= 0 ? selectorIndex + 1 : 0;
  const final = room?.final;
  const selfFinal = final?.selfSubmission;
  const finalSubmitted = Boolean(selfFinal);
  const allFinalSubmitted = Boolean(final && final.submissionCount === contestants.length);
  const canBuzz = Boolean(
    room?.phase === "clue" &&
      room.activeClue &&
      !room.activeClue.buzzedPlayerId &&
      session &&
      !self?.isHost &&
      !room.activeClue.attemptedPlayerIds.includes(session.playerId),
  );
  const isBuzzed = Boolean(room && session && room.activeClue?.buzzedPlayerId === session.playerId);

  const persistSession = useCallback((nextSession: Session) => {
    setSession(nextSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
    setRoom(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  async function createRoom() {
    if (!name.trim()) {
      setMessage("Please enter a nickname.");
      return;
    }
    setLoading(true);
    try {
      const created = await api<{ roomCode: string; playerId: string }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ hostName: name.trim() }),
      });
      persistSession({ roomCode: created.roomCode, playerId: created.playerId, name: name.trim() });
      setJoinCode(created.roomCode);
      setMessage(`Room ${created.roomCode} created.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create room.");
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    if (!name.trim() || !joinCode.trim()) {
      setMessage("Enter nickname and room code.");
      return;
    }
    setLoading(true);
    try {
      const joined = await api<{ roomCode: string; playerId: string }>(
        `/api/rooms/${joinCode.trim().toUpperCase()}/join`,
        {
          method: "POST",
          body: JSON.stringify({ name: name.trim() }),
        },
      );
      persistSession({ roomCode: joined.roomCode, playerId: joined.playerId, name: name.trim() });
      setMessage(`Joined room ${joined.roomCode}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join room.");
    } finally {
      setLoading(false);
    }
  }

  async function sendAction(payload: {
    type: "start" | "select" | "buzz" | "submit" | "judge" | "finalSubmit" | "finalResolve" | "setCategories";
    clueId?: string;
    answer?: string;
    isCorrect?: boolean;
    wager?: number;
    categories?: Category[];
  }) {
    if (!session) {
      return;
    }

    setLoading(true);
    try {
      await api<{ ok: true }>(`/api/rooms/${session.roomCode}/actions`, {
        method: "POST",
        body: JSON.stringify({ ...payload, playerId: session.playerId }),
      });
      await pollRoom();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  async function importQuestionsJson(file: File) {
    if (!session || !room || !isHost || room.phase !== "lobby") {
      return;
    }

    setImportingQuestions(true);
    try {
      const content = await file.text();
      const imported = await api<{ categories: Category[] }>("/api/questions/import", {
        method: "POST",
        body: JSON.stringify({ format: "json", content }),
      });

      await sendAction({ type: "setCategories", categories: imported.categories });
      setMessage(
        `Imported ${imported.categories.length} categories (${imported.categories.reduce((sum, category) => sum + category.clues.length, 0)} clues).`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to import JSON questions.");
    } finally {
      setImportingQuestions(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="relative rounded-3xl border border-white/20 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-cyan-300 sm:text-4xl">Jeopardy Online MVP</h1>
          <button
            className="rounded-xl border border-cyan-300/60 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
            onClick={() => setHistoryMenuOpen((prev) => !prev)}
            type="button"
          >
            History ({history.length})
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-200">React + API prototype for room-based multiplayer.</p>
        <p className="mt-4 rounded-xl bg-slate-900/80 px-3 py-2 text-xs text-cyan-200">{message}</p>

        {historyMenuOpen && (
          <div className="mt-4 rounded-2xl border border-white/20 bg-slate-900/95 p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Recent Match History</h3>
              <button
                className="rounded-lg border border-slate-500 px-2 py-1 text-xs text-slate-200"
                onClick={() => setHistoryMenuOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-slate-300">No finished matches yet.</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {history.map((entry) => (
                  <div key={entry.id} className="rounded-xl bg-slate-950/70 p-3 text-sm text-slate-200">
                    <div className="font-semibold text-cyan-200">
                      Room {entry.roomCode} | Winner: {entry.winnerName} ({entry.winnerScore})
                    </div>
                    <div className="mt-1 text-xs text-slate-300">
                      {new Date(entry.finishedAt).toLocaleString()} | {entry.players.map((player) => `${player.name}: ${player.score}`).join(" | ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {!session && (
        <section className="grid gap-4 rounded-3xl border border-white/20 bg-slate-900/70 p-6 shadow-xl backdrop-blur sm:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm text-slate-200">Nickname</label>
            <input
              className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-300 transition focus:ring"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
            <button
              className="w-full rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
              onClick={createRoom}
              disabled={loading}
            >
              Create Room
            </button>
          </div>

          <div className="space-y-3">
            <label className="block text-sm text-slate-200">Room Code</label>
            <input
              className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 uppercase outline-none ring-cyan-300 transition focus:ring"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="ABC123"
            />
            <button
              className="w-full rounded-xl bg-amber-300 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
              onClick={joinRoom}
              disabled={loading}
            >
              Join Room
            </button>
          </div>
        </section>
      )}

      {session && room && (
        <>
          <section className="rounded-3xl border border-white/20 bg-slate-900/70 p-6 shadow-xl backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Room {room.code}</h2>
              <div className="flex gap-2">
                {room.phase === "lobby" && isHost && (
                  <label className="cursor-pointer rounded-xl border border-cyan-300/60 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20">
                    {importingQuestions ? "Importing..." : "Import Questions JSON"}
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      disabled={loading || importingQuestions}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void importQuestionsJson(file);
                        }
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                )}
                {room.phase === "lobby" && isHost && (
                  <button
                    className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950"
                    onClick={() => void sendAction({ type: "start" })}
                    disabled={loading || importingQuestions}
                  >
                    Start Match
                  </button>
                )}
                <button
                  className="rounded-xl border border-slate-400 px-4 py-2 text-sm text-slate-100"
                  onClick={clearSession}
                >
                  Leave
                </button>
              </div>
            </div>

            {room.phase === "lobby" && isHost && (
              <p className="mt-4 text-xs text-cyan-200">
                Import a JSON question set before starting. Without import, the default sample board is used.
              </p>
            )}

            {room.phase === "lobby" && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Players in lobby ({room.players.filter((p) => !p.isHost).length})</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {room.players.filter((p) => !p.isHost).length === 0 ? (
                    <p className="text-sm text-slate-400">Waiting for players to join…</p>
                  ) : (
                    room.players
                      .filter((p) => !p.isHost)
                      .map((p) => (
                        <span
                          key={p.id}
                          className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-100"
                        >
                          {p.name}{p.id === session.playerId ? " (you)" : ""}
                        </span>
                      ))
                  )}
                </div>
              </div>
            )}
          </section>

          {room.phase !== "lobby" && room.phase !== "final" && room.phase !== "finished" && (
            <section className="overflow-hidden rounded-3xl border border-cyan-400/30 bg-slate-900/70 p-4 shadow-xl backdrop-blur">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-cyan-200">
                <span className="rounded-full border border-cyan-300/60 bg-cyan-400/10 px-3 py-1 font-semibold text-cyan-100">
                  Turn {turnPosition}/{Math.max(contestants.length, 1)}
                </span>
                <span>
                  Current selector: <span className="font-semibold text-cyan-100">{selectorName}</span>
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {room.categories.map((category) => (
                  <div key={category.id} className="rounded-xl bg-slate-950/80 p-2">
                    <h3 className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-amber-300">
                      {category.title}
                    </h3>
                    <div className="space-y-2">
                      {category.clues.map((clue) => (
                        <button
                          key={clue.id}
                          className="w-full rounded-lg border border-slate-700 px-2 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => void sendAction({ type: "select", clueId: clue.id })}
                          disabled={!isSelector || clue.used || room.phase !== "board" || loading}
                        >
                          ${clue.value}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {room.phase !== "lobby" && (
            <section className="rounded-3xl border border-white/20 bg-slate-900/70 p-6 shadow-xl backdrop-blur">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Host</h3>
              {hostPlayer ? (
                <div className="mt-4 rounded-xl border border-amber-300/70 bg-amber-400/10 p-3 text-sm text-amber-100">
                  <div className="font-semibold">{hostPlayer.name}{hostPlayer.id === session.playerId ? " (you)" : ""} [host]</div>
                  <div className="mt-1 text-xs text-amber-200">Moderator only: judges spoken answers and resolves Final.</div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-300">
                  No host found.
                </div>
              )}

              <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-200">Players</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {contestants
                  .slice()
                  .sort((a, b) => b.score - a.score)
                  .map((player) => {
                    const isCurrentSelector = player.id === room.selectorId;
                    const isCurrentAnswerer = player.id === answeringPlayerId;
                    const statusText = answeringPlayer
                      ? `${answeringPlayer.name} is answering`
                      : isCurrentSelector
                        ? "Current selector"
                        : "Waiting";

                    return (
                      <div
                        key={player.id}
                        className={`rounded-xl border p-3 text-sm text-slate-200 ${
                          isCurrentAnswerer
                            ? "border-emerald-300 bg-emerald-400/10"
                            : isCurrentSelector
                              ? "border-cyan-300 bg-cyan-400/10"
                              : "border-slate-800 bg-slate-950/70"
                        }`}
                      >
                        <div className="font-semibold text-cyan-200">
                          {player.name}
                          {player.id === session.playerId ? " (you)" : ""}
                        </div>
                        <div className="mt-1 text-xl font-bold text-white">{player.score}</div>
                        {!isCurrentAnswerer && <div className="mt-1 text-xs text-slate-300">{statusText}</div>}
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {room.activeClue && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
              <section className="w-full max-w-3xl rounded-3xl border border-amber-300/50 bg-slate-900/95 p-6 shadow-2xl">
                <p className="text-sm uppercase tracking-wide text-amber-200">
                  {room.activeClue.categoryTitle} (${room.activeClue.value})
                </p>
                <p className="mt-2 text-xl font-semibold text-white">{room.activeClue.question}</p>

                {isHost && (
                  <div className="mt-4 rounded-xl bg-slate-950/70 p-3 text-sm text-slate-200">
                    {answeringPlayer ? "An answer is currently in progress." : "Steal phase is open. Buzz to answer."}
                  </div>
                )}

                {!isHost && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="rounded-xl bg-fuchsia-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
                      onClick={() => void sendAction({ type: "buzz" })}
                      disabled={!canBuzz || loading}
                    >
                      Buzz
                    </button>
                    <span className="self-center text-sm text-slate-200">
                      {!answeringPlayer
                        ? "Only players who have not tried can buzz."
                        : "Buzz opens after a wrong answer."}
                    </span>
                  </div>
                )}

                {!isHost && answeringPlayer && !isBuzzed && (
                  <div className="mt-4 rounded-xl bg-slate-950/70 p-3 text-sm text-slate-200">
                    {answeringPlayer.name} is answering.
                  </div>
                )}

                {isHost && room.activeClue.attemptedPlayerIds.length > 0 && (
                  <p className="mt-2 text-xs text-slate-300">
                    Already tried: {room.activeClue.attemptedPlayerIds
                      .map((playerId) => contestants.find((player) => player.id === playerId)?.name ?? "Unknown")
                      .join(", ")}
                  </p>
                )}

                {isBuzzed && room.phase === "judging" && !isHost && (
                  <p className="mt-4 rounded-xl border border-cyan-300/60 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">
                    You are answering now. Say your answer out loud.
                  </p>
                )}

                {room.phase === "judging" && isHost && (
                  <div className="mt-4 space-y-3 rounded-xl bg-slate-950/70 p-4">
                    <p className="text-xs text-amber-200">Expected answer: {room.activeClue.expectedAnswer}</p>
                    <div className="flex gap-2">
                      <button
                        className="rounded-xl bg-emerald-300 px-4 py-2 font-semibold text-slate-950"
                        onClick={() => void sendAction({ type: "judge", isCorrect: true })}
                      >
                        Correct
                      </button>
                      <button
                        className="rounded-xl bg-rose-300 px-4 py-2 font-semibold text-slate-950"
                        onClick={() => void sendAction({ type: "judge", isCorrect: false })}
                      >
                        Wrong
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {room.phase === "finished" && (
            <section className="rounded-3xl border border-emerald-300/50 bg-slate-900/70 p-6 text-center">
              <h3 className="text-2xl font-bold text-emerald-200">Match complete</h3>
              <p className="mt-2 text-slate-200">Final Jeopardy is resolved. Open a new room for the next match.</p>
            </section>
          )}

          {room.phase === "final" && final && (
            <section className="rounded-3xl border border-sky-300/50 bg-slate-900/80 p-6 shadow-xl">
              <p className="text-sm uppercase tracking-wide text-sky-200">Final Jeopardy</p>
              <p className="mt-2 text-xl font-semibold text-white">{final.question}</p>
              <p className="mt-2 text-xs text-slate-300">
                Submitted: {final.submissionCount} / {contestants.length}
              </p>

              {!isHost && !finalSubmitted && !final.resolved && (
                <div className="mt-4 grid gap-3 sm:grid-cols-[180px,1fr,auto]">
                  <input
                    className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-300 transition focus:ring"
                    type="number"
                    min={0}
                    max={Math.max(0, self?.score ?? 0)}
                    value={finalWager}
                    onChange={(event) => setFinalWager(event.target.value)}
                    placeholder="Wager"
                  />
                  <input
                    className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-300 transition focus:ring"
                    value={finalAnswer}
                    onChange={(event) => setFinalAnswer(event.target.value)}
                    placeholder="Final answer"
                  />
                  <button
                    className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60"
                    onClick={() =>
                      void sendAction({
                        type: "finalSubmit",
                        wager: Number(finalWager || 0),
                        answer: finalAnswer,
                      })
                    }
                    disabled={loading || !finalAnswer.trim()}
                  >
                    Submit Final
                  </button>
                </div>
              )}

              {finalSubmitted && !final.resolved && (
                <p className="mt-3 text-sm text-emerald-200">
                  Your final answer is locked with wager {selfFinal?.wager}.
                </p>
              )}

              {isHost && !final.resolved && (
                <button
                  className="mt-4 rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                  onClick={() => void sendAction({ type: "finalResolve" })}
                  disabled={!allFinalSubmitted || loading}
                >
                  Resolve Final
                </button>
              )}

              {final.resolved && (
                <p className="mt-4 text-sm text-amber-200">Expected answer: {final.expectedAnswer}</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
