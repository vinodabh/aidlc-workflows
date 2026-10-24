import type { RecentProject, ThemeChoice } from "./preferences";
import type { IntentSelection, Snapshot } from "./record";

export interface SettingsView {
  theme: ThemeChoice;
  commandPath: string;
  resolvedPath: string | null;
}

export interface SettingsInput {
  theme: ThemeChoice;
  commandPath: string;
}

export type OpenResult =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; reason: string };

export interface NavApi {
  openFolder(): Promise<OpenResult | null>;
  openPath(path: string): Promise<OpenResult>;
  chooseIntent(selection: IntentSelection): Promise<Snapshot | null>;
  snapshot(): Promise<Snapshot | null>;
  recents(): Promise<RecentProject[]>;
  readDocument(file: string): Promise<string | null>;
  copyPath(file: string): Promise<boolean>;
  settings(): Promise<SettingsView | null>;
  saveSettings(input: SettingsInput): Promise<SettingsView>;
  onRefresh(listener: (snapshot: Snapshot) => void): () => void;
}
