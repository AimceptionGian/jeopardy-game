"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Category, PublicRoomState } from "@/lib/types";

type Session = {
  roomCode: string;
  playerId: string;
  name: string;
};

type BoardSummary = {
  id: string;
  name: string;
  categoryCount: number;
  clueCount: number;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "jeopardy-session-v1";
const SOUND_VOLUME_KEY = "jeopardy-sound-volume-v1";

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
  const [importingQuestions, setImportingQuestions] = useState(false);
  const [boardLibrary, setBoardLibrary] = useState<BoardSummary[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [localPlayerName, setLocalPlayerName] = useState("");
  const [clueOverlayOpen, setClueOverlayOpen] = useState(true);
  const [message, setMessage] = useState("Create or join a room to begin.");
  const [loading, setLoading] = useState(false);
  const roomNotFoundCount = useState(0);
  const loadedBoardsForRoomRef = useRef<string | null>(null);
  const stablePlayerIdentityRef = useRef<{ playerId: string; name: string } | null>(null);
  const [timerRemainingMs, setTimerRemainingMs] = useState(0);
  const [timerDurationMs, setTimerDurationMs] = useState(10_000);
  const [timerEndsAtMs, setTimerEndsAtMs] = useState<number | null>(null);
  const [soundVolume, setSoundVolume] = useState(70);
  const lastTimerEventIdRef = useRef<string | null>(null);
  const lastJudgeEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    const restoreSession = setTimeout(() => {
      const storedSession = readStoredSession();
      if (!storedSession) {
        return;
      }
      stablePlayerIdentityRef.current = { playerId: storedSession.playerId, name: storedSession.name };
      setSession(storedSession);
      setName(storedSession.name);
    }, 0);

    return () => clearTimeout(restoreSession);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = localStorage.getItem(SOUND_VOLUME_KEY);
    if (!raw) {
      return;
    }

    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      setSoundVolume(Math.min(100, Math.max(0, Math.round(parsed))));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem(SOUND_VOLUME_KEY, String(soundVolume));
  }, [soundVolume]);

  const clearSession = useCallback(() => {
    setSession(null);
    setRoom(null);
    stablePlayerIdentityRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
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
  const canBuzz = Boolean(
    room?.phase === "clue" &&
      room.activeClue &&
      !room.activeClue.buzzedPlayerId &&
      session &&
      !self?.isHost &&
      !room.activeClue.attemptedPlayerIds.includes(session.playerId),
  );
  const localModeHostCanPickBuzz = Boolean(
    isHost && room?.mode === "local" && room?.phase === "clue" && room.activeClue && !room.activeClue.buzzedPlayerId,
  );
  const localBuzzCandidates = contestants.filter(
    (player) => !room?.activeClue?.attemptedPlayerIds.includes(player.id),
  );
  const isBuzzed = Boolean(room && session && room.activeClue?.buzzedPlayerId === session.playerId);
  const showClueOverlay = Boolean(room?.activeClue && clueOverlayOpen);
  const ranking = contestants.slice().sort((a, b) => b.score - a.score);
  const podium = ranking.slice(0, 3);
  const timerProgress = timerDurationMs > 0 ? Math.max(0, Math.min(1, timerRemainingMs / timerDurationMs)) : 0;

  const playJudgeSound = useCallback((isCorrect: boolean) => {
    if (typeof window === "undefined") {
      return;
    }

    const context = new window.AudioContext();
    const nowAt = context.currentTime;
    const volume = Math.max(0, Math.min(1, soundVolume / 100));

    if (volume <= 0) {
      void context.close();
      return;
    }

    if (isCorrect) {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((frequency, index) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = "triangle";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, nowAt + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.18 * volume, nowAt + index * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, nowAt + index * 0.08 + 0.22);
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(nowAt + index * 0.08);
        osc.stop(nowAt + index * 0.08 + 0.24);
      });
    } else {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, nowAt);
      osc.frequency.exponentialRampToValueAtTime(110, nowAt + 0.42);
      gain.gain.setValueAtTime(0.0001, nowAt);
      gain.gain.linearRampToValueAtTime(0.2 * volume, nowAt + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, nowAt + 0.45);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(nowAt);
      osc.stop(nowAt + 0.46);
    }

    setTimeout(() => {
      void context.close();
    }, 900);
  }, [soundVolume]);

  const playTimerSequence = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const context = new window.AudioContext();
    const nowAt = context.currentTime + 0.02;
    const volume = Math.max(0, Math.min(1, soundVolume / 100));

    if (volume <= 0) {
      void context.close();
      return;
    }

    const drone = context.createOscillator();
    const droneGain = context.createGain();
    drone.type = "sawtooth";
    drone.frequency.setValueAtTime(92, nowAt);
    drone.frequency.exponentialRampToValueAtTime(72, nowAt + 10);
    droneGain.gain.setValueAtTime(0.0001, nowAt);
    droneGain.gain.linearRampToValueAtTime(0.045 * volume, nowAt + 0.3);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, nowAt + 10);
    drone.connect(droneGain);
    droneGain.connect(context.destination);
    drone.start(nowAt);
    drone.stop(nowAt + 10.1);

    for (let second = 0; second < 10; second += 1) {
      const beepAt = nowAt + second;
      const urgency = second / 9;
      const frequency = 220 + urgency * 620;
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, beepAt);
      gain.gain.setValueAtTime(0.0001, beepAt);
      gain.gain.linearRampToValueAtTime((0.1 + urgency * 0.24) * volume, beepAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, beepAt + 0.19);

      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(beepAt);
      osc.stop(beepAt + 0.2);
    }

    const finalAt = nowAt + 10;
    const finalLow = context.createOscillator();
    const finalLowGain = context.createGain();
    finalLow.type = "square";
    finalLow.frequency.setValueAtTime(146.83, finalAt);
    finalLowGain.gain.setValueAtTime(0.0001, finalAt);
    finalLowGain.gain.linearRampToValueAtTime(0.26 * volume, finalAt + 0.03);
    finalLowGain.gain.exponentialRampToValueAtTime(0.0001, finalAt + 0.55);
    finalLow.connect(finalLowGain);
    finalLowGain.connect(context.destination);
    finalLow.start(finalAt);
    finalLow.stop(finalAt + 0.56);

    const finalHigh = context.createOscillator();
    const finalHighGain = context.createGain();
    finalHigh.type = "triangle";
    finalHigh.frequency.setValueAtTime(587.33, finalAt + 0.02);
    finalHighGain.gain.setValueAtTime(0.0001, finalAt + 0.02);
    finalHighGain.gain.linearRampToValueAtTime(0.18 * volume, finalAt + 0.06);
    finalHighGain.gain.exponentialRampToValueAtTime(0.0001, finalAt + 0.5);
    finalHigh.connect(finalHighGain);
    finalHighGain.connect(context.destination);
    finalHigh.start(finalAt + 0.02);
    finalHigh.stop(finalAt + 0.52);

    setTimeout(() => {
      void context.close();
    }, 11500);
  }, [soundVolume]);

  useEffect(() => {
    if (room?.activeClue) {
      setClueOverlayOpen(true);
    }
  }, [room?.activeClue?.id]);

  useEffect(() => {
    if (timerEndsAtMs === null) {
      setTimerRemainingMs(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, timerEndsAtMs - Date.now());
      setTimerRemainingMs(remaining);
      if (remaining <= 0) {
        setTimerEndsAtMs(null);
      }
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 50);
    return () => clearInterval(timer);
  }, [timerEndsAtMs]);

  useEffect(() => {
    const event = room?.timerEvent;
    if (!event || lastTimerEventIdRef.current === event.id) {
      return;
    }

    lastTimerEventIdRef.current = event.id;
    setTimerDurationMs(event.durationMs);
    setTimerEndsAtMs(Date.now() + event.durationMs);
    setTimerRemainingMs(event.durationMs);
    playTimerSequence();
  }, [room?.timerEvent, playTimerSequence]);

  useEffect(() => {
    const event = room?.judgeEvent;
    if (!event || lastJudgeEventIdRef.current === event.id) {
      return;
    }

    lastJudgeEventIdRef.current = event.id;
    playJudgeSound(event.isCorrect);
  }, [room?.judgeEvent, playJudgeSound]);

  const loadBoardLibrary = useCallback(async () => {
    setLoadingBoards(true);
    try {
      const data = await api<{ boards: BoardSummary[] }>("/api/boards");
      setBoardLibrary(data.boards);
      setSelectedBoardId((prev) => {
        if (prev && data.boards.some((board) => board.id === prev)) {
          return prev;
        }
        return data.boards[0]?.id ?? "";
      });
    } catch {
      // Board library is optional in lobby.
    } finally {
      setLoadingBoards(false);
    }
  }, []);

  useEffect(() => {
    if (!session || !room || !isHost || room.phase !== "lobby") {
      return;
    }

    if (loadedBoardsForRoomRef.current === session.roomCode) {
      return;
    }

    loadedBoardsForRoomRef.current = session.roomCode;
    void loadBoardLibrary();
  }, [isHost, loadBoardLibrary, room?.phase, session?.roomCode, session, room]);

  const persistSession = useCallback((nextSession: Session) => {
    setSession(nextSession);
    stablePlayerIdentityRef.current = { playerId: nextSession.playerId, name: nextSession.name };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
  }, []);

  const isCurrentSessionPlayer = useCallback((player: { id: string; name: string }) => {
    const stableIdentity = stablePlayerIdentityRef.current;
    if (!stableIdentity) {
      return false;
    }

    return player.id === stableIdentity.playerId || player.name === stableIdentity.name;
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
    type:
      | "start"
      | "reset"
      | "select"
      | "buzz"
      | "skipClue"
      | "submit"
      | "judge"
      | "finalSubmit"
      | "finalResolve"
      | "setCategories"
      | "setBoard"
      | "triggerTimer"
      | "setMode"
      | "addLocalPlayer"
      | "localBuzz"
      | "removePlayer";
    clueId?: string;
    answer?: string;
    isCorrect?: boolean;
    wager?: number;
    categories?: Category[];
    boardId?: string;
    mode?: "online" | "local";
    name?: string;
    targetPlayerId?: string;
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
      {timerRemainingMs > 0 && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-2 bg-slate-950/70">
          <div
            className="h-full origin-left bg-gradient-to-r from-fuchsia-400 via-rose-400 to-amber-300 transition-[transform] duration-75 ease-linear"
            style={{ transform: `scaleX(${timerProgress})` }}
          />
        </div>
      )}

      <header className="relative rounded-3xl border border-white/20 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-cyan-300 sm:text-4xl">Jeopardy Online MVP</h1>
          <a
            className="rounded-xl border border-cyan-300/60 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
            href="/admin"
          >
            Admin
          </a>
        </div>
        <p className="mt-2 text-sm text-slate-200">React + API prototype for room-based multiplayer.</p>
        <p className="mt-4 rounded-xl bg-slate-900/80 px-3 py-2 text-xs text-cyan-200">{message}</p>
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
              className="w-full rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
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
              className="w-full rounded-xl bg-amber-300 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
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
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
                  <span className="font-semibold">Sound</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={soundVolume}
                    onChange={(event) => setSoundVolume(Number(event.target.value))}
                    className="h-1 w-24 accent-cyan-300"
                    aria-label="Sound volume"
                  />
                  <span className="w-8 text-right text-cyan-200">{soundVolume}%</span>
                </label>
                {room.phase === "lobby" && isHost && (
                  <label className="cursor-pointer rounded-xl border border-cyan-300/60 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20">
                    {importingQuestions ? "Importing..." : "Import Questions JSON"}
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      disabled={importingQuestions}
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
                    className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    onClick={() => void sendAction({ type: "start" })}
                    disabled={importingQuestions}
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
              <div className="mt-4 rounded-xl border border-fuchsia-300/30 bg-slate-950/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-200">Mode</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      room.mode === "online"
                        ? "border border-cyan-300/70 bg-cyan-400/20 text-cyan-100"
                        : "border border-slate-600 bg-slate-900 text-slate-300 hover:border-cyan-300/40"
                    }`}
                    onClick={() => void sendAction({ type: "setMode", mode: "online" })}
                  >
                    Online
                  </button>
                  <button
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      room.mode === "local"
                        ? "border border-fuchsia-300/70 bg-fuchsia-400/20 text-fuchsia-100"
                        : "border border-slate-600 bg-slate-900 text-slate-300 hover:border-fuchsia-300/40"
                    }`}
                    onClick={() => void sendAction({ type: "setMode", mode: "local" })}
                  >
                    Local (one device)
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  {room.mode === "local"
                    ? "Host controls all players on this device."
                    : "Players join this room code from their own devices."}
                </p>
              </div>
            )}

            {room.phase === "lobby" && isHost && room.mode === "local" && (
              <div className="mt-3 rounded-xl border border-amber-300/30 bg-slate-950/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Add Local Players</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    className="w-full max-w-xs rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-amber-300 transition focus:ring"
                    value={localPlayerName}
                    onChange={(event) => setLocalPlayerName(event.target.value)}
                    placeholder="Player name"
                  />
                  <button
                    className="rounded-xl border border-amber-300/70 bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-500"
                    onClick={() => {
                      const trimmed = localPlayerName.trim();
                      if (!trimmed) {
                        setMessage("Enter a player name first.");
                        return;
                      }
                      setLocalPlayerName("");
                      void sendAction({ type: "addLocalPlayer", name: trimmed });
                    }}
                    disabled={!localPlayerName.trim()}
                  >
                    Add player
                  </button>
                </div>
              </div>
            )}

            {room.phase === "lobby" && isHost && room.mode === "online" && (
              <p className="mt-4 text-xs text-cyan-200">
                Import a JSON question set before starting. Without import, the default sample board is used.
              </p>
            )}

            {room.phase === "lobby" && isHost && room.mode === "local" && (
              <p className="mt-4 text-xs text-amber-200">
                Local mode active: add at least 2 local players, then start the match.
              </p>
            )}

            {room.phase === "lobby" && isHost && (
              <div className="mt-3 rounded-xl border border-cyan-300/30 bg-slate-950/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Board from DB</p>
                <p className="mt-1 text-xs text-slate-300">Selecting a board applies it immediately.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    className="min-w-[260px] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300 transition focus:ring"
                    value={selectedBoardId}
                    onChange={(event) => {
                      const boardId = event.target.value;
                      setSelectedBoardId(boardId);
                      if (boardId) {
                        void sendAction({ type: "setBoard", boardId });
                      }
                    }}
                    disabled={loadingBoards || boardLibrary.length === 0}
                  >
                    {boardLibrary.length === 0 ? (
                      <option value="">No DB boards found</option>
                    ) : (
                      boardLibrary.map((board) => (
                        <option key={board.id} value={board.id}>
                          {board.name} ({board.categoryCount}x{Math.round(board.clueCount / Math.max(board.categoryCount, 1))})
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    className="rounded-xl border border-slate-500 px-3 py-2 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:text-slate-500"
                    onClick={() => void loadBoardLibrary()}
                    disabled={loadingBoards}
                  >
                    {loadingBoards ? "Loading..." : "Refresh"}
                  </button>
                </div>
              </div>
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
                        <div
                          key={p.id}
                          className="flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-100"
                        >
                          <span>
                            {p.name}{isCurrentSessionPlayer(p) ? " (you)" : ""}
                          </span>
                          {isHost && (
                            <button
                              className="rounded-full border border-rose-300/70 bg-rose-400/15 px-2 py-0.5 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-400/30"
                              onClick={() => {
                                const actionLabel = room.mode === "local" ? "remove" : "kick";
                                const confirmed = window.confirm(`Really ${actionLabel} ${p.name}?`);
                                if (!confirmed) {
                                  return;
                                }
                                void sendAction({ type: "removePlayer", targetPlayerId: p.id });
                              }}
                            >
                              {room.mode === "local" ? "Remove" : "Kick"}
                            </button>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </section>

          {room.phase !== "lobby" && room.phase !== "finished" && (
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
                      {category.clues.map((clue) => {
                        const isBoardSelectionPhase = room.phase === "board";
                        const clueIsAvailable = !clue.used;
                        const canSelectClue =
                          room.phase === "board" && !clue.used && (isSelector || (isHost && room.mode === "local"));

                        return (
                          <button
                            key={clue.id}
                            className={`w-full rounded-lg border px-2 py-2 text-sm font-semibold transition ${
                              !clueIsAvailable
                                ? "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500"
                                : canSelectClue
                                  ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20"
                                  : isBoardSelectionPhase
                                    ? "cursor-default border-cyan-300/40 bg-cyan-400/5 text-cyan-200"
                                    : "cursor-default border-amber-300/50 bg-amber-300/10 text-amber-100"
                            }`}
                            onClick={() => {
                              if (canSelectClue) {
                                void sendAction({ type: "select", clueId: clue.id });
                              }
                            }}
                            disabled={clue.used}
                          >
                            ${clue.value}
                          </button>
                        );
                      })}
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
                  <div className="mt-1 text-xs text-amber-200">Moderator only: judges spoken answers and keeps the board moving.</div>
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

          {room.activeClue && !showClueOverlay && (
            <button
              className="fixed bottom-4 right-4 z-40 rounded-xl border border-cyan-300/70 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 backdrop-blur transition hover:bg-cyan-400/25"
              onClick={() => setClueOverlayOpen(true)}
            >
              Reopen active question
            </button>
          )}

          {showClueOverlay && room.activeClue && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
              <section className="w-full max-w-3xl rounded-3xl border border-amber-300/50 bg-slate-900/95 p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm uppercase tracking-wide text-amber-200">
                    {room.activeClue.categoryTitle} (${room.activeClue.value})
                  </p>
                  <button
                    className="rounded-lg border border-slate-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-slate-300"
                    onClick={() => setClueOverlayOpen(false)}
                  >
                    Minimize
                  </button>
                </div>
                <p className="mt-2 text-xl font-semibold text-white">{room.activeClue.question}</p>

                {isHost && (
                  <div className="mt-4 rounded-xl bg-slate-950/70 p-3 text-sm text-slate-200">
                    {answeringPlayer ? "An answer is currently in progress." : "Steal phase is open. Buzz to answer."}
                  </div>
                )}

                {isHost && room.phase === "clue" && (
                  <button
                    className="mt-4 rounded-xl bg-slate-300 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    onClick={() => void sendAction({ type: "skipClue" })}
                  >
                    Continue without buzz
                  </button>
                )}

                {!isHost && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="rounded-xl bg-fuchsia-300 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
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

                {localModeHostCanPickBuzz && (
                  <div className="mt-4 rounded-xl border border-fuchsia-300/40 bg-fuchsia-400/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-200">
                      Local mode: choose who buzzes
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {localBuzzCandidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          className="rounded-xl border border-fuchsia-300/70 bg-fuchsia-400/15 px-3 py-2 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-400/25"
                          onClick={() => void sendAction({ type: "localBuzz", targetPlayerId: candidate.id })}
                        >
                          Buzz as {candidate.name}
                        </button>
                      ))}
                      {localBuzzCandidates.length === 0 && (
                        <span className="text-sm text-slate-300">No eligible players left to buzz.</span>
                      )}
                    </div>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-xl border border-fuchsia-300/70 bg-fuchsia-400/15 px-4 py-2 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-400/25 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-500"
                        onClick={() => void sendAction({ type: "triggerTimer" })}
                        disabled={timerRemainingMs > 0}
                      >
                        {timerRemainingMs > 0 ? `Timer ${Math.ceil(timerRemainingMs / 1000)}s` : "Start 10s Answer Timer"}
                      </button>
                      {timerRemainingMs > 0 && (
                        <span className="text-xs font-semibold uppercase tracking-wide text-fuchsia-200">Answer time running</span>
                      )}
                    </div>
                    <p className="text-xs text-amber-200">Expected answer: {room.activeClue.expectedAnswer}</p>
                    <div className="flex gap-2">
                      <button
                        className="rounded-xl bg-emerald-300 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        onClick={() => void sendAction({ type: "judge", isCorrect: true })}
                      >
                        Correct
                      </button>
                      <button
                        className="rounded-xl bg-rose-300 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
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
            <section className="rounded-3xl border border-emerald-300/50 bg-slate-900/70 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-2xl font-bold text-emerald-200">Match complete</h3>
                {isHost && (
                  <button
                    className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    onClick={() => void sendAction({ type: "reset" })}
                  >
                    New game (same lobby)
                  </button>
                )}
              </div>
              <p className="mt-2 text-slate-200">Great game. Here is the final podium and ranking.</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {podium.map((player, index) => (
                  <div
                    key={player.id}
                    className={`rounded-2xl border p-4 text-center ${
                      index === 0
                        ? "border-amber-300/70 bg-amber-300/15"
                        : index === 1
                          ? "border-slate-300/70 bg-slate-300/10"
                          : "border-orange-300/70 bg-orange-300/10"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-200">#{index + 1}</p>
                    <p className="mt-1 font-semibold text-white">{player.name}</p>
                    <p className="mt-1 text-2xl font-bold text-cyan-100">{player.score}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-white/15 bg-slate-950/60 p-4">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Ranking</h4>
                <div className="mt-3 space-y-2">
                  {ranking.map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between rounded-lg bg-slate-900/70 px-3 py-2">
                      <span className="text-sm text-slate-100">
                        {index + 1}. {player.name}
                        {player.id === session.playerId ? " (you)" : ""}
                      </span>
                      <span className="font-semibold text-cyan-200">{player.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
