import { getRoomState, markOnline } from "@/lib/game-store";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  try {
    const { roomCode } = await params;
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId")?.trim();

    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 });
    }

    markOnline(roomCode, playerId);
    const room = getRoomState(roomCode, playerId);
    return NextResponse.json(room);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
