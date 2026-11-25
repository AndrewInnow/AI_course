'use strict';

/**
 * db.js — единственный модуль, где допустим SQL (принцип IV конституции).
 * Синхронный доступ через better-sqlite3; каждая операция записи — транзакция.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let db = null;

const PRIORITIES = new Set(['high', 'medium', 'low']);
const PRIORITY_ORDER = `
  CASE t.priority
    WHEN 'high' THEN 0
    WHEN 'medium' THEN 1
    ELSE 2
  END ASC
`;

/**
 * Инициализация БД: создание файла, схемы и включение внешних ключей.
 * Идемпотентно: повторный вызов на существующей базе ничего не меняет.
 * @param {string} dbPath путь к файлу БД
 */
function initDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT    NOT NULL,
      is_completed  INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL,
      priority      TEXT    NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('high', 'medium', 'low'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT    NOT NULL UNIQUE COLLATE NOCASE
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      task_id INTEGER NOT NULL,
      tag_id  INTEGER NOT NULL,
      PRIMARY KEY (task_id, tag_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
    );
  `);

  // Миграция существующих БД из MVP (research.md R2, FR-108).
  // SQLite не позволяет добавить CHECK через ALTER TABLE ADD COLUMN —
  // инвариант приоритета дополнительно обеспечивается validatePriority().
  const columns = db.prepare('PRAGMA table_info(tasks)').all();
  const hasPriority = columns.some((c) => c.name === 'priority');
  if (!hasPriority) {
    db.exec(`ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'`);
  }
}

/** Корректно закрыть соединение с SQLite (FR-012). */
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

/** Убедиться, что БД инициализирована. */
function ensureDb() {
  if (!db) {
    throw new Error('База данных не инициализирована: сначала вызовите initDb()');
  }
  return db;
}

/**
 * Нормализация списка имён тегов: обрезка пробелов, отбрасывание пустых,
 * дедупликация без учёта регистра.
 * @param {string[]} tagNames
 * @returns {string[]} очищенный список имён тегов
 */
