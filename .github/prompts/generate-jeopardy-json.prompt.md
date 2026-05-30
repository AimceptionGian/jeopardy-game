---
agent: ask
description: "Generate a valid Jeopardy categories JSON for this project import endpoint (host imports before match start)."
---

Generate ONLY valid JSON (no markdown, no commentary).

Goal:
Create a Jeopardy board payload that matches this project's import requirements.

Required output shape:
[
  {
    "id": "string",
    "title": "string",
    "clues": [
      {
        "id": "string",
        "value": 100,
        "question": "string",
        "answer": "string"
      }
    ]
  }
]

Hard constraints:
- Output must be a JSON array.
- Every category needs non-empty: id, title, clues.
- Every clue needs non-empty: id, question, answer.
- clue.value must be a number.
- IDs must be unique within the board.
- No trailing commas.
- No markdown code fences.

Default board size (unless user asks otherwise):
- 5 categories
- 5 clues per category
- values: 100, 200, 300, 400, 500

Content quality rules:
- Use short, spoken-friendly question wording.
- Keep answers concise (single term or short phrase when possible).
- Avoid ambiguous trivia where multiple answers are equally valid.
- Keep language consistent with user request (German if asked in German, otherwise English).

ID format recommendation:
- category id: lowercase-kebab-case title
- clue id: <category-id>-<value>-<index>

If the user provides preferences (topic, language, difficulty, board size), apply them exactly.
If something conflicts with the schema, prioritize schema validity.
