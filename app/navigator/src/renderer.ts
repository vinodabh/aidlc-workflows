import type { NavApi, OpenResult } from "./api";
import { renderMarkdown } from "./markdown";
import type { Snapshot } from "./record";
import { actionDraftKey, retainDraft } from "./session";
import { present } from "./view";

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
header.append(title, openButton);

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
appRoot.append(header, layout);

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

void paint(await nav.snapshot()).then(() => loadRecents());
