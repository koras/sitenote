import { createNote, getSiteKey, getStorageKey, sortNotes, DEFAULT_TITLE } from "./notes.mjs";

const elements = {
  siteName: document.querySelector("#site-name"),
  workspace: document.querySelector("#workspace"),
  unsupported: document.querySelector("#unsupported"),
  emptyNote: document.querySelector("#empty-note"),
  noteEditor: document.querySelector("#note-editor"),
  noteList: document.querySelector("#note-list"),
  newNote: document.querySelector("#new-note"),
  title: document.querySelector("#note-title"),
  color: document.querySelector("#note-color"),
  content: document.querySelector("#note-content"),
  deleteNote: document.querySelector("#delete-note"),
  createdAt: document.querySelector("#created-at"),
  updatedAt: document.querySelector("#updated-at"),
  toast: document.querySelector("#toast")
};

let currentSite = null;
let currentTabId = null;
let notes = [];
let selectedId = null;
let contextRevision = 0;
let toastTimer = null;
const pendingWrites = new Map();
const writeQueues = new Map();
const selectedBySite = new Map();
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 3200);
}

function formatDate(iso) {
  return dateFormatter.format(new Date(iso));
}

function getSelectedNote() {
  return notes.find((note) => note.id === selectedId) ?? null;
}

function readableTextColor(hex) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const brightness = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return brightness[0] * 0.2126 + brightness[1] * 0.7152 + brightness[2] * 0.0722 > 0.42
    ? "#252535" : "#ffffff";
}

function renderList() {
  elements.noteList.replaceChildren();
  notes = sortNotes(notes);

  for (const note of notes) {
    const row = document.createElement("div");
    row.className = "note-row";

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = `note-button${note.id === selectedId ? " selected" : ""}`;
    selectButton.textContent = note.title.trim() || "Без названия";
    selectButton.style.backgroundColor = note.color;
    selectButton.style.color = readableTextColor(note.color);
    selectButton.title = `${note.title.trim() || "Без названия"}\nИзменена: ${formatDate(note.updatedAt)}`;
    selectButton.setAttribute("aria-pressed", String(note.id === selectedId));
    selectButton.addEventListener("click", () => {
      selectedId = note.id;
      selectedBySite.set(currentSite, note.id);
      render();
    });

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "copy-button";
    copyButton.textContent = "⧉";
    copyButton.title = "Скопировать текст заметки";
    copyButton.setAttribute("aria-label", `Скопировать заметку «${note.title.trim() || "Без названия"}»`);
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(note.content);
        showToast("Текст заметки скопирован");
      } catch {
        showToast("Не удалось скопировать текст");
      }
    });

    row.append(selectButton, copyButton);
    elements.noteList.append(row);
  }
}

function renderEditor() {
  const note = getSelectedNote();
  elements.emptyNote.hidden = Boolean(note);
  elements.noteEditor.hidden = !note;
  if (!note) return;

  elements.title.value = note.title;
  elements.color.value = note.color;
  elements.content.value = note.content;
  elements.createdAt.dateTime = note.createdAt;
  elements.createdAt.textContent = formatDate(note.createdAt);
  elements.updatedAt.dateTime = note.updatedAt;
  elements.updatedAt.textContent = formatDate(note.updatedAt);
}

function render() {
  elements.siteName.textContent = currentSite ?? "Сайт не поддерживается";
  elements.siteName.title = currentSite ?? "";
  elements.workspace.hidden = !currentSite;
  elements.unsupported.hidden = Boolean(currentSite);
  if (!currentSite) return;
  renderList();
  renderEditor();
}

// Записи для разных заметок идут независимо; записи одной заметки сохраняют порядок.
function persistNote(note) {
  const key = getStorageKey(note.site, note.id);
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => chrome.storage.local.set({ [key]: note }));
  writeQueues.set(key, next);
  next.then(
    () => { if (writeQueues.get(key) === next) writeQueues.delete(key); },
    () => { if (writeQueues.get(key) === next) writeQueues.delete(key); }
  );
  return next;
}