function normalizeTagNames(tagNames) {
  const seen = new Set();
  const result = [];
  for (const raw of tagNames || []) {
    const name = String(raw || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

/** Валидация названия задачи: непустое после обрезки пробелов. */
function validateTitle(title) {
  const cleaned = String(title || '').trim();
  if (!cleaned) {
    throw new Error('Название не может быть пустым');
  }
  return cleaned;
}

/** Валидация приоритета: ровно одно из high|medium|low (FR-101). */
function validatePriority(priority) {
  const value = String(priority || '').trim();
  if (!PRIORITIES.has(value)) {
    throw new Error('Недопустимый приоритет');
  }
  return value;
}

/** Привязать теги к задаче; создать теги, которых ещё нет. Внутри транзакции вызывающей функции. */
function attachTags(taskId, tagNames) {
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const getTag = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE');
  const link = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)');
  for (const name of normalizeTagNames(tagNames)) {
    insertTag.run(name);
    const tag = getTag.get(name);
    link.run(taskId, tag.id);
  }
}

/**
 * Создать задачу с тегами и приоритетом.
 * @param {string} title непустое название
 * @param {string[]} [tagNames] имена тегов (опционально)
 * @param {string} [priority='medium'] приоритет (high|medium|low)
 * @returns {{id: number}} идентификатор созданной задачи
 */
function createTask(title, tagNames, priority = 'medium') {
  ensureDb();
  const cleaned = validateTitle(title);
  const prio = validatePriority(priority);
  const tx = db.transaction(() => {
    const createdAt = new Date().toISOString();
    const info = db
      .prepare(
        'INSERT INTO tasks (title, is_completed, created_at, priority) VALUES (?, 0, ?, ?)'
      )
      .run(cleaned, createdAt, prio);
    const taskId = info.lastInsertRowid;
    attachTags(taskId, tagNames);
    return taskId;
  });
  return { id: tx() };
}

/** Собрать TaskView из строки tasks + массива имён тегов. */
function toTaskView(row) {
  return {
    id: row.id,
    title: row.title,
    is_completed: row.is_completed,
    created_at: row.created_at,
    priority: row.priority || 'medium',
    tags: row.tag_names ? row.tag_names.split(',').filter(Boolean) : [],
  };
}

/** Общий SELECT для списков задач с агрегированными тегами. */
const TASKS_SELECT = `
  SELECT t.id, t.title, t.is_completed, t.created_at, t.priority,
         COALESCE(GROUP_CONCAT(tg.name), '') AS tag_names
  FROM tasks t
  LEFT JOIN task_tags tt ON tt.task_id = t.id
  LEFT JOIN tags tg      ON tg.id = tt.tag_id
`;

/**
 * Список всех задач: активные первыми, внутри — по приоритету, затем новые сверху.
 * @returns {Array<{id, title, is_completed, created_at, priority, tags: string[]}>}
 */
function listTasks() {
  ensureDb();
  const rows = db
    .prepare(`${TASKS_SELECT}
      GROUP BY t.id
      ORDER BY t.is_completed ASC, ${PRIORITY_ORDER}, t.created_at DESC, t.id DESC`)
    .all();
  return rows.map(toTaskView);
}

/**
 * Список задач по тегу (без учёта регистра имени тега).
 * @param {string} tagName
 */
function listTasksByTag(tagName) {
  ensureDb();
  const rows = db
    .prepare(`${TASKS_SELECT}
      JOIN task_tags ftt ON ftt.task_id = t.id
      JOIN tags ftg      ON ftg.id = ftt.tag_id
      WHERE ftg.name = ? COLLATE NOCASE
      GROUP BY t.id
      ORDER BY t.is_completed ASC, ${PRIORITY_ORDER}, t.created_at DESC, t.id DESC`)
    .all(String(tagName || '').trim());
  return rows.map(toTaskView);
}

/** Задача по идентификатору или undefined. */
function getTask(id) {
  ensureDb();
  const row = db
    .prepare(`${TASKS_SELECT}
      WHERE t.id = ?
      GROUP BY t.id`)
    .get(id);
  return row ? toTaskView(row) : undefined;
}

/**
 * Инвертировать статус задачи. Несуществующий id → Error.
 * @returns {number} новый статус (0|1)
 */
function toggleTask(id) {
  ensureDb();
  const tx = db.transaction(() => {
    const row = db.prepare('SELECT is_completed FROM tasks WHERE id = ?').get(id);
    if (!row) throw new Error(`Задача с id=${id} не найдена`);
    const next = row.is_completed ? 0 : 1;
    db.prepare('UPDATE tasks SET is_completed = ? WHERE id = ?').run(next, id);
    return next;
  });
  return tx();
}

/**
 * Обновить задачу: только переданные поля (title, tagNames и/или priority).
 * Набор тегов заменяется целиком.
 */
function updateTask(id, { title, tagNames, priority } = {}) {
  ensureDb();
  const tx = db.transaction(() => {
    const row = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!row) throw new Error(`Задача с id=${id} не найдена`);
    if (title !== undefined) {
      const cleaned = validateTitle(title);
      db.prepare('UPDATE tasks SET title = ? WHERE id = ?').run(cleaned, id);
    }
    if (tagNames !== undefined) {
      db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(id);
      attachTags(id, tagNames);
    }
    if (priority !== undefined) {
      const prio = validatePriority(priority);
      db.prepare('UPDATE tasks SET priority = ? WHERE id = ?').run(prio, id);
    }
  });
  tx();
}

/** Удалить задачу; связи task_tags удаляются каскадно. */
function deleteTask(id) {
  ensureDb();
  const tx = db.transaction(() => {
    const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    if (info.changes === 0) throw new Error(`Задача с id=${id} не найдена`);
  });
  tx();
}

/**
 * Теги, у которых есть хотя бы одна связь с задачей (для меню фильтрации).
 * @returns {Array<{id: number, name: string}>}
 */
function listUsedTags() {
  ensureDb();
  return db
    .prepare(`
      SELECT tg.id, tg.name
      FROM tags tg
      JOIN task_tags tt ON tt.tag_id = tg.id
      GROUP BY tg.id
      ORDER BY tg.name COLLATE NOCASE ASC`)
    .all();
}

module.exports = {
  initDb,
  closeDb,
  createTask,
  listTasks,
  listTasksByTag,
  getTask,
  toggleTask,
  updateTask,
  deleteTask,
  listUsedTags,
};
