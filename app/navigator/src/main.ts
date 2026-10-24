import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, watch, writeFileSync, type FSWatcher } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, screen, type IpcMainInvokeEvent, type WebContents } from "electron";
import type { OpenResult, SettingsInput, SettingsView } from "./api";
import {
  commandOverride,
  emptyPreferences,
  liveRecents,
  parsePreferences,
  rememberProject,
  themeChoice,
  type Preferences,
  type RecentProject,
  type ThemeChoice,
  type WindowBounds,
} from "./preferences";
import { readProjectWithSavedChoice, type IntentSelection, type Snapshot } from "./record";
import { resolveWorkflowCommand } from "./resolve-command";
import { REFRESH_WAIT_MS, createRefreshGate } from "./session";
import { containedMarkdown, contentSecurityPolicy, windowSecurity } from "./security";
import { themes } from "./theme";

const here = fileURLToPath(new URL(".", import.meta.url));
const workspaceName = "aidlc";

let window: BrowserWindow | null = null;
let projectRoot: string | null = null;
let watcher: FSWatcher | null = null;

const gate = createRefreshGate(REFRESH_WAIT_MS, () => {
  const snapshot = currentSnapshot();
  if (snapshot && window && !window.isDestroyed()) window.webContents.send("nav:refreshed", snapshot);
});

function preferencesFile(): string {
  return join(app.getPath("userData"), "preferences.json");
}

function loadPrefs(): Preferences {
  try {
    return parsePreferences(readFileSync(preferencesFile(), "utf8"));
  } catch {
    return emptyPreferences();
  }
}

function storePrefs(prefs: Preferences): void {
  mkdirSync(app.getPath("userData"), { recursive: true });
  writeFileSync(preferencesFile(), `${JSON.stringify(prefs, null, 2)}\n`);
}

function canonicalDir(input: string): string | null {
  try {
    const real = realpathSync(input);
    if (!statSync(real).isDirectory()) return null;
    return real;
  } catch {
    return null;
  }
}

function savedChoice(root: string): IntentSelection | null {
  return loadPrefs().chosenIntent[root] ?? null;
}

function currentSnapshot(): Snapshot | null {
  if (!projectRoot) return null;
  return readProjectWithSavedChoice(projectRoot, savedChoice(projectRoot));
}

function remember(root: string): void {
  const prefs = loadPrefs();
  prefs.recentProjects = rememberProject(prefs.recentProjects, root, new Date().toISOString());
  storePrefs(prefs);
}

function rememberChoice(root: string, selection: IntentSelection): void {
  const prefs = loadPrefs();
  prefs.chosenIntent[root] = { space: selection.space, dirName: selection.dirName };
  storePrefs(prefs);
}

function armWatch(root: string): void {
  watcher?.close();
  watcher = null;
  const dir = join(root, workspaceName);
  try {
    if (!statSync(dir).isDirectory()) return;
  } catch {
    return;
  }
  const onChange = () => gate.poke();
  try {
    watcher = watch(dir, { recursive: true }, onChange);
  } catch {
    try {
      watcher = watch(dir, onChange);
    } catch {
      watcher = null;
    }
  }
}

function openRoot(input: string): OpenResult {
  const root = canonicalDir(input);
  if (!root) return { ok: false, reason: "That folder is not available." };
  projectRoot = root;
  remember(root);
  armWatch(root);
  return { ok: true, snapshot: readProjectWithSavedChoice(root, savedChoice(root)) };
}

function listedDocument(file: string): string | null {
  if (!projectRoot || file.includes("\0") || file.startsWith("/") || file.split("/").includes("..")) return null;
  const snapshot = currentSnapshot();
  if (!snapshot || snapshot.kind !== "intent") return null;
  if (!snapshot.intent.documents.some((doc) => doc.file === file)) return null;
  return containedMarkdown(projectRoot, join(projectRoot, ...file.split("/")));
}

function fromWindow(event: IpcMainInvokeEvent): boolean {
  return window !== null && !window.isDestroyed() && event.sender === window.webContents;
}

function harden(contents: WebContents): void {
  contents.session.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    headers["Content-Security-Policy"] = [contentSecurityPolicy];
    callback({ responseHeaders: headers });
  });
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event, url) => {
    if (contents.getURL() && url !== contents.getURL()) event.preventDefault();
  });
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  contents.session.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
}

function hostPlatform(): "win32" | "linux" | "darwin" {
  const name = platform();
  if (name === "win32" || name === "darwin") return name;
  return "linux";
}

function resolvedCommand(override: string): string | null {
  return resolveWorkflowCommand({
    env: process.env,
    home: homedir(),
    platform: hostPlatform(),
    exists: (path) => {
      try {
        return existsSync(path);
      } catch {
        return false;
      }
    },
  }, override).path;
}

