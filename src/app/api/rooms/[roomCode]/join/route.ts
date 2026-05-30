import { joinRoom } from "@/lib/game-store";
import { NextResponse } from "next/server";

interface JoinRoomBody {
  name?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  try {
    const { roomCode } = await params;
    const body = (await request.json()) as JoinRoomBody;
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const joined = await joinRoom(roomCode, name);
    return NextResponse.json(joined, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
