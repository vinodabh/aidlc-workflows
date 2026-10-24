import type { CheckboxMark, NextAction, Snapshot } from "./record";
import { retainDocument } from "./session";

export interface Presented {
  headline: string;
  choices: { space: string; dirName: string; label: string }[];
  summary: { label: string; value: string }[];
  stages: { slug: string; label: string }[];
  documents: { file: string; name: string; open: boolean }[];
  nextLabel: string | null;
  draftLabel: string | null;
  openFile: string | null;
}

export function markLabel(mark: CheckboxMark, suffix: string): string {
  if (mark === " " && suffix === "SKIP") return "Planned skip";
  switch (mark) {
    case " ":
      return "Not started";
    case "-":
      return "In progress";
    case "?":
      return "Waiting for approval";
    case "R":
      return "Revising";
    case "x":
      return "Done";
    case "S":
      return "Skipped";
  }
}

export function nextActionLabel(action: NextAction): string {
  switch (action.kind) {
    case "answer":
      return `Answer ${action.questionId}`;
    case "approve":
      return `Approve ${action.stage}`;
    case "bolt":
      return `Continue ${action.id}`;
    case "claim":
      return `Claim ${action.unit}`;
    case "none":
      return "Nothing is waiting";
  }
}

export function draftCaption(action: NextAction): string | null {
  if (action.kind === "answer") return `Answer ${action.questionId}`;
  if (action.kind === "approve") return "Comments";
  return null;
}

export function present(snapshot: Snapshot | null, openFile: string | null): Presented {
  const empty: Presented = {
    headline: "Open a project folder.",
    choices: [],
    summary: [],
    stages: [],
    documents: [],
    nextLabel: null,
    draftLabel: null,
    openFile: null,
  };
  if (!snapshot) return empty;
  if (snapshot.kind === "missing-record") {
    return { ...empty, headline: "This folder has no AI-DLC record." };
  }
  if (snapshot.kind === "choose-intent") {
    return {
      ...empty,
      headline: "Which piece of work should Navigator open?",
      choices: snapshot.choices.map((choice) => ({
        space: choice.space,
        dirName: choice.dirName,
        label: choice.slug,
      })),
    };
  }
  const intent = snapshot.intent;
  const file = retainDocument(openFile, intent.documents);
  const summary = [
    ["Space", intent.space],
    ["Phase", intent.phase ?? ""],
    ["Current stage", intent.currentStage ?? ""],
    ["Next stage", intent.nextStage ?? ""],
    ["Status", intent.status ?? ""],
  ].flatMap(([label, value]) => (value ? [{ label, value }] : []));
  return {
    headline: intent.slug,
    choices: [],
    summary,
    stages: intent.stages.map((stage) => ({
      slug: stage.slug,
      label: markLabel(stage.mark, stage.suffix),
    })),
    documents: intent.documents.map((doc) => ({ ...doc, open: doc.file === file })),
    nextLabel: nextActionLabel(snapshot.nextAction),
    draftLabel: draftCaption(snapshot.nextAction),
    openFile: file,
  };
}
