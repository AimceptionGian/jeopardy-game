import { getMatchHistory } from "@/lib/game-store";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? 15);
  const limit = Number.isNaN(rawLimit) ? 15 : rawLimit;
  return NextResponse.json({ matches: await getMatchHistory(limit) });
}
