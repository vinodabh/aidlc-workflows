import type { IntentSelection } from "./record";

export interface RecentProject {
  path: string;
  openedAt: string;
}

export interface Preferences {
  recentProjects: RecentProject[];
  chosenIntent: Record<string, IntentSelection>;
}

export const RECENT_CAP = 8;

export function emptyPreferences(): Preferences {
  return { recentProjects: [], chosenIntent: {} };
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
  const record = parsed as { recentProjects?: unknown; chosenIntent?: unknown };
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
  return { recentProjects: recentProjects.slice(0, RECENT_CAP), chosenIntent };
}
