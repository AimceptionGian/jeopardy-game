import type { Category } from "@/lib/types";

const values = [100, 200, 300, 400, 500];

function createClues(categoryId: string, lines: Array<{ question: string; answer: string }>) {
  return values.map((value, index) => ({
    id: `${categoryId}-${value}`,
    value,
    question: lines[index].question,
    answer: lines[index].answer,
  }));
}

export const sampleBoard: Category[] = [
  {
    id: "web",
    title: "Web",
    clues: createClues("web", [
      { question: "What does HTML stand for?", answer: "HyperText Markup Language" },
      { question: "Name the CSS property used to change text color.", answer: "color" },
      { question: "Which protocol secures HTTP with encryption?", answer: "HTTPS" },
      { question: "What JavaScript method converts JSON text to an object?", answer: "JSON.parse" },
      { question: "Which API keeps a browser connection open for full-duplex communication?", answer: "WebSocket" },
    ]),
  },
  {
    id: "react",
    title: "React",
    clues: createClues("react", [
      { question: "What hook is used for local component state?", answer: "useState" },
      { question: "What prop lets you render nested JSX from parent tags?", answer: "children" },
      { question: "Name the hook used to run side effects.", answer: "useEffect" },
      { question: "What file-system routing folder is used in modern Next.js?", answer: "app" },
      { question: "Which pattern centralizes state transitions using actions and reducers?", answer: "useReducer" },
    ]),
  },
  {
    id: "devops",
    title: "DevOps",
    clues: createClues("devops", [
      { question: "Which command installs dependencies from package-lock.json?", answer: "npm ci" },
      { question: "Name the git model with a single mainline branch and short-lived branches.", answer: "trunk based development" },
      { question: "Which file stores environment variables for local development in many JS apps?", answer: ".env.local" },
      { question: "What does CI stand for?", answer: "Continuous Integration" },
      { question: "Which cloud platform is commonly used to host Next.js with git deploys?", answer: "Vercel" },
    ]),
  },
  {
    id: "data",
    title: "Data",
    clues: createClues("data", [
      { question: "Which SQL statement reads rows from a table?", answer: "SELECT" },
      { question: "Name the index type typically used for exact lookup performance.", answer: "B-tree" },
      { question: "What JSON format represents a list of objects for import/export?", answer: "array" },
      { question: "Which HTTP method usually creates a new resource?", answer: "POST" },
      { question: "What is the process of changing schema over time called?", answer: "migration" },
    ]),
  },
  {
    id: "general",
    title: "General",
    clues: createClues("general", [
      { question: "How many minutes are in two hours?", answer: "120" },
      { question: "What planet is known as the Red Planet?", answer: "Mars" },
      { question: "Which ocean is the largest on Earth?", answer: "Pacific" },
      { question: "What is the square root of 81?", answer: "9" },
      { question: "Which language is primarily spoken in Brazil?", answer: "Portuguese" },
    ]),
  },
];
