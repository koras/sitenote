import { createNote, getNoteActivity, getSiteKey, getStorageKey, hasNoteContent, sortNotes, DEFAULT_COLOR, DEFAULT_TITLE } from "./notes.mjs";

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
  timestamps: document.querySelector("#timestamps"),
  createdAt: document.querySelector("#created-at"),
  updatedAt: document.querySelector("#updated-at"),
  saveStatus: document.querySelector("#save-status"),
  saveNote: document.querySelector("#save-note"),
  cancelNote: document.querySelector("#cancel-note"),
  toast: document.querySelector("#toast")
};

let currentSite = null;
let currentTabId = null;
let notes = [];
let selectedId = null;
let draft = null;
let saving = false;
let contextRevision = 0;
let toastTimer = null;
const draftsBySite = new Map();
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

function hasDraftChanges() {
  if (!draft) return false;
  const saved = draft.id ? notes.find((note) => note.id === draft.id) : null;
  if (!saved) {
    return draft.title !== DEFAULT_TITLE || draft.color !== DEFAULT_COLOR || draft.content !== "";
  }
  return draft.title !== saved.title || draft.color !== saved.color || draft.content !== saved.content;
}

function canDiscardDraft() {
  return !hasDraftChanges() || confirm("Есть несохранённые изменения. Закрыть без сохранения?");
}

function updateSaveStatus() {
  elements.saveStatus.textContent = draft?.id && !hasDraftChanges()
    ? "Изменения сохранены" : "Не сохранено";
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
    const activity = getNoteActivity(note);
    selectButton.title = `${note.title.trim() || "Без названия"}\n${activity.label}: ${formatDate(activity.timestamp)}`;
    selectButton.setAttribute("aria-pressed", String(note.id === selectedId));
    selectButton.addEventListener("click", () => {
      if (saving || draft?.id === note.id || !canDiscardDraft()) return;
      draft = { ...note };
      selectedId = note.id;
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

    const date = document.createElement("time");
    date.className = "note-date";
    date.dateTime = activity.timestamp;
    date.textContent = `${activity.label}: ${formatDate(activity.timestamp)}`;

    row.append(selectButton, copyButton, date);
    elements.noteList.append(row);
  }
}

function renderEditor() {
  const note = draft;
  elements.emptyNote.hidden = Boolean(note);
  elements.noteEditor.hidden = !note;
  if (!note) return;

  elements.title.value = note.title;
  elements.color.value = note.color;
  elements.content.value = note.content;
  elements.timestamps.hidden = !note.id;
  elements.deleteNote.hidden = !note.id;
  if (note.id) {
    elements.createdAt.dateTime = note.createdAt;
    elements.createdAt.textContent = formatDate(note.createdAt);
    elements.updatedAt.dateTime = note.updatedAt;
    elements.updatedAt.textContent = formatDate(note.updatedAt);
  }
  updateSaveStatus();
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

function updateDraft(field, value) {
  if (!draft) return;
  draft[field] = value;
  updateSaveStatus();
}

async function refreshContext() {
  const revision = ++contextRevision;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (revision !== contextRevision) return;
    const site = getSiteKey(tab?.url);
    currentTabId = tab?.id ?? null;
    if (site === currentSite) return;
    // Черновик остаётся в памяти панели, пока пользователь не сохранит или не отменит его.
    if (currentSite && draft) draftsBySite.set(currentSite, draft);

    if (!site) {
      currentSite = null;
      notes = [];
      selectedId = null;
      draft = null;
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
    draft = draftsBySite.get(site) ?? null;
    selectedId = draft?.id ?? null;
    render();
  } catch (error) {
    console.error("Не удалось загрузить заметки:", error);
    showToast("Не удалось загрузить или сохранить заметки");
  }
}

elements.newNote.addEventListener("click", () => {
  if (!currentSite || saving || !canDiscardDraft()) return;
  draft = {
    id: null, site: currentSite, title: DEFAULT_TITLE,
    content: "", color: DEFAULT_COLOR, createdAt: null, updatedAt: null
  };
  selectedId = null;
  render();
  elements.title.focus();
  elements.title.select();
});

elements.title.addEventListener("input", () => updateDraft("title", elements.title.value));
elements.title.addEventListener("blur", () => {
  if (!elements.title.value.trim()) {
    elements.title.value = DEFAULT_TITLE;
    updateDraft("title", DEFAULT_TITLE);
  }
});
elements.color.addEventListener("input", () => updateDraft("color", elements.color.value));
elements.content.addEventListener("input", () => updateDraft("content", elements.content.value));

elements.saveNote.addEventListener("click", async () => {
  if (!draft || saving) return;
  if (!hasNoteContent(draft.content)) {
    showToast("Добавьте текст заметки перед сохранением");
    elements.content.focus();
    return;
  }
  if (draft.id && !hasDraftChanges()) {
    showToast("Изменений нет");
    return;
  }

  // Время создания фиксируется только при первом сохранении, а не при открытии формы.
  const now = new Date().toISOString();
  const note = draft.id
    ? { ...draft, title: draft.title.trim() || DEFAULT_TITLE, updatedAt: now }
    : { ...createNote(draft.site, now), title: draft.title.trim() || DEFAULT_TITLE,
        content: draft.content, color: draft.color };
  saving = true;
  elements.saveNote.disabled = true;
  elements.title.disabled = true;
  elements.color.disabled = true;
  elements.content.disabled = true;
  try {
    await chrome.storage.local.set({ [getStorageKey(note.site, note.id)]: note });
    draftsBySite.delete(note.site);
    if (currentSite === note.site) {
      notes = notes.filter((item) => item.id !== note.id);
      notes.push(note);
      draft = { ...note };
      selectedId = note.id;
      render();
    }
    showToast("Заметка сохранена");
  } catch (error) {
    console.error("Не удалось сохранить заметку:", error);
    showToast("Не удалось сохранить заметку");
  } finally {
    saving = false;
    elements.saveNote.disabled = false;
    elements.title.disabled = false;
    elements.color.disabled = false;
    elements.content.disabled = false;
  }
});

elements.cancelNote.addEventListener("click", () => {
  if (saving || !canDiscardDraft()) return;
  draftsBySite.delete(currentSite);
  draft = null;
  selectedId = null;
  render();
});

elements.deleteNote.addEventListener("click", async () => {
  const note = draft;
  if (saving) return;
  if (!note?.id || !confirm(`Удалить заметку «${note.title.trim() || "Без названия"}»?`)) return;
  const key = getStorageKey(note.site, note.id);
  try {
    await chrome.storage.local.remove(key);
    draftsBySite.delete(note.site);
    if (currentSite === note.site) {
      notes = notes.filter((item) => item.id !== note.id);
      selectedId = null;
      draft = null;
      render();
    }
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
refreshContext();
