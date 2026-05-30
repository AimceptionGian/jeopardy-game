import { MongoClient, type Db } from "mongodb";
import { sampleBoard } from "@/lib/sample-board";
import type { Category, MatchHistoryEntry, PublicRoomState, Room } from "@/lib/types";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DATABASE_NAME = process.env.MONGODB_DB ?? "jeopardy-online";
const ROOMS_COLLECTION = "rooms";
const HISTORY_COLLECTION = "match-history";

declare global {
  // eslint-disable-next-line no-var
  var __mongodbClientPromise: Promise<MongoClient> | undefined;
}

async function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!globalThis.__mongodbClientPromise) {
    const client = new MongoClient(uri);
    globalThis.__mongodbClientPromise = client.connect();
  }

  return globalThis.__mongodbClientPromise;
}

async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(DATABASE_NAME);
}

async function loadRoom(roomCode: string): Promise<Room | null> {
  const db = await getDb();
  return db.collection<Room>(ROOMS_COLLECTION).findOne({ code: roomCode.toUpperCase() });
}

async function saveRoom(room: Room): Promise<void> {
  const db = await getDb();
  await db.collection<Room>(ROOMS_COLLECTION).replaceOne({ code: room.code }, room, { upsert: true });
}

interface HistoryDocument {
  key: string;
  entries: MatchHistoryEntry[];
}

async function loadHistory(): Promise<MatchHistoryEntry[]> {
  const db = await getDb();
  const history = await db.collection<HistoryDocument>(HISTORY_COLLECTION).findOne({ key: HISTORY_COLLECTION });
  return history?.entries ?? [];
}

async function saveHistory(entries: MatchHistoryEntry[]): Promise<void> {
  const db = await getDb();
  await db.collection<HistoryDocument>(HISTORY_COLLECTION).replaceOne(
    { key: HISTORY_COLLECTION },
    { key: HISTORY_COLLECTION, entries },
    { upsert: true },
  );
}

const FINAL_PROMPT = {
  question: "Name the web protocol used for secure communication over the internet.",
  answer: "https",
};

function now() {
  return Date.now();
}

function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

async function generateRoomCode(): Promise<string> {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  const existing = await loadRoom(code);
  if (existing) {
    return generateRoomCode();
  }
  return code;
}

function cloneCategories(categories: Category[]) {
  return categories.map((category) => ({
    ...category,
    clues: category.clues.map((clue) => ({ ...clue })),
  }));
}

function validateCategories(categories: Category[]) {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error("No categories found.");
  }

  for (const category of categories) {
    if (!category.id || !category.title || !Array.isArray(category.clues) || category.clues.length === 0) {
      throw new Error("Invalid category structure.");
    }
    for (const clue of category.clues) {
      if (!clue.id || typeof clue.value !== "number" || !clue.question || !clue.answer) {
        throw new Error("Invalid clue structure.");
      }
    }
  }
}

function findClue(room: Room, clueId?: string) {
  if (!clueId) {
    return undefined;
  }

  for (const category of room.categories) {
    const clue = category.clues.find((entry) => entry.id === clueId);
    if (clue) {
      return clue;
    }
  }
  return undefined;
}

function getRemainingBuzzers(room: Room) {
  return room.players.filter((player) => !player.isHost && !room.attemptedPlayerIds.includes(player.id));
}

function getContestants(room: Room) {
  return room.players.filter((player) => !player.isHost);
}

function getNextSelectorId(room: Room) {
  const contestants = getContestants(room);
  if (contestants.length === 0) {
    return room.selectorId;
  }

  const currentIndex = contestants.findIndex((player) => player.id === room.selectorId);
  if (currentIndex < 0) {
    return contestants[0].id;
  }

  const nextIndex = (currentIndex + 1) % contestants.length;
  return contestants[nextIndex].id;
}

async function getRoomOrThrow(roomCode: string): Promise<Room> {
  const room = await loadRoom(roomCode.toUpperCase());
  if (!room) {
    throw new Error("Room not found.");
  }
  return room;
}

function getPlayerOrThrow(room: Room, playerId: string) {
  const player = room.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error("Player not found in room.");
  }
  return player;
}

function touchRoom(room: Room) {
  room.eventVersion += 1;
  room.updatedAt = now();
}

