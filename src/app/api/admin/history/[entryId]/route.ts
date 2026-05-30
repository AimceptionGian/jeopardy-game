import { getAdminAuthError } from "@/lib/admin-auth";
import { deleteMatchHistoryEntry } from "@/lib/game-store";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const authError = getAdminAuthError(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError.includes("configured") ? 500 : 401 });
  }

  try {
    const { entryId } = await params;
    const deleted = await deleteMatchHistoryEntry(entryId);

    if (!deleted) {
      return NextResponse.json({ error: "History entry not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
