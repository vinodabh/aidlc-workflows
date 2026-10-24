import { posix, win32 } from "node:path";

const commandName = "aidlc";

export interface CommandProbe {
  env: Record<string, string | undefined>;
  home: string;
  platform: "win32" | "linux" | "darwin";
  exists: (path: string) => boolean;
}

/** An override that exists wins. An override that does not exist does not fall through. */
export function resolveWorkflowCommand(probe: CommandProbe, override = ""): { path: string | null } {
  const chosen = override.trim();
  if (chosen) return { path: probe.exists(chosen) ? chosen : null };

  const paths = probe.platform === "win32" ? win32 : posix;
  const sep = probe.platform === "win32" ? ";" : ":";
  const raw = probe.platform === "win32"
    ? (probe.env.Path ?? probe.env.PATH ?? "")
    : (probe.env.PATH ?? probe.env.Path ?? "");
  const names = probe.platform === "win32" ? [`${commandName}.cmd`, commandName] : [commandName];
  for (const dir of raw.split(sep)) {
    const folder = dir.trim();
    if (!folder) continue;
    for (const name of names) {
      const candidate = paths.join(folder, name);
      if (probe.exists(candidate)) return { path: candidate };
    }
  }

  const fallback = probe.platform === "win32"
    ? paths.join(probe.env.LOCALAPPDATA?.trim() || paths.join(probe.home, "AppData", "Local"), commandName, "bin", `${commandName}.cmd`)
    : paths.join(probe.home, ".local", "bin", commandName);
  return { path: probe.exists(fallback) ? fallback : null };
}
