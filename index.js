'use strict';

/**
 * index.js — точка входа и главный цикл навигации (принцип IV конституции).
 * Связывает ui.js и db.js; не содержит ни SQL, ни промптов.
 */

const path = require('path');
const db = require('./db');
const ui = require('./ui');

const DB_PATH = path.join(__dirname, 'tasks.db');

/**
 * Корректное завершение работы: закрыть БД и выйти с кодом 0 (FR-012).
 */
function shutdown() {
  try {
    db.closeDb();
  } catch {
    // БД уже закрыта — не мешаем завершению
  }
  process.exit(0);
}

// Ctrl+C в любом месте приложения = выход (FR-012)
process.on('SIGINT', shutdown);

/** Экран «Просмотреть все задачи»: список + подменю действий (US2, US4). */
async function handleViewAllTasks() {
  for (;;) {
    const tasks = db.listTasks();
    const selected = await ui.showTaskList('Все задачи', tasks);
    if (!selected) return; // назад в меню / пустой список
    const handled = await handleTaskActions(selected);
    if (handled === 'back') return; // «Назад в меню» из действий
    // иначе — обновить список и продолжить цикл
  }
}

/**
 * Подменю действий над выбранной задачей (FR-008, FR-009).
 * @returns {Promise<'back'|undefined>} 'back' если пользователь выбрал выход в меню
 */
async function handleTaskActions(task) {
  const fresh = db.getTask(task.id);
  if (!fresh) {
    ui.success('Задача удалена');
    return undefined;
  }
  const action = await ui.showTaskActions(fresh);
  if (action === null) return undefined;

  switch (action) {
    case 'toggle': {
      const next = db.toggleTask(fresh.id);
      ui.success(next ? 'Задача выполнена' : 'Задача снова активна');
      return undefined;
    }
    case 'edit':
      await handleEditTask(fresh);
      return undefined;
    case 'delete': {
      if (await ui.confirmDelete(fresh)) {
        db.deleteTask(fresh.id);
        ui.success('Задача удалена');
      } else {
        ui.info('Удаление отменено — задача осталась без изменений');
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/** Редактирование названия и/или тегов задачи (US4). */
async function handleEditTask(task) {
  for (;;) {
    const what = await ui.showEditMenu();
    if (what === null) return;
    if (what === 'title') {
      const title = await ui.promptNewTitle(task.title);
      db.updateTask(task.id, { title });
      ui.success('Название обновлено');
      task.title = String(title).trim();
    } else if (what === 'tags') {
      const allTags = db.listUsedTags().map((t) => t.name);
      const tagNames = await ui.promptTags(task.tags, allTags);
      db.updateTask(task.id, { tagNames });
      ui.success('Теги обновлены');
      task.tags = [...new Set(tagNames)];
    }
  }
}

/** Экран «Фильтровать задачи по тегу» (US3). */
async function handleFilterByTag() {
  for (;;) {
    const tags = db.listUsedTags();
    const tagName = await ui.showTagFilterMenu(tags);
    if (!tagName) return;
    const tasks = db.listTasksByTag(tagName);
    if (tasks.length === 0) {
      ui.info('У этого тега пока нет задач');
      return;
    }
    await ui.showTaskList(`Задачи с тегом #${tagName}`, tasks);
    return;
  }
}

/** Экран «Добавить новую задачу» (US1). */
async function handleAddTask() {
  const existingTags = db.listUsedTags().map((t) => t.name);
  const form = await ui.showAddTaskForm(existingTags);
  if (!form) return;
  db.createTask(form.title, form.tagNames);
  ui.success('Задача добавлена');
}

/** Главное меню приложения (FR-001, FR-010). */
async function main() {
  db.initDb(DB_PATH);

  for (;;) {
    const action = await ui.selectMainMenu();
    switch (action) {
      case 'view':
        await handleViewAllTasks();
        break;
      case 'filter':
        await handleFilterByTag();
        break;
      case 'add':
        await handleAddTask();
        break;
      case 'exit':
        shutdown();
        break;
      default:
        break;
    }
  }
}

main().catch((error) => {
  // Ctrl+C во время интерактивного промпта @inquirer приходит как ExitPromptError —
  // это штатное прерывание, а не сбой: завершаемся тихо с кодом 0 (FR-012, US5-3).
  if (error && (error.name === 'ExitPromptError' || /force closed/i.test(error.message || ''))) {
    shutdown();
  }
  ui.warn(`Ошибка: ${error.message}`);
  process.exitCode = 1;
  shutdown();
});