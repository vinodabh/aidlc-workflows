import type { NextAction } from "./record";

export const REFRESH_WAIT_MS = 300;

export function actionDraftKey(action: NextAction): string | null {
  if (action.kind === "answer") return `answer:${action.file}:${action.questionId}`;
  if (action.kind === "approve") return `gate:${action.stage}`;
  return null;
}

/** Keep typed text only while it still belongs to the same question or gate. */
export function retainDraft(previousKey: string | null, text: string, nextKey: string | null): string {
  if (text.length === 0) return "";
  if (previousKey !== nextKey) return "";
  return text;
}

export function retainDocument(openFile: string | null, documents: readonly { file: string }[]): string | null {
  if (openFile && documents.some((doc) => doc.file === openFile)) return openFile;
  return documents[0]?.file ?? null;
}

export function createRefreshGate(
  waitMs: number,
  run: () => void,
  schedule: (fn: () => void, ms: number) => { cancel: () => void } = defaultSchedule,
): { poke: () => void; cancel: () => void } {
  let pending: { cancel: () => void } | null = null;
  return {
    poke() {
      pending?.cancel();
      pending = schedule(() => {
        pending = null;
        run();
      }, waitMs);
    },
    cancel() {
      pending?.cancel();
      pending = null;
    },
  };
}

function defaultSchedule(fn: () => void, ms: number): { cancel: () => void } {
  const timer = setTimeout(fn, ms);
  return { cancel: () => clearTimeout(timer) };
}
