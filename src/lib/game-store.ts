import { MongoClient, type Db } from "mongodb";
import { sampleBoard } from "@/lib/sample-board";
import type { Category, MatchHistoryEntry, PublicRoomState, Room } from "@/lib/types";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DATABASE_NAME = process.env.MONGODB_DB ?? "jeopardy-online";
const ROOMS_COLLECTION = "rooms";
const HISTORY_COLLECTION = "match-history";
const BOARDS_COLLECTION = "boards";
const ROOM_INACTIVITY_MS = 2 * 60 * 60 * 1000;

interface RoomDocument extends Room {
  expiresAt: Date;
}

interface BoardDocument {
  id: string;
  name: string;
  categories: Category[];
  createdAt: number;
  updatedAt: number;
}

export interface BoardSummary {
  id: string;
  name: string;
  categoryCount: number;
  clueCount: number;
  createdAt: number;
  updatedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongodbClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var __mongodbIndexesReadyPromise: Promise<void> | undefined;
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
  const db = client.db(DATABASE_NAME);

  if (!globalThis.__mongodbIndexesReadyPromise) {
    globalThis.__mongodbIndexesReadyPromise = Promise.all([
      db.collection<RoomDocument>(ROOMS_COLLECTION).createIndex({ code: 1 }, { unique: true }),
      db.collection<RoomDocument>(ROOMS_COLLECTION).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection<HistoryDocument>(HISTORY_COLLECTION).createIndex({ key: 1 }, { unique: true }),
      db.collection<BoardDocument>(BOARDS_COLLECTION).createIndex({ id: 1 }, { unique: true }),
      db.collection<BoardDocument>(BOARDS_COLLECTION).createIndex({ updatedAt: -1 }),
    ]).then(() => undefined);
  }

  await globalThis.__mongodbIndexesReadyPromise;
  return db;
}

function roomExpiresAt(timestamp = now()) {
  return new Date(timestamp + ROOM_INACTIVITY_MS);
}

async function loadRoom(roomCode: string): Promise<Room | null> {
  const db = await getDb();
  const roomDoc = await db.collection<RoomDocument>(ROOMS_COLLECTION).findOne({ code: roomCode.toUpperCase() });
  if (!roomDoc) {
    return null;
  }
  const { expiresAt: _expiresAt, ...room } = roomDoc;
  return room;
}

async function saveRoom(room: Room): Promise<void> {
  const db = await getDb();
  await db
    .collection<RoomDocument>(ROOMS_COLLECTION)
    .replaceOne({ code: room.code }, { ...room, expiresAt: roomExpiresAt() }, { upsert: true });
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

function allCluesUsed(room: Room) {
  return room.usedClueIds.length === room.categories.reduce((count, category) => count + category.clues.length, 0);
}

function clearActiveClue(room: Room) {
  room.activeClueId = undefined;
  room.buzzedPlayerId = undefined;
  room.submittedAnswer = undefined;
  room.attemptedPlayerIds = [];
}

async function finishMatch(room: Room) {
  room.phase = "finished";
  clearActiveClue(room);
  room.finalPrompt = undefined;
  room.finalSubmissions = {};
  room.finalResolved = false;
  await pushHistory(room);
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
        expiresAt: roomExpiresAt(updatedAt),
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

export async function deleteMatchHistoryEntry(entryId: string) {
  const history = await loadHistory();
  const next = history.filter((entry) => entry.id !== entryId);
  const deleted = next.length !== history.length;
  if (!deleted) {
    return false;
  }
  await saveHistory(next);
  return true;
}

export async function clearMatchHistory() {
  await saveHistory([]);
}

export async function saveBoardToLibrary(name: string, categories: Category[]) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Board name is required.");
  }

  validateCategories(categories);

  const timestamp = now();
  const board: BoardDocument = {
    id: generateId("board"),
    name: trimmedName,
    categories: cloneCategories(categories),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const db = await getDb();
  await db.collection<BoardDocument>(BOARDS_COLLECTION).insertOne(board);
  return board.id;
}

export async function listBoardsFromLibrary(): Promise<BoardSummary[]> {
  const db = await getDb();
  const boards = await db
    .collection<BoardDocument>(BOARDS_COLLECTION)
    .find({}, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();

  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    categoryCount: board.categories.length,
    clueCount: board.categories.reduce((sum, category) => sum + category.clues.length, 0),
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
  }));
}

export async function deleteBoardFromLibrary(boardId: string) {
  const db = await getDb();
  const result = await db.collection<BoardDocument>(BOARDS_COLLECTION).deleteOne({ id: boardId });
  return result.deletedCount > 0;
}

export async function resetRoom(roomCode: string, playerId: string) {
  const room = await getRoomOrThrow(roomCode);
  const player = getPlayerOrThrow(room, playerId);

  if (!player.isHost) {
    throw new Error("Only host can reset the room.");
  }

  if (room.phase !== "finished") {
    throw new Error("Room can only be reset after a match is finished.");
  }

  // Reset scores and remove the host-only flag logic; keep all current players.
  for (const p of room.players) {
    p.score = 0;
  }

  room.phase = "lobby";
  room.selectorId = room.hostId;
  room.usedClueIds = [];
  room.categories = cloneCategories(sampleBoard);
  clearActiveClue(room);
  room.finalPrompt = undefined;
  room.finalSubmissions = {};
  room.finalResolved = false;
  touchRoom(room);
  await saveRoom(room);
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

export async function skipClue(roomCode: string, playerId: string) {
  const room = await getRoomOrThrow(roomCode);
  const player = getPlayerOrThrow(room, playerId);

  if (!player.isHost) {
    throw new Error("Only host can skip a clue.");
  }

  if (room.phase !== "clue") {
    throw new Error("Skip is only available during the open buzz phase.");
  }

  const clue = findClue(room, room.activeClueId);
  if (!clue) {
    throw new Error("No active clue to skip.");
  }

  room.selectorId = getNextSelectorId(room);
  room.usedClueIds.push(clue.id);
  clearActiveClue(room);

  if (allCluesUsed(room)) {
    await finishMatch(room);
  } else {
    room.phase = "board";
  }

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
    clearActiveClue(room);

    if (allCluesUsed(room)) {
      await finishMatch(room);
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
    clearActiveClue(room);
    if (allCluesUsed(room)) {
      await finishMatch(room);
    } else {
      room.phase = "board";
    }
  } else {
    room.phase = "clue";
  }
  touchRoom(room);
  await saveRoom(room);
}

export async function submitFinal(roomCode: string, playerId: string, wager: number, answer: string) {
  void roomCode;
  void playerId;
  void wager;
  void answer;
  throw new Error("Final Jeopardy is disabled for this game mode.");
}

export async function resolveFinal(roomCode: string, playerId: string) {
  void roomCode;
  void playerId;
  throw new Error("Final Jeopardy is disabled for this game mode.");
}
