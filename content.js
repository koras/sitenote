(() => {
  // Интерфейс нужен только в основной странице, а не в её встроенных фреймах.
  if (window.top !== window || !document.documentElement) return;

  const {
    DEFAULT_COLOR, DEFAULT_TITLE, getSiteKey, getStorageKey,
    createNote, sortNotes, getNoteActivity, hasNoteContent
  } = globalThis.SiteNotesCore;
  const site = getSiteKey(location.href);
  if (!site) return;

  const host = document.createElement("div");
  host.setAttribute("data-sitenote-extension", "");
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; position: fixed !important; z-index: 2147483647 !important;
      top: 50% !important; right: 12px !important; transform: translateY(-50%) !important;
      width: 186px !important; pointer-events: none !important;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif !important;
      color: #28263a !important; }
    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }
    button, input, textarea { font: inherit; }
    button { cursor: pointer; }
    button:focus-visible, input:focus-visible, textarea:focus-visible {
      outline: 2px solid #6658d3; outline-offset: 2px; }
    .rail, .editor, .toast { pointer-events: auto; }
    .rail { width: 100%; max-height: 78vh; overflow-y: auto; padding: 10px; border: 1px solid #e2e0ed;
      border-radius: 13px; background: #fff; box-shadow: 0 8px 30px #1f1c3440; }
    .rail-head { display: flex; align-items: center; justify-content: space-between; gap: 5px; margin-bottom: 9px; }
    .rail-title { font-size: 12px; font-weight: 750; color: #302d44; }
    .new-button { border: 0; border-radius: 7px; background: #6658d3; color: #fff;
      padding: 6px 7px; font-size: 11px; font-weight: 650; white-space: nowrap; }
    .new-button:hover, .save-button:hover { background: #5547bd; }
    .note-list { display: flex; flex-direction: column; gap: 8px; }
    .note-row { display: grid; grid-template-columns: minmax(0, 1fr) 27px; gap: 4px; }
    .note-button { min-width: 0; min-height: 34px; border: 2px solid transparent; border-radius: 8px;
      padding: 5px; font-size: 11px; font-weight: 650; text-align: left; overflow-wrap: anywhere; }
    .note-button.selected { border-color: #27233d; box-shadow: 0 0 0 1px #fff inset; }
    .copy-button { width: 27px; min-height: 34px; border: 1px solid #dedce9; border-radius: 7px;
      background: #fff; color: #5a566e; font-size: 16px; }
    .copy-button:hover { background: #f1efff; }
    .note-date { grid-column: 1 / -1; padding: 0 2px; color: #777487; font-size: 10px; line-height: 1.25; }
    .empty-list { margin: 3px 2px; color: #777487; font-size: 11px; line-height: 1.4; }
    .editor { position: absolute; right: calc(100% + 10px); top: 50%; transform: translateY(-50%);
      width: min(360px, calc(100vw - 220px)); max-height: 82vh; overflow-y: auto; padding: 17px;
      border: 1px solid #e2e0ed; border-radius: 13px; background: #fff;
      box-shadow: 0 10px 35px #1f1c3440; }
    .editor-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .editor-heading { margin: 0; font-size: 15px; font-weight: 750; }
    .close-button { width: 27px; height: 27px; border: 0; border-radius: 6px;
      background: #f0eef6; color: #4e4b61; font-size: 17px; }
    .field-label { display: block; margin: 0 0 6px; font-size: 11px; font-weight: 650; }
    .title-input, .content-input { display: block; width: 100%; border: 1px solid #dcdbe7;
      border-radius: 8px; background: #fff; color: #252535; }
    .title-input { margin-bottom: 14px; padding: 8px 9px; font-size: 13px; font-weight: 600; }
    .content-input { min-height: 175px; resize: vertical; padding: 9px; font-size: 12px; line-height: 1.5; }
    .editor-tools { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 16px; }
    .color-control { display: flex; align-items: center; gap: 6px; color: #686579; font-size: 11px; }
    .color-input { width: 32px; height: 27px; padding: 2px; border: 1px solid #dcdbe7;
      border-radius: 6px; background: #fff; cursor: pointer; }
    .delete-button { border: 0; background: transparent; color: #a33c52; padding: 3px; font-size: 11px; }
    .delete-button:hover { text-decoration: underline; }
    .timestamps { display: grid; gap: 3px; margin-top: 10px; color: #777487; font-size: 10px; }
    .save-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 8px; margin-top: 14px; }
    .save-status { color: #777487; font-size: 10px; }
    .save-actions { display: flex; gap: 6px; margin-left: auto; }
    .cancel-button, .save-button { border: 0; border-radius: 7px; padding: 7px 9px; font-size: 11px; font-weight: 650; }
    .cancel-button { background: #eae9f0; color: #4e4b61; }
    .save-button { background: #6658d3; color: #fff; }
    .save-button:disabled { opacity: .6; cursor: wait; }
    .toast { position: absolute; bottom: calc(100% + 8px); right: 0; width: max-content;
      max-width: 280px; padding: 8px 10px; border-radius: 8px; background: #29263c;
      color: #fff; box-shadow: 0 5px 20px #1f1c3440; font-size: 11px; }
    @media (max-width: 600px) {
      :host { right: 8px !important; width: 145px !important; }
      .editor { right: 0; width: calc(100vw - 16px); }
    }
  `;

  const ui = document.createElement("div");
  ui.innerHTML = `
    <div class="rail" aria-label="Заметки сайта">
      <div class="rail-head">
        <span class="rail-title">✦ Заметки</span>
        <button id="new-note" class="new-button" type="button">+ Новая</button>
      </div>
      <div id="note-list" class="note-list"><p class="empty-list">Загрузка…</p></div>
    </div>
    <section id="editor" class="editor" aria-label="Редактор заметки" hidden>
      <div class="editor-head">
        <h2 id="editor-heading" class="editor-heading">Заметка</h2>
        <button id="close-editor" class="close-button" type="button" aria-label="Закрыть">×</button>
      </div>
      <label class="field-label" for="note-title">Название</label>
      <input id="note-title" class="title-input" type="text" maxlength="120" autocomplete="off">
      <div class="editor-tools">
        <label class="color-control" for="note-color">Цвет кнопки
          <input id="note-color" class="color-input" type="color" aria-label="Цвет кнопки заметки">
        </label>
        <button id="delete-note" class="delete-button" type="button">Удалить</button>
      </div>
      <label class="field-label" for="note-content">Текст заметки</label>
      <textarea id="note-content" class="content-input" spellcheck="true"
        placeholder="Запишите здесь нужную информацию…"></textarea>
      <div id="timestamps" class="timestamps">
        <div>Создана: <time id="created-at"></time></div>
        <div>Изменена: <time id="updated-at"></time></div>
      </div>
      <div class="save-bar">
        <span id="save-status" class="save-status" role="status"></span>
        <div class="save-actions">
          <button id="cancel-note" class="cancel-button" type="button">Отмена</button>
          <button id="save-note" class="save-button" type="button">Сохранить</button>
        </div>
      </div>
    </section>
    <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  `;
  shadow.append(style, ui);
  document.documentElement.append(host);

  const $ = (selector) => shadow.querySelector(selector);
  const elements = {
    list: $("#note-list"), newNote: $("#new-note"), editor: $("#editor"),
    heading: $("#editor-heading"), close: $("#close-editor"),
    title: $("#note-title"), color: $("#note-color"), content: $("#note-content"),
    deleteNote: $("#delete-note"), timestamps: $("#timestamps"),
    createdAt: $("#created-at"), updatedAt: $("#updated-at"),
    saveStatus: $("#save-status"), saveNote: $("#save-note"),
    cancelNote: $("#cancel-note"), toast: $("#toast")
  };
  const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });
  const keyPrefix = `note:${encodeURIComponent(site)}:`;
  let notes = [];
  let draft = null;
  let saving = false;
  let toastTimer = null;
  elements.newNote.disabled = true;

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 3200);
  }

  function hasDraftChanges() {
    if (!draft) return false;
    const saved = draft.id ? notes.find((note) => note.id === draft.id) : null;
    if (!saved) return draft.title !== DEFAULT_TITLE || draft.color !== DEFAULT_COLOR || draft.content !== "";
    return draft.title !== saved.title || draft.color !== saved.color || draft.content !== saved.content;
  }

  function canDiscardDraft() {
    return !hasDraftChanges() || confirm("Есть несохранённые изменения. Закрыть без сохранения?");
  }

  function readableTextColor(hex) {
    const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const brightness = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );
    return brightness[0] * 0.2126 + brightness[1] * 0.7152 + brightness[2] * 0.0722 > 0.42
      ? "#252535" : "#ffffff";
  }

  async function copyText(text) {
    // Синхронное копирование сохраняет пользовательский жест и работает на HTTP.
    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    shadow.append(input);
    input.focus();
    input.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      // Некоторые сайты отключают устаревший способ копирования.
    } finally {
      input.remove();
    }
    if (copied) return true;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  }

  function renderList() {
    elements.list.replaceChildren();
    notes = sortNotes(notes);
    if (!notes.length) {
      const empty = document.createElement("p");
      empty.className = "empty-list";
      empty.textContent = "Пока нет заметок";
      elements.list.append(empty);
      return;
    }
    for (const note of notes) {
      const row = document.createElement("div");
      row.className = "note-row";
      const select = document.createElement("button");
      select.type = "button";
      select.className = `note-button${draft?.id === note.id ? " selected" : ""}`;
      select.textContent = note.title.trim() || "Без названия";
      select.style.backgroundColor = note.color;
      select.style.color = readableTextColor(note.color);
      select.setAttribute("aria-pressed", String(draft?.id === note.id));
      select.addEventListener("click", () => {
        if (saving || draft?.id === note.id || !canDiscardDraft()) return;
        draft = { ...note };
        render();
      });

      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "copy-button";
      copy.textContent = "⧉";
      copy.title = "Скопировать текст заметки";
      copy.setAttribute("aria-label", `Скопировать заметку «${note.title.trim() || "Без названия"}»`);
      copy.addEventListener("click", async () => {
        try {
          showToast(await copyText(note.content) ? "Текст заметки скопирован" : "Не удалось скопировать текст");
        } catch {
          showToast("Не удалось скопировать текст");
        }
      });

      const activity = getNoteActivity(note);
      const date = document.createElement("time");
      date.className = "note-date";
      date.dateTime = activity.timestamp;
      date.textContent = `${activity.label}: ${dateFormatter.format(new Date(activity.timestamp))}`;
      row.append(select, copy, date);
      elements.list.append(row);
    }
  }

  function updateSaveStatus() {
    elements.saveStatus.textContent = draft?.id && !hasDraftChanges()
      ? "Изменения сохранены" : "Не сохранено";
  }

  function renderEditor() {
    elements.editor.hidden = !draft;
    if (!draft) return;
    elements.heading.textContent = draft.id ? "Редактировать заметку" : "Новая заметка";
    elements.title.value = draft.title;
    elements.color.value = draft.color;
    elements.content.value = draft.content;
    elements.deleteNote.hidden = !draft.id;
    elements.timestamps.hidden = !draft.id;
    if (draft.id) {
      elements.createdAt.dateTime = draft.createdAt;
      elements.createdAt.textContent = dateFormatter.format(new Date(draft.createdAt));
      elements.updatedAt.dateTime = draft.updatedAt;
      elements.updatedAt.textContent = dateFormatter.format(new Date(draft.updatedAt));
    }
    updateSaveStatus();
  }

  function render() {
    renderList();
    renderEditor();
  }

  function updateDraft(field, value) {
    if (!draft) return;
    draft[field] = value;
    updateSaveStatus();
  }

  elements.newNote.addEventListener("click", () => {
    if (saving || !canDiscardDraft()) return;
    draft = { id: null, site, title: DEFAULT_TITLE, content: "", color: DEFAULT_COLOR,
      createdAt: null, updatedAt: null };
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

  function closeEditor() {
    if (saving || !canDiscardDraft()) return;
    draft = null;
    render();
  }
  elements.close.addEventListener("click", closeEditor);
  elements.cancelNote.addEventListener("click", closeEditor);
  shadow.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && draft) closeEditor();
    event.stopPropagation();
  });
  shadow.addEventListener("click", (event) => event.stopPropagation());

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
    const now = new Date().toISOString();
    const note = draft.id
      ? { ...draft, title: draft.title.trim() || DEFAULT_TITLE, updatedAt: now }
      : { ...createNote(site, now), title: draft.title.trim() || DEFAULT_TITLE,
          content: draft.content, color: draft.color };
    saving = true;
    for (const field of [elements.title, elements.color, elements.content, elements.saveNote]) field.disabled = true;
    try {
      await chrome.storage.local.set({ [getStorageKey(site, note.id)]: note });
      notes = notes.filter((item) => item.id !== note.id);
      notes.push(note);
      draft = { ...note };
      render();
      showToast("Заметка сохранена");
    } catch (error) {
      console.error("Не удалось сохранить заметку:", error);
      showToast("Не удалось сохранить заметку");
    } finally {
      saving = false;
      for (const field of [elements.title, elements.color, elements.content, elements.saveNote]) field.disabled = false;
    }
  });

  elements.deleteNote.addEventListener("click", async () => {
    if (saving || !draft?.id || !confirm(`Удалить заметку «${draft.title.trim() || "Без названия"}»?`)) return;
    const note = draft;
    saving = true;
    elements.deleteNote.disabled = true;
    try {
      await chrome.storage.local.remove(getStorageKey(site, note.id));
      notes = notes.filter((item) => item.id !== note.id);
      draft = null;
      render();
      showToast("Заметка удалена");
    } catch (error) {
      console.error("Не удалось удалить заметку:", error);
      showToast("Не удалось удалить заметку");
    } finally {
      saving = false;
      elements.deleteNote.disabled = false;
    }
  });

  // Список обновляется и после изменений в других вкладках того же сайта.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let changed = false;
    for (const [key, change] of Object.entries(changes)) {
      if (!key.startsWith(keyPrefix)) continue;
      const id = key.slice(keyPrefix.length);
      notes = notes.filter((note) => note.id !== id);
      if (change.newValue?.site === site) notes.push(change.newValue);
      changed = true;
    }
    if (changed) renderList();
  });

  chrome.storage.local.get(null).then((stored) => {
    notes = Object.entries(stored)
      .filter(([key, value]) => key.startsWith(keyPrefix) && value?.site === site && value?.id)
      .map(([, value]) => value);
    elements.newNote.disabled = false;
    render();
  }).catch((error) => {
    console.error("Не удалось загрузить заметки:", error);
    showToast("Не удалось загрузить заметки");
  });
})();