function isAnswerMatch(actual: string, expected: string) {
  return actual.trim().toLowerCase() === expected.trim().toLowerCase();
}

function allCluesUsed(room: Room) {
  return room.usedClueIds.length === room.categories.reduce((count, category) => count + category.clues.length, 0);
}

function enterFinalRound(room: Room) {
  room.phase = "final";
  room.activeClueId = undefined;
  room.buzzedPlayerId = undefined;
  room.submittedAnswer = undefined;
  room.attemptedPlayerIds = [];
  room.finalPrompt = { ...FINAL_PROMPT };
  room.finalSubmissions = {};
  room.finalResolved = false;
}

async function pushHistory(room: Room): Promise<void> {
  const ranking = getContestants(room)
    .map((player) => ({ id: player.id, name: player.name, score: player.score }))
    .sort((a, b) => b.score - a.score);

  const winner = ranking[0];
  if (!winner) {
    return;
  }

  const history = await loadHistory();
  history.unshift({
    id: generateId("match"),
    roomCode: room.code,
    finishedAt: now(),
    winnerName: winner.name,
    winnerScore: winner.score,
    players: ranking,
  });

  if (history.length > 50) {
    history.length = 50;
  }

  await saveHistory(history);
}

export async function createRoom(hostName: string, categories?: Category[]) {
  const playerId = generateId("player");
  const roomCode = await generateRoomCode();

  const room: Room = {
    code: roomCode,
    phase: "lobby",
    players: [
      {
        id: playerId,
        name: hostName.trim(),
        score: 0,
        isHost: true,
        connected: true,
        lastSeenAt: now(),
      },
    ],
    categories: cloneCategories(categories ?? sampleBoard),
    hostId: playerId,
    selectorId: playerId,
    usedClueIds: [],
    attemptedPlayerIds: [],
    finalSubmissions: {},
    finalResolved: false,
    eventVersion: 1,
    createdAt: now(),
    updatedAt: now(),
  };

  await saveRoom(room);
  return { roomCode, playerId };
}

export async function joinRoom(roomCode: string, playerName: string) {
  const room = await getRoomOrThrow(roomCode);

  if (room.phase !== "lobby") {
    throw new Error("Game already started.");
  }

  if (room.players.some((player) => player.name.toLowerCase() === playerName.toLowerCase())) {
    throw new Error("Name is already used in this room.");
  }

  const playerId = generateId("player");
  room.players.push({
    id: playerId,
    name: playerName.trim(),
    score: 0,
    isHost: false,
    connected: true,
    lastSeenAt: now(),
  });
  touchRoom(room);
  await saveRoom(room);

  return { roomCode: room.code, playerId };
}

export async function markOnline(roomCode: string, playerId: string) {
  const code = roomCode.toUpperCase();
  const db = await getDb();
  const updatedAt = now();

  const result = await db.collection(ROOMS_COLLECTION).updateOne(
    { code, "players.id": playerId },
    {
      $set: {
        "players.$.connected": true,
        "players.$.lastSeenAt": updatedAt,
        updatedAt,
      },
      $inc: { eventVersion: 1 },
    },
  );

  if (result.matchedCount > 0) {
    return;
  }

  const room = await loadRoom(code);
  if (!room) {
    throw new Error("Room not found.");
  }
  throw new Error("Player not found in room.");
}

export async function getRoomState(roomCode: string, playerId: string): Promise<PublicRoomState> {
  const room = await getRoomOrThrow(roomCode);
  const viewer = getPlayerOrThrow(room, playerId);

  const activeCategory = room.categories.find((category) =>
    category.clues.some((entry) => entry.id === room.activeClueId),
  );
  const clue = activeCategory?.clues.find((entry) => entry.id === room.activeClueId);
  return {
    code: room.code,
    phase: room.phase,
    players: room.players,
    categories: room.categories.map((category) => ({
      id: category.id,
      title: category.title,
      clues: category.clues.map((entry) => ({
        id: entry.id,
        value: entry.value,
        used: room.usedClueIds.includes(entry.id),
      })),
    })),
    selectorId: room.selectorId,
    activeClue: clue
      ? {
          id: clue.id,
          categoryTitle: activeCategory?.title ?? "Unknown",
          question: clue.question,
          value: clue.value,
          expectedAnswer: viewer.isHost && room.phase === "judging" ? clue.answer : undefined,
          buzzedPlayerId: room.buzzedPlayerId,
          submittedAnswer: room.submittedAnswer,
          attemptedPlayerIds: room.attemptedPlayerIds,
        }
      : undefined,
    final: room.finalPrompt
      ? {
          question: room.finalPrompt.question,
          expectedAnswer: viewer.isHost && room.finalResolved ? room.finalPrompt.answer : undefined,
          submissionCount: Object.keys(room.finalSubmissions).length,
          submittedPlayerIds: Object.keys(room.finalSubmissions),
          selfSubmission: room.finalSubmissions[viewer.id]
            ? {
                wager: room.finalSubmissions[viewer.id].wager,
                answer: room.finalSubmissions[viewer.id].answer,
              }
            : undefined,
          resolved: room.finalResolved,
        }
      : undefined,
    eventVersion: room.eventVersion,
  };
}

