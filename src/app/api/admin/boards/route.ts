import { getAdminAuthError } from "@/lib/admin-auth";
import { listBoardsFromLibrary, saveBoardToLibrary } from "@/lib/game-store";
import type { Category } from "@/lib/types";
import { NextResponse } from "next/server";

interface CreateBoardBody {
  name?: string;
  content?: string;
  categories?: Category[];
}

export async function GET(request: Request) {
  const authError = getAdminAuthError(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError.includes("configured") ? 500 : 401 });
  }

  try {
    const boards = await listBoardsFromLibrary();
    return NextResponse.json({ boards });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = getAdminAuthError(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError.includes("configured") ? 500 : 401 });
  }

  try {
    const body = (await request.json()) as CreateBoardBody;
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    let categories: Category[];
    if (body.categories) {
      categories = body.categories;
    } else if (body.content) {
      categories = JSON.parse(body.content) as Category[];
    } else {
      return NextResponse.json({ error: "categories or content is required" }, { status: 400 });
    }

    const boardId = await saveBoardToLibrary(name, categories);
    return NextResponse.json({ ok: true, boardId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
