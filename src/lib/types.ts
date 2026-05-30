export type GamePhase = "lobby" | "board" | "clue" | "judging" | "final" | "finished";

export interface Clue {
  id: string;
  value: number;
  question: string;
  answer: string;
}

export interface Category {
  id: string;
  title: string;
  clues: Clue[];
}

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  connected: boolean;
  lastSeenAt: number;
}

export interface FinalPrompt {
  question: string;
  answer: string;
}

export interface FinalSubmission {
  wager: number;
  answer: string;
  submittedAt: number;
}

export interface MatchHistoryEntry {
  id: string;
  roomCode: string;
  finishedAt: number;
  winnerName: string;
  winnerScore: number;
  players: Array<{
    id: string;
    name: string;
    score: number;
  }>;
}

export interface Room {
  code: string;
  phase: GamePhase;
  players: Player[];
  categories: Category[];
  hostId: string;
  selectorId: string;
  usedClueIds: string[];
  activeClueId?: string;
  buzzedPlayerId?: string;
  submittedAnswer?: string;
  attemptedPlayerIds: string[];
  finalPrompt?: FinalPrompt;
  finalSubmissions: Record<string, FinalSubmission>;
  finalResolved: boolean;
  eventVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface PublicRoomState {
  code: string;
  phase: GamePhase;
  players: Player[];
  categories: Array<{
    id: string;
    title: string;
    clues: Array<{
      id: string;
      value: number;
      used: boolean;
    }>;
  }>;
  selectorId: string;
  activeClue?: {
    id: string;
    categoryTitle: string;
    question: string;
    value: number;
    expectedAnswer?: string;
    buzzedPlayerId?: string;
    submittedAnswer?: string;
    attemptedPlayerIds: string[];
  };
  final?: {
    question: string;
    expectedAnswer?: string;
    submissionCount: number;
    submittedPlayerIds: string[];
    selfSubmission?: {
      wager: number;
      answer: string;
    };
    resolved: boolean;
  };
  eventVersion: number;
}
