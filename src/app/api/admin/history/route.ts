import { getAdminAuthError } from "@/lib/admin-auth";
import { clearMatchHistory, getMatchHistory } from "@/lib/game-store";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authError = getAdminAuthError(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError.includes("configured") ? 500 : 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get("limit") ?? 100);
    const limit = Number.isNaN(rawLimit) ? 100 : rawLimit;
    const matches = await getMatchHistory(limit);
    return NextResponse.json({ matches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authError = getAdminAuthError(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError.includes("configured") ? 500 : 401 });
  }

  try {
    await clearMatchHistory();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
