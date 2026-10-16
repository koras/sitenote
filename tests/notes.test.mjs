import test from "node:test";
import assert from "node:assert/strict";
import { createNote, getNoteActivity, getSiteKey, getStorageKey, hasNoteContent, sortNotes } from "../notes.mjs";

test("страницы, протоколы, порты и www одного сайта используют один ключ", () => {
  for (const url of [
    "https://example.com/one",
    "http://example.com:8080/two?q=1",
    "https://www.example.com/three"
  ]) {
    assert.equal(getSiteKey(url), "example.com");
  }
  assert.equal(getSiteKey("https://blog.example.com"), "blog.example.com");
  assert.equal(getSiteKey("chrome://extensions"), null);
  assert.equal(getSiteKey("file:///C:/note.txt"), null);
  assert.equal(getSiteKey(undefined), null);
});

test("ключ хранения и поля новой заметки", () => {
  const note = createNote("example.com", "2026-10-16T12:00:00.000Z", "id-1");
  assert.equal(getStorageKey(note.site, note.id), "note:example.com:id-1");
  assert.equal(note.title, "Новая заметка");
  assert.equal(note.content, "");
  assert.equal(note.createdAt, note.updatedAt);
});

test("заметки сортируются по времени последнего изменения", () => {
  const older = createNote("example.com", "2026-10-15T12:00:00.000Z", "older");
  const newer = createNote("example.com", "2026-10-16T12:00:00.000Z", "newer");
  older.updatedAt = "2026-10-17T12:00:00.000Z";
  assert.deepEqual(sortNotes([newer, older]).map((note) => note.id), ["older", "newer"]);
});

test("под кнопкой показывается создание до редактирования и изменение после него", () => {
  const note = createNote("example.com", "2026-10-16T12:00:00.000Z", "id-1");
  assert.deepEqual(getNoteActivity(note), {
    label: "Создана", timestamp: "2026-10-16T12:00:00.000Z"
  });
  note.updatedAt = "2026-10-16T12:05:00.000Z";
  assert.deepEqual(getNoteActivity(note), {
    label: "Изменена", timestamp: "2026-10-16T12:05:00.000Z"
  });
});

test("заметка с пустым или пробельным текстом не подлежит сохранению", () => {
  assert.equal(hasNoteContent(""), false);
  assert.equal(hasNoteContent("  \n\t "), false);
  assert.equal(hasNoteContent("  Текст  "), true);
});
