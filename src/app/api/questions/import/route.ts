import type { Category } from "@/lib/types";
import { NextResponse } from "next/server";

interface ImportBody {
  format?: "json" | "csv";
  content?: string;
}

function validateCategories(categories: Category[]) {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error("No categories found.");
  }

  for (const category of categories) {
    if (!category.id || !category.title || !Array.isArray(category.clues) || category.clues.length === 0) {
      throw new Error("Invalid category structure.");
    }
    for (const clue of category.clues) {
      if (!clue.id || typeof clue.value !== "number" || !clue.question || !clue.answer) {
        throw new Error("Invalid clue structure.");
      }
    }
  }
}

function parseCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV requires a header and at least one row.");
  }

  const headers = lines[0].split(",").map((value) => value.trim().toLowerCase());
  const categoryIndex = headers.indexOf("category");
  const valueIndex = headers.indexOf("value");
  const questionIndex = headers.indexOf("question");
  const answerIndex = headers.indexOf("answer");

  if ([categoryIndex, valueIndex, questionIndex, answerIndex].some((index) => index < 0)) {
    throw new Error("CSV header must include category,value,question,answer.");
  }

  const grouped = new Map<string, Category>();

  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",").map((value) => value.trim());
    const title = parts[categoryIndex];
    const value = Number(parts[valueIndex]);
    const question = parts[questionIndex];
    const answer = parts[answerIndex];

    if (!title || Number.isNaN(value) || !question || !answer) {
      throw new Error(`Invalid CSV row at line ${i + 1}.`);
    }

    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const category = grouped.get(id) ?? { id, title, clues: [] };
    category.clues.push({
      id: `${id}-${value}-${category.clues.length + 1}`,
      value,
      question,
      answer,
    });
    grouped.set(id, category);
  }

  return Array.from(grouped.values());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ImportBody;

    if (!body.format || !body.content) {
      return NextResponse.json({ error: "format and content are required" }, { status: 400 });
    }

    let categories: Category[];

    if (body.format === "json") {
      categories = JSON.parse(body.content) as Category[];
    } else {
      categories = parseCsv(body.content);
    }

    validateCategories(categories);
    return NextResponse.json({ categories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
