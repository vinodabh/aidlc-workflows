import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { pickNextAction, readProject, type Snapshot } from "./record";

const fixtures = join(import.meta.dir, "../fixtures");

function opened(name: string): Extract<Snapshot, { kind: "intent" }> {
  const snapshot = readProject(join(fixtures, name));
  if (snapshot.kind !== "intent") throw new Error(`${name} did not open an intent`);
  return snapshot;
}

describe("readProject", () => {
  test("reports a folder with no workflow record", () => {
    expect(readProject(join(fixtures, "missing-record"))).toEqual({ kind: "missing-record" });
  });

  test("asks which open intent to show when the cursors are missing", () => {
    const snapshot = readProject(join(fixtures, "several-intents"));
    expect(snapshot.kind).toBe("choose-intent");
    if (snapshot.kind !== "choose-intent") return;
    expect(snapshot.choices.map((choice) => choice.slug)).toEqual(["one", "two"]);
  });

  test("follows the intent cursor when it names a record", () => {
    const snapshot = opened("cursor-selects");
    expect(snapshot.intent.slug).toBe("two");
    expect(snapshot.intent.currentStage).toBe("two");
  });

  test("reads the six checkbox states and leaves a planned skip unmarked", () => {
    const snapshot = opened("checkboxes");
    expect(snapshot.intent.stages.map((stage) => [stage.slug, stage.mark, stage.suffix])).toEqual([
      ["not-started", " ", "EXECUTE"],
      ["in-progress", "-", "EXECUTE"],
      ["awaiting", "?", "EXECUTE"],
      ["revising", "R", "EXECUTE"],
      ["completed", "x", "EXECUTE"],
      ["skipped-run", "S", "EXECUTE"],
      ["planned-skip", " ", "SKIP"],
    ]);
  });

  test("finds blank answers and prefers them over an approval", () => {
    const snapshot = opened("blank-answer");
    expect(snapshot.intent.blankAnswers.map((answer) => answer.questionId)).toEqual(["Q2", "Q3"]);
    expect(snapshot.nextAction).toEqual({
      kind: "answer",
      file: "aidlc/spaces/default/intents/261024-blank/ideation/feasibility/scope-questions.md",
      questionId: "Q2",
    });
  });

  test("asks for approval when the current stage is waiting and answers are filled", () => {
    const snapshot = opened("awaiting-approval");
    expect(snapshot.intent.blankAnswers).toEqual([]);
    expect(snapshot.nextAction).toEqual({ kind: "approve", stage: "feasibility" });
  });

  test("has nothing waiting when the current stage is finished", () => {
    const snapshot = opened("idle");
    expect(snapshot.intent.nextStage).toBeNull();
    expect(snapshot.intent.blankAnswers).toEqual([]);
    expect(snapshot.nextAction).toEqual({ kind: "none" });
  });
});

describe("pickNextAction", () => {
  test("ranks a waiting bolt ahead of a free unit, and a free unit ahead of nothing", () => {
    const currentStage = { slug: "code-generation", mark: "x" as const };
    expect(pickNextAction({
      blankAnswers: [],
      currentStage,
      waitingBolts: [{ id: "payments" }],
      freeUnits: [{ name: "parser" }],
    })).toEqual({ kind: "bolt", id: "payments" });
    expect(pickNextAction({
      blankAnswers: [],
      currentStage,
      freeUnits: [{ name: "parser" }],
    })).toEqual({ kind: "claim", unit: "parser" });
    expect(pickNextAction({
      blankAnswers: [{ file: "questions.md", questionId: "Q1", line: 3 }],
      currentStage: { slug: "feasibility", mark: "?" },
      waitingBolts: [{ id: "payments" }],
      freeUnits: [{ name: "parser" }],
    }).kind).toBe("answer");
  });
});
