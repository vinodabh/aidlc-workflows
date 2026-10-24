import { describe, expect, test } from "bun:test";
import { actionDraftKey, createRefreshGate, retainDocument, retainDraft } from "./session";

describe("drafts", () => {
  test("keeps text for the same question and drops it when the question changes", () => {
    const answer = { kind: "answer" as const, file: "questions.md", questionId: "Q2" };
    const key = actionDraftKey(answer);
    expect(retainDraft(key, "still typing", key)).toBe("still typing");
    expect(retainDraft(key, "still typing", actionDraftKey({ kind: "approve", stage: "feasibility" }))).toBe("");
    expect(retainDraft(key, "", key)).toBe("");
    expect(actionDraftKey({ kind: "none" })).toBeNull();
  });

  test("keeps the open document when it is still listed", () => {
    const docs = [{ file: "a.md" }, { file: "b.md" }];
    expect(retainDocument("b.md", docs)).toBe("b.md");
    expect(retainDocument("gone.md", docs)).toBe("a.md");
    expect(retainDocument("a.md", [])).toBeNull();
  });

  test("collapses a burst of refreshes into one read", () => {
    const fired: number[] = [];
    let queued: (() => void) | null = null;
    let cancels = 0;
    const gate = createRefreshGate(300, () => fired.push(1), (fn) => {
      queued = fn;
      return {
        cancel: () => {
          cancels += 1;
          queued = null;
        },
      };
    });
    gate.poke();
    gate.poke();
    expect(cancels).toBe(1);
    const run = queued;
    run?.();
    expect(fired).toEqual([1]);
  });
});
