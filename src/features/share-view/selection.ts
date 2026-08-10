/** What is currently held in focus on the shared timeline. */
export type Selection =
  | { type: "thread"; threadId: string }
  | { type: "event"; threadId: string; index: number };
