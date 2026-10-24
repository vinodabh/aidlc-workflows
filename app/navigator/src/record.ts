import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** The six stage checkbox marks from the intent state file. */
export type CheckboxMark = " " | "-" | "?" | "R" | "x" | "S";

export interface StageLine {
  slug: string;
  mark: CheckboxMark;
  suffix: string;
}

export interface BlankAnswer {
  /** Project-relative path, with `/` separators. */
  file: string;
  questionId: string;
  line: number;
}

export interface StageDocument {
  /** Project-relative path, with `/` separators. */
  file: string;
  name: string;
}

export interface IntentSelection {
  space: string;
  dirName: string;
}

export interface IntentChoice {
  space: string;
  dirName: string;
  slug: string;
  status: string;
}

export interface IntentView {
  space: string;
  dirName: string;
  slug: string;
  phase: string | null;
  currentStage: string | null;
  nextStage: string | null;
  status: string | null;
  stages: StageLine[];
  blankAnswers: BlankAnswer[];
  documents: StageDocument[];
}

export type NextAction =
  | { kind: "answer"; file: string; questionId: string }
  | { kind: "approve"; stage: string }
  | { kind: "bolt"; id: string }
  | { kind: "claim"; unit: string }
  | { kind: "none" };

export type Snapshot =
  | { kind: "missing-record" }
  | { kind: "choose-intent"; choices: IntentChoice[] }
  | { kind: "intent"; intent: IntentView; nextAction: NextAction };

// State files put an em dash between the stage slug and EXECUTE or SKIP.
const checkboxLine = /^- \[([ xSR?-])\] (\S+)\s*\u2014\s*(.*)$/;
const statusLine = /^- \*\*(.+?)\*\*:\s*(.*)$/;
const questionHeading = /^#{1,6}\s+Q(\d+)\b/;
const blankAnswerLine = /^\[Answer\]:\s*$/;
const workspaceName = "aidlc";

const MARKS = new Set<string>([" ", "-", "?", "R", "x", "S"]);

interface RegistryRow {
  slug: string;
  dirName: string;
  status: string;
}

/** Blank answer, then approval, then a waiting bolt, then a free unit. */
export function pickNextAction(input: {
  blankAnswers: readonly BlankAnswer[];
  currentStage: { slug: string; mark: CheckboxMark } | null;
  waitingBolts?: readonly { id: string }[];
  freeUnits?: readonly { name: string }[];
}): NextAction {
  const answer = input.blankAnswers[0];
  if (answer) return { kind: "answer", file: answer.file, questionId: answer.questionId };
  if (input.currentStage?.mark === "?") return { kind: "approve", stage: input.currentStage.slug };
  const bolt = input.waitingBolts?.[0];
  if (bolt) return { kind: "bolt", id: bolt.id };
  const unit = input.freeUnits?.[0];
  if (unit) return { kind: "claim", unit: unit.name };
  return { kind: "none" };
}

export function parseStageLines(content: string): StageLine[] {
  const stages: StageLine[] = [];
  for (const line of content.split(/\r?\n/)) {
    const match = checkboxLine.exec(line);
    if (!match) continue;
    const mark = match[1] ?? " ";
    if (!MARKS.has(mark)) continue;
    stages.push({
      slug: match[2] ?? "",
      mark: mark as CheckboxMark,
      suffix: (match[3] ?? "").trim(),
    });
  }
  return stages;
}

export function readProject(projectRoot: string, selection?: IntentSelection | null): Snapshot {
  const workspace = join(projectRoot, workspaceName);
  if (!isDir(workspace)) return { kind: "missing-record" };

  const spaces = listSpaces(workspace);
  if (selection) {
    const picked = openSelection(projectRoot, workspace, spaces, selection);
    if (picked) return picked;
  }

  const spaceName = readCursor(join(workspace, "active-space"));
  const space = spaceName && spaces.includes(spaceName) ? spaceName : null;
  if (!space) {
    return { kind: "choose-intent", choices: openChoices(workspace, spaces) };
  }

  const intentsRoot = join(workspace, "spaces", space, "intents");
  const cursor = readCursor(join(intentsRoot, "active-intent"));
  if (!cursor || !isDir(join(intentsRoot, cursor))) {
    return { kind: "choose-intent", choices: openChoices(workspace, [space]) };
  }

  return intentSnapshot(projectRoot, workspace, space, cursor);
}

/** A saved pick applies only when the cursors are missing and that work is still open. */
export function readProjectWithSavedChoice(projectRoot: string, saved: IntentSelection | null): Snapshot {
  const snapshot = readProject(projectRoot);
  if (snapshot.kind !== "choose-intent" || !saved) return snapshot;
  const match = snapshot.choices.some((choice) => choice.space === saved.space && choice.dirName === saved.dirName);
  if (!match) return snapshot;
  return readProject(projectRoot, saved);
}

