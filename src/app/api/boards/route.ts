import { listBoardsFromLibrary } from "@/lib/game-store";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const boards = await listBoardsFromLibrary();
    return NextResponse.json({ boards });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
