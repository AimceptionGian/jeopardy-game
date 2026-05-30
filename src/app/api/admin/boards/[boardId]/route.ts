import { getAdminAuthError } from "@/lib/admin-auth";
import { deleteBoardFromLibrary } from "@/lib/game-store";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const authError = getAdminAuthError(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError.includes("configured") ? 500 : 401 });
  }

  try {
    const { boardId } = await params;
    const deleted = await deleteBoardFromLibrary(boardId);

    if (!deleted) {
      return NextResponse.json({ error: "Board not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