function readIntent(projectRoot: string, workspace: string, space: string, dirName: string): IntentView {
  const record = join(workspace, "spaces", space, "intents", dirName);
  const state = readText(join(record, `${workspaceName}-state.md`)) ?? "";
  const fields = parseStatus(state);
  const phase = fields.get("Lifecycle Phase") ?? null;
  const currentStage = fields.get("Current Stage") ?? null;
  const registry = readRegistry(join(record, "..", "intents.json"));
  const row = registry.find((entry) => entry.dirName === dirName);
  const phaseDir = phase ? segment(phase.toLowerCase()) : null;
  const stageDir = currentStage ? segment(currentStage) : null;
  return {
    space,
    dirName,
    slug: row?.slug ?? dirName,
    phase,
    currentStage,
    nextStage: fields.get("Next Stage") ?? null,
    status: fields.get("Status") ?? null,
    stages: parseStageLines(state),
    blankAnswers: phaseDir && stageDir
      ? blankAnswersUnder(projectRoot, join(record, phaseDir, stageDir))
      : [],
    documents: phaseDir && stageDir
      ? markdownUnder(projectRoot, join(record, phaseDir, stageDir))
      : [],
  };
}

function openSelection(
  projectRoot: string,
  workspace: string,
  spaces: readonly string[],
  selection: IntentSelection,
): Snapshot | null {
  const space = segment(selection.space);
  const dirName = segment(selection.dirName);
  if (!space || !dirName || !spaces.includes(space)) return null;
  const record = join(workspace, "spaces", space, "intents", dirName);
  if (readText(join(record, `${workspaceName}-state.md`)) === null) return null;
  return intentSnapshot(projectRoot, workspace, space, dirName);
}

function intentSnapshot(projectRoot: string, workspace: string, space: string, dirName: string): Snapshot {
  const intent = readIntent(projectRoot, workspace, space, dirName);
  const current = intent.stages.find((stage) => stage.slug === intent.currentStage) ?? null;
  return {
    kind: "intent",
    intent,
    nextAction: pickNextAction({
      blankAnswers: intent.blankAnswers,
      currentStage: current && intent.currentStage
        ? { slug: intent.currentStage, mark: current.mark }
        : null,
    }),
  };
}

function openChoices(workspace: string, spaces: readonly string[]): IntentChoice[] {
  const choices: IntentChoice[] = [];
  for (const space of spaces) {
    const intentsRoot = join(workspace, "spaces", space, "intents");
    const registry = readRegistry(join(intentsRoot, "intents.json"));
    const known = new Set<string>();
    for (const row of registry) {
      known.add(row.dirName);
      if (!isOpenStatus(row.status)) continue;
      if (!isDir(join(intentsRoot, row.dirName))) continue;
      choices.push({ space, dirName: row.dirName, slug: row.slug, status: row.status });
    }
    for (const dirName of listChildDirs(intentsRoot)) {
      if (known.has(dirName)) continue;
      if (!readText(join(intentsRoot, dirName, `${workspaceName}-state.md`))) continue;
      choices.push({ space, dirName, slug: dirName, status: "unknown" });
    }
  }
  choices.sort((a, b) => a.space.localeCompare(b.space) || a.dirName.localeCompare(b.dirName));
  return choices;
}

function blankAnswersUnder(projectRoot: string, stageDir: string): BlankAnswer[] {
  const found: BlankAnswer[] = [];
  for (const file of questionFiles(stageDir)) {
    const text = readText(file);
    if (text === null) continue;
    const lines = text.split(/\r?\n/);
    let questionId = "";
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index] ?? "";
      const heading = questionHeading.exec(line);
      if (heading?.[1]) questionId = `Q${heading[1]}`;
      if (!blankAnswerLine.test(line)) continue;
      found.push({
        file: relative(projectRoot, file).split(sep).join("/"),
        questionId: questionId || `line-${index + 1}`,
        line: index + 1,
      });
    }
  }
  found.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return found;
}

function markdownUnder(projectRoot: string, stageDir: string): StageDocument[] {
  const docs: StageDocument[] = [];
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        docs.push({
          file: relative(projectRoot, path).split(sep).join("/"),
          name: entry.name,
        });
      }
    }
  };
  walk(stageDir);
  docs.sort((a, b) => a.file.localeCompare(b.file));
  return docs;
}

function questionFiles(dir: string): string[] {
  const files: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...questionFiles(path));
    else if (entry.isFile() && entry.name.endsWith("-questions.md")) files.push(path);
  }
  return files;
}

function parseStatus(content: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const match = statusLine.exec(line);
    if (!match?.[1]) continue;
    const value = (match[2] ?? "").trim();
    if (!value || value.toLowerCase() === "none") continue;
    fields.set(match[1].trim(), value);
  }
  return fields;
}

function readRegistry(path: string): RegistryRow[] {
  const text = readText(path);
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const rows: RegistryRow[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as { slug?: unknown; dirName?: unknown; status?: unknown };
    const dirName = typeof record.dirName === "string" ? segment(record.dirName) : null;
    if (!dirName) continue;
    const slug = typeof record.slug === "string" && segment(record.slug) ? record.slug.trim() : dirName;
    const status = typeof record.status === "string" ? record.status.trim() : "unknown";
    rows.push({ slug, dirName, status });
  }
  return rows;
}

function isOpenStatus(status: string): boolean {
  const value = status.trim().toLowerCase();
  return value !== "complete" && value !== "archived";
}

function listSpaces(workspace: string): string[] {
  return listChildDirs(join(workspace, "spaces"));
}

function listChildDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && segment(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function readCursor(path: string): string | null {
  const text = readText(path);
  if (text === null) return null;
  return segment(text.split(/\r?\n/, 1)[0] ?? "");
}

function segment(value: string): string | null {
  const text = value.trim();
  if (!text || text === "." || text === ".." || text.includes("/") || text.includes("\\")) return null;
  return text;
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
