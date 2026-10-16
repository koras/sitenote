export const DEFAULT_COLOR = "#6658d3";
export const DEFAULT_TITLE = "Новая заметка";

// Убираем только стандартный www: другие поддомены считаются отдельными сайтами.
export function getSiteKey(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export function getStorageKey(site, id) {
  return `note:${encodeURIComponent(site)}:${id}`;
}

export function createNote(site, now = new Date().toISOString(), id = crypto.randomUUID()) {
  return {
    id,
    site,
    title: DEFAULT_TITLE,
    content: "",
    color: DEFAULT_COLOR,
    createdAt: now,
    updatedAt: now
  };
}

export function sortNotes(notes) {
  return [...notes].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
  );
}

export function getNoteActivity(note) {
  return note.updatedAt === note.createdAt
    ? { label: "Создана", timestamp: note.createdAt }
    : { label: "Изменена", timestamp: note.updatedAt };
}

export function hasNoteContent(content) {
  return content.trim().length > 0;
}
