---
agent: ask
description: "Create a Jeopardy board JSON file in the local boards folder with German default content and controlled 100-500 difficulty."
---

Task:
Create a Jeopardy board as a JSON file for this project.

Target output folder:
- C:\Users\Gian\Desktop\Coding\QuizWebsite\jeopardy-boards

Workflow:
- Generate a valid board JSON.
- Write it to a new file in the target folder.
- File name format: jeopardy-<slug>-YYYYMMDD-HHMMSS.json
- After writing the file, return only a short confirmation with the full file path.
- Do not print the full JSON in chat unless the user explicitly asks for it.

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

Default board size:
- 5 categories
- 5 clues per category
- values: 100, 200, 300, 400, 500

Input modes:
- The user can provide exactly one of these:
  - One over-arching theme for the whole board
  - Five explicit category names
- If one theme is provided:
  - Derive exactly 5 fitting categories from that theme.
- If five categories are provided:
  - Use those five categories directly (same intent and wording, only minor cleanup allowed).

Language rules:
- Default language is German.
- Use English only if the user explicitly asks for English.

Difficulty rules (strict):
- 100: very easy, broad/common knowledge
- 200: easy
- 300: medium
- 400: hard
- 500: very hard
- Difficulty must increase clearly with point value within each category.

Quality rules:
- Questions should be spoken-friendly.
- Answers should be short and precise.
- Avoid ambiguous questions with multiple equally correct answers.
- Keep wording natural German by default.

ID format recommendation:
- category id: lowercase-kebab-case title
- clue id: <category-id>-<value>-<index>

If the user provides additional preferences, apply them exactly if schema-compatible.
If something conflicts with the schema, prioritize schema validity.
