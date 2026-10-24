import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { NavApi } from "./api";
import type { IntentSelection, Snapshot } from "./record";

const api: NavApi = {
  openFolder: () => ipcRenderer.invoke("nav:open-folder"),
  openPath: (path: string) => ipcRenderer.invoke("nav:open-path", path),
  chooseIntent: (selection: IntentSelection) => ipcRenderer.invoke("nav:choose-intent", selection),
  snapshot: () => ipcRenderer.invoke("nav:snapshot"),
  recents: () => ipcRenderer.invoke("nav:recents"),
  readDocument: (file: string) => ipcRenderer.invoke("nav:read-document", file),
  copyPath: (file: string) => ipcRenderer.invoke("nav:copy-path", file),
  onRefresh: (listener: (snapshot: Snapshot) => void) => {
    const wrapped = (_event: IpcRendererEvent, snapshot: Snapshot) => listener(snapshot);
    ipcRenderer.on("nav:refreshed", wrapped);
    return () => {
      ipcRenderer.removeListener("nav:refreshed", wrapped);
    };
  },
};

contextBridge.exposeInMainWorld("nav", api);
