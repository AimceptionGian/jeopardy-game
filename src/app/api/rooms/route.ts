import { createRoom } from "@/lib/game-store";
import type { Category } from "@/lib/types";
import { NextResponse } from "next/server";

interface CreateRoomBody {
  hostName?: string;
  categories?: Category[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateRoomBody;
    const hostName = body.hostName?.trim();

    if (!hostName) {
      return NextResponse.json({ error: "hostName is required" }, { status: 400 });
    }

    const created = await createRoom(hostName, body.categories);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
