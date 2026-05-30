import {
  buzz,
  judgeAnswer,
  resolveFinal,
  resetRoom,
  selectClue,
  setRoomBoard,
  setRoomCategories,
  skipClue,
  startGame,
  submitFinal,
  submitAnswer,
} from "@/lib/game-store";
import type { Category } from "@/lib/types";
import { NextResponse } from "next/server";

type ActionType =
  | "start"
  | "reset"
  | "select"
  | "buzz"
  | "skipClue"
  | "submit"
  | "judge"
  | "finalSubmit"
  | "finalResolve"
  | "setBoard"
  | "setCategories";

interface ActionBody {
  type?: ActionType;
  playerId?: string;
  clueId?: string;
  answer?: string;
  isCorrect?: boolean;
  wager?: number;
  categories?: Category[];
  boardId?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  try {
    const { roomCode } = await params;
    const body = (await request.json()) as ActionBody;
    const playerId = body.playerId?.trim();

    if (!body.type || !playerId) {
      return NextResponse.json({ error: "type and playerId are required" }, { status: 400 });
    }

    switch (body.type) {
      case "start":
        await startGame(roomCode, playerId);
        break;
      case "reset":
        await resetRoom(roomCode, playerId);
        break;
      case "select":
        if (!body.clueId) {
          return NextResponse.json({ error: "clueId is required for select" }, { status: 400 });
        }
        await selectClue(roomCode, playerId, body.clueId);
        break;
      case "buzz":
        await buzz(roomCode, playerId);
        break;
      case "skipClue":
        await skipClue(roomCode, playerId);
        break;
      case "submit":
        submitAnswer(roomCode, playerId, body.answer ?? "");
        break;
      case "judge":
        await judgeAnswer(roomCode, playerId, Boolean(body.isCorrect));
        break;
      case "finalSubmit":
        await submitFinal(roomCode, playerId, Number(body.wager ?? 0), body.answer ?? "");
        break;
      case "finalResolve":
        await resolveFinal(roomCode, playerId);
        break;
      case "setCategories":
        if (!body.categories) {
          return NextResponse.json({ error: "categories are required for setCategories" }, { status: 400 });
        }
        await setRoomCategories(roomCode, playerId, body.categories);
        break;
      case "setBoard":
        if (!body.boardId) {
          return NextResponse.json({ error: "boardId is required for setBoard" }, { status: 400 });
        }
        await setRoomBoard(roomCode, playerId, body.boardId);
        break;
      default:
        return NextResponse.json({ error: "Unsupported action type" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