function scheduleSave(note) {
  const key = getStorageKey(note.site, note.id);
  const existing = pendingWrites.get(key);
  if (existing) clearTimeout(existing.timer);
  const snapshot = { ...note };
  const timer = setTimeout(() => {
    pendingWrites.delete(key);
    persistNote(snapshot).catch(() => showToast("Не удалось сохранить заметку"));
  }, 350);
  pendingWrites.set(key, { note: snapshot, timer });
}

async function flushPending() {
  const writes = [];
  for (const [key, pending] of pendingWrites) {
    clearTimeout(pending.timer);
    pendingWrites.delete(key);
    writes.push(persistNote(pending.note));
  }
  await Promise.all(writes);
}

function updateSelected(field, value) {
  const note = getSelectedNote();
  if (!note || note[field] === value) return;
  note[field] = value;
  note.updatedAt = new Date().toISOString();
  elements.updatedAt.dateTime = note.updatedAt;
  elements.updatedAt.textContent = formatDate(note.updatedAt);
  renderList();
  scheduleSave(note);
}

async function refreshContext() {
  const revision = ++contextRevision;
  try {
    await flushPending();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (revision !== contextRevision) return;
    const site = getSiteKey(tab?.url);
    currentTabId = tab?.id ?? null;
    if (site === currentSite) return;

    if (!site) {
      currentSite = null;
      notes = [];
      selectedId = null;
      render();
      return;
    }

    const stored = await chrome.storage.local.get(null);
    if (revision !== contextRevision) return;
    const prefix = `note:${encodeURIComponent(site)}:`;
    notes = Object.entries(stored)
      .filter(([key, value]) => key.startsWith(prefix) && value?.site === site && value?.id)
      .map(([, value]) => value);
    currentSite = site;
    const preferred = selectedBySite.get(site);
    selectedId = notes.some((note) => note.id === preferred) ? preferred : sortNotes(notes)[0]?.id ?? null;
    render();
  } catch (error) {
    console.error("Не удалось загрузить заметки:", error);
    showToast("Не удалось загрузить или сохранить заметки");
  }
}

elements.newNote.addEventListener("click", async () => {
  if (!currentSite) return;
  const note = createNote(currentSite);
  try {
    await persistNote(note);
    notes.push(note);
    selectedId = note.id;
    selectedBySite.set(currentSite, note.id);
    render();
    elements.title.focus();
    elements.title.select();
  } catch (error) {
    console.error("Не удалось создать заметку:", error);
    showToast("Не удалось создать заметку");
  }
});

elements.title.addEventListener("input", () => updateSelected("title", elements.title.value));
elements.title.addEventListener("blur", () => {
  if (!elements.title.value.trim()) {
    elements.title.value = DEFAULT_TITLE;
    updateSelected("title", DEFAULT_TITLE);
  }
});
elements.color.addEventListener("input", () => updateSelected("color", elements.color.value));
elements.content.addEventListener("input", () => updateSelected("content", elements.content.value));

elements.deleteNote.addEventListener("click", async () => {
  const note = getSelectedNote();
  if (!note || !confirm(`Удалить заметку «${note.title.trim() || "Без названия"}»?`)) return;
  const key = getStorageKey(note.site, note.id);
  const pending = pendingWrites.get(key);
  if (pending) {
    clearTimeout(pending.timer);
    pendingWrites.delete(key);
  }
  try {
    await (writeQueues.get(key) ?? Promise.resolve()).catch(() => {});
    await chrome.storage.local.remove(key);
    notes = notes.filter((item) => item.id !== note.id);
    selectedId = sortNotes(notes)[0]?.id ?? null;
    if (selectedId) selectedBySite.set(currentSite, selectedId);
    else selectedBySite.delete(currentSite);
    render();
    showToast("Заметка удалена");
  } catch (error) {
    console.error("Не удалось удалить заметку:", error);
    showToast("Не удалось удалить заметку");
  }
});

chrome.tabs.onActivated.addListener(() => { refreshContext(); });
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === currentTabId && (changeInfo.url || changeInfo.status === "complete")) refreshContext();
});
chrome.tabs.onRemoved.addListener((tabId) => { if (tabId === currentTabId) refreshContext(); });
chrome.windows.onFocusChanged.addListener(() => { refreshContext(); });
window.addEventListener("pagehide", () => { flushPending().catch(console.error); });
refreshContext();