export async function getMatchHistory(limit = 15) {
  const history = await loadHistory();
  return history.slice(0, Math.max(1, Math.min(50, limit)));
}

export async function startGame(roomCode: string, playerId: string) {
  const room = await getRoomOrThrow(roomCode);
  const player = getPlayerOrThrow(room, playerId);
  const contestants = getContestants(room);

  if (!player.isHost) {
    throw new Error("Only host can start game.");
  }

  if (contestants.length < 2) {
    throw new Error("At least 2 non-host players are required.");
  }

  room.phase = "board";
  room.selectorId = contestants[0].id;
  touchRoom(room);
  await saveRoom(room);
}

export async function setRoomCategories(roomCode: string, playerId: string, categories: Category[]) {
  const room = await getRoomOrThrow(roomCode);
  const player = getPlayerOrThrow(room, playerId);

  if (!player.isHost) {
    throw new Error("Only host can import categories.");
  }

  if (room.phase !== "lobby") {
    throw new Error("Categories can only be imported before the match starts.");
  }

  validateCategories(categories);
  room.categories = cloneCategories(categories);
  room.usedClueIds = [];
  room.activeClueId = undefined;
  room.buzzedPlayerId = undefined;
  room.submittedAnswer = undefined;
  room.attemptedPlayerIds = [];
  touchRoom(room);
  await saveRoom(room);
}

export async function selectClue(roomCode: string, playerId: string, clueId: string) {
  const room = await getRoomOrThrow(roomCode);
  getPlayerOrThrow(room, playerId);

  if (room.phase !== "board") {
    throw new Error("Cannot select clue right now.");
  }

  if (room.selectorId !== playerId) {
    throw new Error("Only current selector can pick a clue.");
  }

  const clue = findClue(room, clueId);
  if (!clue) {
    throw new Error("Clue not found.");
  }
  if (room.usedClueIds.includes(clue.id)) {
    throw new Error("Clue already used.");
  }

  room.activeClueId = clue.id;
  room.buzzedPlayerId = playerId;
  room.submittedAnswer = undefined;
  room.attemptedPlayerIds = [];
  room.phase = "judging";
  touchRoom(room);
  await saveRoom(room);
}

export async function buzz(roomCode: string, playerId: string) {
  const room = await getRoomOrThrow(roomCode);
  const player = getPlayerOrThrow(room, playerId);

  if (player.isHost) {
    throw new Error("Host cannot buzz.");
  }

  if (room.phase !== "clue") {
    throw new Error("Buzzing is closed.");
  }
  if (room.buzzedPlayerId) {
    throw new Error("A player already buzzed.");
  }
  if (room.attemptedPlayerIds.includes(playerId)) {
    throw new Error("You already tried this clue.");
  }

  room.buzzedPlayerId = playerId;
  room.phase = "judging";
  touchRoom(room);
  await saveRoom(room);
}

export function submitAnswer(roomCode: string, playerId: string, answer: string): never {
  void roomCode;
  void playerId;
  void answer;
  throw new Error("Answer text input is disabled. Players answer verbally and host judges directly.");
}

