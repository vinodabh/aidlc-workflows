import type { IntentSelection } from "./record";

export interface RecentProject {
  path: string;
  openedAt: string;
}

export type ThemeChoice = "system" | "light" | "dark";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Preferences {
  recentProjects: RecentProject[];
  chosenIntent: Record<string, IntentSelection>;
  theme: ThemeChoice;
  commandPath: string;
  windowBounds: WindowBounds | null;
}

export const RECENT_CAP = 8;

const themeChoices = new Set<string>(["system", "light", "dark"]);

export function themeChoice(value: unknown): ThemeChoice {
  return typeof value === "string" && themeChoices.has(value) ? value as ThemeChoice : "system";
}

export function commandOverride(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replaceAll("\0", "").trim();
  return cleaned.length > 4096 ? cleaned.slice(0, 4096) : cleaned;
}

export function emptyPreferences(): Preferences {
  return { recentProjects: [], chosenIntent: {}, theme: "system", commandPath: "", windowBounds: null };
}

export function rememberProject(list: readonly RecentProject[], path: string, openedAt: string): RecentProject[] {
  const trimmed = path.trim();
  if (!trimmed) return list.slice(0, RECENT_CAP);
  const rest = list.filter((item) => item.path !== trimmed);
  return [{ path: trimmed, openedAt }, ...rest].slice(0, RECENT_CAP);
}

export function liveRecents(list: readonly RecentProject[], exists: (path: string) => boolean): RecentProject[] {
  return list.filter((item) => item.path.trim() !== "" && exists(item.path)).slice(0, RECENT_CAP);
}

export function parsePreferences(text: string): Preferences {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return emptyPreferences();
  }
  if (!parsed || typeof parsed !== "object") return emptyPreferences();
  const record = parsed as {
    recentProjects?: unknown;
    chosenIntent?: unknown;
    theme?: unknown;
    commandPath?: unknown;
    windowBounds?: unknown;
  };
  const recentProjects: RecentProject[] = [];
  if (Array.isArray(record.recentProjects)) {
    for (const item of record.recentProjects) {
      if (!item || typeof item !== "object") continue;
      const row = item as { path?: unknown; openedAt?: unknown };
      if (typeof row.path !== "string" || row.path.trim() === "") continue;
      recentProjects.push({
        path: row.path,
        openedAt: typeof row.openedAt === "string" ? row.openedAt : "",
      });
    }
  }
  const chosenIntent: Preferences["chosenIntent"] = {};
  if (record.chosenIntent && typeof record.chosenIntent === "object") {
    for (const [key, value] of Object.entries(record.chosenIntent)) {
      if (!value || typeof value !== "object") continue;
      const row = value as { space?: unknown; dirName?: unknown };
      if (typeof row.space !== "string" || typeof row.dirName !== "string") continue;
      if (row.space.trim() === "" || row.dirName.trim() === "") continue;
      chosenIntent[key] = { space: row.space, dirName: row.dirName };
    }
  }
  return {
    recentProjects: recentProjects.slice(0, RECENT_CAP),
    chosenIntent,
    theme: themeChoice(record.theme),
    commandPath: commandOverride(record.commandPath),
    windowBounds: readBounds(record.windowBounds),
  };
}

function readBounds(value: unknown): WindowBounds | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  if (![row.x, row.y, row.width, row.height].every((item) => typeof item === "number" && Number.isFinite(item))) {
    return null;
  }
  const width = row.width as number;
  const height = row.height as number;
  if (width < 1 || height < 1) return null;
  return { x: row.x as number, y: row.y as number, width, height };
}
