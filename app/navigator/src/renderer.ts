import type { NavApi, OpenResult, SettingsView } from "./api";
import { renderMarkdown } from "./markdown";
import type { ThemeChoice } from "./preferences";
import type { Snapshot } from "./record";
import { actionDraftKey, retainDraft } from "./session";
import { commandMessage, present } from "./view";

declare global {
  interface Window {
    nav: NavApi;
  }
}

const nav = window.nav;

const appRoot = document.querySelector("#app");
if (!appRoot) throw new Error("Missing app root");

const header = document.createElement("header");
const title = document.createElement("h1");
title.textContent = "Navigator";
const openButton = document.createElement("button");
openButton.type = "button";
openButton.id = "open-folder";
openButton.textContent = "Open folder";
const settingsButton = document.createElement("button");
settingsButton.type = "button";
settingsButton.id = "open-settings";
settingsButton.className = "push";
settingsButton.textContent = "Settings";
header.append(title, openButton, settingsButton);

const layout = document.createElement("div");
layout.className = "layout";

const sidebar = document.createElement("aside");
const notice = document.createElement("p");
notice.id = "notice";
notice.className = "notice";
const recentsHeading = document.createElement("h2");
recentsHeading.textContent = "Recent";
const recents = document.createElement("div");
recents.className = "recents";
const headline = document.createElement("p");
headline.id = "headline";
const summary = document.createElement("dl");
summary.className = "summary";
const stagesHeading = document.createElement("h2");
stagesHeading.textContent = "Stages";
const stages = document.createElement("ul");
stages.className = "stages";
const documentsHeading = document.createElement("h2");
documentsHeading.textContent = "Documents";
const documents = document.createElement("div");
documents.className = "documents";
const choices = document.createElement("div");
choices.className = "choices";
sidebar.append(notice, recentsHeading, recents, headline, choices, summary, stagesHeading, stages, documentsHeading, documents);

const content = document.createElement("section");
content.className = "content";
const markdownPane = document.createElement("article");
markdownPane.className = "markdown";
const draftWrap = document.createElement("label");
draftWrap.className = "draft";
const draftLabel = document.createElement("span");
const draftBox = document.createElement("textarea");
draftBox.rows = 5;
draftWrap.append(draftLabel, draftBox);
const actions = document.createElement("div");
actions.className = "actions";
const nextButton = document.createElement("button");
nextButton.type = "button";
nextButton.className = "next-action";
nextButton.disabled = true;
const copyButton = document.createElement("button");
copyButton.type = "button";
copyButton.id = "copy-path";
copyButton.textContent = "Copy path";
actions.append(nextButton, copyButton);
content.append(markdownPane, draftWrap, actions);
layout.append(sidebar, content);

const settingsPanel = document.createElement("section");
settingsPanel.className = "settings";
settingsPanel.hidden = true;
const settingsTitle = document.createElement("h2");
settingsTitle.className = "settings-title";
settingsTitle.textContent = "Settings";
const appearance = document.createElement("fieldset");
const appearanceLegend = document.createElement("legend");
appearanceLegend.textContent = "Appearance";
appearance.append(appearanceLegend);
const themeInputs = new Map<ThemeChoice, HTMLInputElement>();
for (const choice of [
  ["system", "System"],
  ["light", "Light"],
  ["dark", "Dark"],
] as const) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "theme";
  input.value = choice[0];
  if (choice[0] === "system") input.checked = true;
  themeInputs.set(choice[0], input);
  label.append(input, document.createTextNode(choice[1]));
  appearance.append(label);
  input.addEventListener("change", () => {
    if (input.checked) void persist({ theme: choice[0] });
  });
}
const commandField = document.createElement("fieldset");
const commandLegend = document.createElement("legend");
commandLegend.textContent = "Workflow command";
const commandHint = document.createElement("p");
commandHint.textContent = "Leave this empty to look the command up. Paste a path when that lookup is wrong.";
const commandInput = document.createElement("input");
commandInput.type = "text";
commandInput.spellcheck = false;
commandInput.autocomplete = "off";
const commandStatus = document.createElement("p");
commandStatus.className = "command-status";
commandField.append(commandLegend, commandHint, commandInput, commandStatus);
const backButton = document.createElement("button");
backButton.type = "button";
backButton.textContent = "Back";
settingsPanel.append(settingsTitle, appearance, commandField, backButton);
appRoot.append(header, layout, settingsPanel);

let currentSettings: SettingsView | null = null;

function paintSettings(view: SettingsView): void {
  currentSettings = view;
  document.documentElement.dataset.theme = view.theme;
  for (const [value, input] of themeInputs) input.checked = value === view.theme;
  if (document.activeElement !== commandInput) commandInput.value = view.commandPath;
  commandStatus.textContent = commandMessage(view.commandPath, view.resolvedPath);
}