export async function judgeAnswer(roomCode: string, playerId: string, isCorrect: boolean) {
  const room = await getRoomOrThrow(roomCode);
  const player = getPlayerOrThrow(room, playerId);

  if (!player.isHost) {
    throw new Error("Only host can judge answers.");
  }

  if (room.phase !== "judging") {
    throw new Error("No answer to judge.");
  }

  const clue = findClue(room, room.activeClueId);
  if (!clue || !room.buzzedPlayerId) {
    throw new Error("Invalid clue state.");
  }

  const nextSelectorId = getNextSelectorId(room);

  const buzzed = getPlayerOrThrow(room, room.buzzedPlayerId);
  const isSelectorAnswering = buzzed.id === room.selectorId;
  buzzed.score += isCorrect
    ? isSelectorAnswering
      ? clue.value
      : clue.value / 2
    : isSelectorAnswering
      ? -clue.value
      : -(clue.value / 2);

  if (isCorrect) {
    room.selectorId = nextSelectorId;
    room.usedClueIds.push(clue.id);
    room.activeClueId = undefined;
    room.buzzedPlayerId = undefined;
    room.submittedAnswer = undefined;

    if (allCluesUsed(room)) {
      enterFinalRound(room);
    } else {
      room.phase = "board";
    }

    touchRoom(room);
    await saveRoom(room);
    return;
  }

  if (!room.attemptedPlayerIds.includes(buzzed.id)) {
    room.attemptedPlayerIds.push(buzzed.id);
  }

  const remainingBuzzers = getRemainingBuzzers(room);
  room.buzzedPlayerId = undefined;
  room.submittedAnswer = undefined;

  if (remainingBuzzers.length === 0) {
    room.selectorId = nextSelectorId;
    room.usedClueIds.push(clue.id);
    room.activeClueId = undefined;
    room.phase = allCluesUsed(room) ? "final" : "board";
    if (room.phase === "final") {
      enterFinalRound(room);
    }
  } else {
    room.phase = "clue";
  }
  touchRoom(room);
  await saveRoom(room);
}

export async function submitFinal(roomCode: string, playerId: string, wager: number, answer: string) {
  const room = await getRoomOrThrow(roomCode);
  const player = getPlayerOrThrow(room, playerId);
  const contestants = getContestants(room);

  if (room.phase !== "final" || !room.finalPrompt) {
    throw new Error("Final Jeopardy is not active.");
  }

  if (room.finalResolved) {
    throw new Error("Final Jeopardy is already resolved.");
  }

  if (player.isHost || !contestants.some((entry) => entry.id === player.id)) {
    throw new Error("Host does not submit Final Jeopardy.");
  }

  if (room.finalSubmissions[player.id]) {
    throw new Error("You already submitted Final Jeopardy.");
  }

  if (!answer.trim()) {
    throw new Error("Final answer must not be empty.");
  }

  const safeWager = Math.floor(wager);
  if (Number.isNaN(safeWager) || safeWager < 0) {
    throw new Error("Wager must be a positive number.");
  }

  const maxWager = Math.max(0, player.score);
  if (safeWager > maxWager) {
    throw new Error(`Wager cannot exceed your score (${maxWager}).`);
  }

  room.finalSubmissions[player.id] = {
    wager: safeWager,
    answer: answer.trim(),
    submittedAt: now(),
  };
  touchRoom(room);
  await saveRoom(room);
}

export async function resolveFinal(roomCode: string, playerId: string) {
  const room = await getRoomOrThrow(roomCode);
  const player = getPlayerOrThrow(room, playerId);
  const contestants = getContestants(room);

  if (!player.isHost) {
    throw new Error("Only host can resolve Final Jeopardy.");
  }

  if (room.phase !== "final" || !room.finalPrompt) {
    throw new Error("Final Jeopardy is not active.");
  }

  if (room.finalResolved) {
    throw new Error("Final Jeopardy already resolved.");
  }

  if (Object.keys(room.finalSubmissions).length !== contestants.length) {
    throw new Error("All players must submit final wager and answer first.");
  }

  for (const playerEntry of contestants) {
    const submission = room.finalSubmissions[playerEntry.id];
    if (!submission) {
      continue;
    }
    const correct = isAnswerMatch(submission.answer, room.finalPrompt.answer);
    playerEntry.score += correct ? submission.wager : -submission.wager;
  }

  room.finalResolved = true;
  room.phase = "finished";
  await pushHistory(room);
  touchRoom(room);
  await saveRoom(room);
}