function settingsView(): SettingsView {
  const prefs = loadPrefs();
  return { theme: prefs.theme, commandPath: prefs.commandPath, resolvedPath: resolvedCommand(prefs.commandPath) };
}

function windowColor(theme: ThemeChoice): string {
  const dark = theme === "dark" || (theme === "system" && nativeTheme.shouldUseDarkColors);
  return dark ? themes.dark.bg : themes.light.bg;
}

function boundsVisible(bounds: WindowBounds): boolean {
  if (bounds.width < 720 || bounds.height < 480) return false;
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return bounds.x + bounds.width > area.x
      && bounds.x < area.x + area.width
      && bounds.y + bounds.height > area.y
      && bounds.y < area.y + area.height;
  });
}

function createWindow(): void {
  const prefs = loadPrefs();
  const saved = prefs.windowBounds && boundsVisible(prefs.windowBounds) ? prefs.windowBounds : null;
  window = new BrowserWindow({
    width: saved?.width ?? 1100,
    height: saved?.height ?? 760,
    x: saved?.x,
    y: saved?.y,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: windowColor(prefs.theme),
    show: true,
    webPreferences: {
      preload: join(here, "preload.cjs"),
      contextIsolation: windowSecurity.contextIsolation,
      nodeIntegration: windowSecurity.nodeIntegration,
      sandbox: windowSecurity.sandbox,
    },
  });
  harden(window.webContents);
  const boundsGate = createRefreshGate(REFRESH_WAIT_MS, () => {
    if (!window || window.isDestroyed()) return;
    const next = loadPrefs();
    const box = window.getBounds();
    next.windowBounds = { x: box.x, y: box.y, width: box.width, height: box.height };
    storePrefs(next);
  });
  window.on("resize", () => boundsGate.poke());
  window.on("move", () => boundsGate.poke());
  window.on("closed", () => {
    boundsGate.cancel();
    window = null;
  });
  void window.loadFile(join(here, "index.html"));
}

function installIpc(): void {
  ipcMain.handle("nav:open-folder", async (event) => {
    if (!fromWindow(event) || !window) return null;
    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory"],
      defaultPath: loadPrefs().recentProjects[0]?.path,
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return openRoot(result.filePaths[0]);
  });

  ipcMain.handle("nav:open-path", (event, input: unknown): OpenResult => {
    if (!fromWindow(event) || typeof input !== "string") return { ok: false, reason: "That folder is not available." };
    return openRoot(input);
  });

  ipcMain.handle("nav:choose-intent", (event, input: unknown): Snapshot | null => {
    if (!fromWindow(event) || !projectRoot) return currentSnapshot();
    if (!input || typeof input !== "object") return currentSnapshot();
    const body = input as { space?: unknown; dirName?: unknown };
    if (typeof body.space !== "string" || typeof body.dirName !== "string") return currentSnapshot();
    const asking = readProjectWithSavedChoice(projectRoot, null);
    if (asking.kind !== "choose-intent") return asking;
    const allowed = asking.choices.some((choice) => choice.space === body.space && choice.dirName === body.dirName);
    if (!allowed) return asking;
    const selection = { space: body.space, dirName: body.dirName };
    rememberChoice(projectRoot, selection);
    return readProjectWithSavedChoice(projectRoot, selection);
  });

  ipcMain.handle("nav:snapshot", (event) => (fromWindow(event) ? currentSnapshot() : null));

  ipcMain.handle("nav:recents", (event): RecentProject[] => {
    if (!fromWindow(event)) return [];
    return liveRecents(loadPrefs().recentProjects, (path) => canonicalDir(path) !== null);
  });

  ipcMain.handle("nav:read-document", (event, file: unknown) => {
    if (!fromWindow(event) || typeof file !== "string") return null;
    const abs = listedDocument(file);
    if (!abs) return null;
    try {
      return readFileSync(abs, "utf8");
    } catch {
      return null;
    }
  });

  ipcMain.handle("nav:copy-path", (event, file: unknown) => {
    if (!fromWindow(event) || typeof file !== "string") return false;
    const abs = listedDocument(file);
    if (!abs) return false;
    clipboard.writeText(abs);
    return true;
  });

  ipcMain.handle("nav:settings", (event): SettingsView | null => (fromWindow(event) ? settingsView() : null));

  ipcMain.handle("nav:save-settings", (event, input: unknown): SettingsView => {
    if (!fromWindow(event) || !input || typeof input !== "object") return settingsView();
    const body = input as Partial<SettingsInput>;
    const prefs = loadPrefs();
    prefs.theme = themeChoice(body.theme);
    prefs.commandPath = commandOverride(body.commandPath);
    storePrefs(prefs);
    return settingsView();
  });
}

void app.whenReady().then(() => {
  installIpc();
  createWindow();
});

app.on("window-all-closed", () => {
  watcher?.close();
  app.quit();
});