async function persist(patch: { theme?: ThemeChoice; commandPath?: string }): Promise<void> {
  const theme = patch.theme ?? currentSettings?.theme ?? "system";
  const commandPath = patch.commandPath ?? commandInput.value;
  paintSettings(await nav.saveSettings({ theme, commandPath }));
}

settingsButton.addEventListener("click", () => {
  settingsPanel.hidden = false;
  layout.hidden = true;
});
backButton.addEventListener("click", () => {
  settingsPanel.hidden = true;
  layout.hidden = false;
});
commandInput.addEventListener("change", () => {
  void persist({ commandPath: commandInput.value });
});

let snapshot: Snapshot | null = null;
let openFile: string | null = null;
let draftKey: string | null = null;
let draftText = "";
let paintGen = 0;

draftBox.addEventListener("input", () => {
  draftText = draftBox.value;
});

openButton.addEventListener("click", () => {
  void openResult(nav.openFolder());
});

copyButton.addEventListener("click", () => {
  if (!openFile) return;
  void nav.copyPath(openFile).then((copied) => {
    copyButton.textContent = copied ? "Copied" : "Copy path";
    window.setTimeout(() => {
      copyButton.textContent = "Copy path";
    }, 1200);
  });
});

nav.onRefresh((next) => {
  void paint(next);
});

async function openResult(pending: Promise<OpenResult | null>): Promise<void> {
  const result = await pending;
  if (result === null) return;
  if (!result.ok) {
    notice.textContent = result.reason;
    return;
  }
  notice.textContent = "";
  await paint(result.snapshot);
  await loadRecents();
}

async function loadRecents(): Promise<void> {
  const rows = await nav.recents();
  recentsHeading.hidden = rows.length === 0;
  recents.replaceChildren();
  for (const row of rows) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent";
    button.textContent = row.path;
    button.title = row.path;
    button.addEventListener("click", () => {
      void openResult(nav.openPath(row.path));
    });
    recents.append(button);
  }
}

async function paint(next: Snapshot | null): Promise<void> {
  const gen = ++paintGen;
  const nextKey = next?.kind === "intent" ? actionDraftKey(next.nextAction) : null;
  draftText = retainDraft(draftKey, draftText, nextKey);
  draftKey = nextKey;
  snapshot = next;
  const view = present(snapshot, openFile);
  openFile = view.openFile;

  headline.textContent = view.headline;
  choices.replaceChildren();
  for (const choice of view.choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = choice.label;
    button.addEventListener("click", () => {
      void nav.chooseIntent({ space: choice.space, dirName: choice.dirName }).then((picked) => {
        if (picked) void paint(picked);
      });
    });
    choices.append(button);
  }

  summary.replaceChildren();
  for (const row of view.summary) {
    const term = document.createElement("dt");
    term.textContent = row.label;
    const value = document.createElement("dd");
    value.textContent = row.value;
    summary.append(term, value);
  }

  stages.replaceChildren();
  for (const stage of view.stages) {
    const item = document.createElement("li");
    item.textContent = `${stage.slug} — ${stage.label}`;
    stages.append(item);
  }
  stagesHeading.hidden = view.stages.length === 0;
  documentsHeading.hidden = view.documents.length === 0;

  documents.replaceChildren();
  for (const doc of view.documents) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = doc.name;
    button.title = doc.file;
    if (doc.open) button.setAttribute("aria-current", "true");
    button.addEventListener("click", () => {
      openFile = doc.file;
      void paint(snapshot);
    });
    documents.append(button);
  }
  nextButton.hidden = view.nextLabel === null;
  nextButton.textContent = view.nextLabel ?? "";
  nextButton.disabled = true;
  copyButton.hidden = openFile === null;
  draftWrap.hidden = view.draftLabel === null;
  if (view.draftLabel) draftLabel.textContent = view.draftLabel;
  if (draftBox.value !== draftText) draftBox.value = draftText;

  if (!openFile) {
    markdownPane.replaceChildren();
    if (view.documents.length === 0 && snapshot?.kind === "intent") {
      markdownPane.textContent = "This stage has no documents.";
    }
    return;
  }
  const text = await nav.readDocument(openFile);
  if (gen !== paintGen) return;
  markdownPane.innerHTML = text ? renderMarkdown(text) : "";
  if (!text) markdownPane.textContent = "The document could not be read.";
}

void nav.settings().then(async (view) => {
  if (view) paintSettings(view);
  await paint(await nav.snapshot());
  await loadRecents();
});
