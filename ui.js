'use strict';

/**
 * ui.js — единственный модуль ввода-вывода в терминал (принцип IV конституции).
 * Все экраны, промпты и цветовое оформление приложения.
 */

const { select, input, confirm, checkbox } = require('@inquirer/prompts');
const { styleText } = require('util');

// Цветовые правила (FR-013): зелёный — успех/выполненные, серый — теги,
// красный — предупреждения. Деградация к монохрому — автоматическая
// (styleText игнорирует unsupported-цвета при отсутствии поддержки).
const green = (text) => styleText('green', String(text));
const gray = (text) => styleText('gray', String(text));
const red = (text) => styleText('red', String(text));

/** Вывести заголовок экрана `=== ... ===` (contracts/ui.md). */
function header(title) {
  console.log(`\n=== ${title} ===\n`);
}

/** Вывести сообщение об успехе (зелёным). */
function success(message) {
  console.log(green(`✓ ${message}`));
}

/** Вывести предупреждение/ошибку (красным). */
function warn(message) {
  console.log(red(message));
}

/** Вывести информационное (дружелюбное, нейтральное) сообщение. */
function info(message) {
  console.log(message);
}

/** Символьная метка приоритета (research.md R4, FR-105). */
const PRIORITY_MARK = { high: '!!!', medium: '!!', low: '!' };

/**
 * Отрисовать строку задачи: [ ]/[x] !!! Название #тег1 #тег2 (FR-006, FR-105).
 * Метка приоритета только у активных задач.
 * @param {{title: string, is_completed: number, priority?: string, tags: string[]}} task
 */
function renderTaskLine(task) {
  const mark = task.is_completed ? '[x]' : '[ ]';
  const title = task.is_completed ? green(task.title) : task.title;
  const prio =
    !task.is_completed && task.priority
      ? `${PRIORITY_MARK[task.priority] || '!!'} `
      : '';
  const tags = task.tags.length
    ? ` ${gray(task.tags.map((t) => `#${t}`).join(' '))}`
    : '';
  return `${mark} ${prio}${title}${tags}`;
}

/** Валидатор названия: непустое после обрезки пробелов (FR-002). */
const notEmpty = (label) => async (value) =>
  (String(value || '').trim().length > 0 ? true : `${label} не может быть пустым. Попробуйте снова:`);

/* ------------------------------------------------------------------ */
/* Экраны (contracts/ui.md)                                            */
/* ------------------------------------------------------------------ */

/**
 * Главное меню приложения (FR-001): 4 пункта, навигация стрелками.
 * @returns {Promise<'view'|'filter'|'add'|'exit'>}
 */
async function selectMainMenu() {
  header('Task Tracker');
  return select({
    message: 'Главное меню:',
    choices: [
      { name: 'Просмотреть все задачи', value: 'view' },
      { name: 'Фильтровать задачи по тегу', value: 'filter' },
      { name: 'Добавить новую задачу', value: 'add' },
      { name: 'Выход', value: 'exit' },
    ],
  });
}

/**
 * Список задач (экран 1). Возвращает выбранную задачу или null (назад).
 * @param {string} title заголовок экрана
 * @param {Array} tasks массив TaskView
 */
async function showTaskList(title, tasks) {
  header(title);
  if (tasks.length === 0) {
    info('Список задач пуст. Создайте первую задачу!');
    return null;
  }
  info('Приоритет: !!! высокий · !! средний · ! низкий');
  const choices = tasks.map((t) => ({ name: renderTaskLine(t), value: t }));
  choices.push({ name: '← Назад в меню', value: null });
  return select({ message: 'Задачи:', choices, pageSize: 15 });
}

/**
 * Экран фильтрации по тегу (экран 2). Возвращает выбранный тег или null.
 * @param {Array<{id:number,name:string}>} tags используемые теги
 */
async function showTagFilterMenu(tags) {
  header('Фильтр по тегу');
  if (tags.length === 0) {
    info('Теги пока не созданы');
    return null;
  }
  const choices = tags.map((t) => ({ name: `#${t.name}`, value: t.name }));
  choices.push({ name: '← Назад в меню', value: null });
  return select({ message: 'Выберите тег:', choices });
}

/**
 * Форма добавления задачи (экран 3). Возвращает { title, tagNames, priority } или null.
 * @param {string[]} existingTags имена существующих тегов
 */
async function showAddTaskForm(existingTags) {
  header('Новая задача');

  const title = await input({
    message: 'Название задачи:',
    validate: notEmpty('Название'),
  });

  let tagNames = [];
  if (existingTags.length > 0) {
    const selected = await checkbox({
      message: 'Выберите теги (пробел — отметить, Enter — подтвердить):',
      choices: existingTags.map((t) => ({ name: `#${t}`, value: t })),
    });
    tagNames.push(...selected);
  }

  const wantNew = await confirm({
    message: 'Добавить новый тег?',
    default: false,
  });
  if (wantNew) {
    const raw = await input({
      message: 'Новые теги через запятую:',
    });
    tagNames.push(...raw.split(',').map((t) => t.trim()).filter(Boolean));
  }

  const priority = await select({
    message: 'Приоритет:',
    choices: [
      { name: 'Средний (!!) — по умолчанию', value: 'medium' },
      { name: 'Высокий (!!!)', value: 'high' },
      { name: 'Низкий (!)', value: 'low' },
    ],
    default: 'medium',
  });

  return { title, tagNames, priority };
}

/**
 * Подменю действий над задачей (экран 4). Возвращает действие или null.
 */
async function showTaskActions(task) {
  header(`Задача: ${task.title}`);
  return select({
    message: 'Действия:',
    choices: [
      { name: task.is_completed ? 'Переключить статус (Сделать не выполненной)' : 'Переключить статус (Выполнено/Не выполнено)', value: 'toggle' },
      { name: 'Редактировать', value: 'edit' },
      { name: 'Изменить приоритет', value: 'priority' },
      { name: red('Удалить'), value: 'delete' },
      { name: '← Назад к списку', value: null },
    ],
  });
}

/**
 * Выбор нового приоритета. Возвращает 'high'|'medium'|'low' или null (назад).
 * @param {string} currentPriority текущий приоритет задачи
 */
async function promptPriority(currentPriority) {
  const mark = (value, label) =>
    value === currentPriority ? `${label} (сейчас)` : label;
  return select({
    message: 'Новый приоритет:',
    choices: [
      { name: mark('high', 'Высокий (!!!)'), value: 'high' },
      { name: mark('medium', 'Средний (!!)'), value: 'medium' },
      { name: mark('low', 'Низкий (!)'), value: 'low' },
      { name: '← Назад', value: null },
    ],
  });
}

/**
 * Подменю редактирования. Возвращает 'title' | 'tags' | null.
 */
async function showEditMenu() {
  return select({
    message: 'Что отредактировать?',
    choices: [
      { name: 'Редактировать название', value: 'title' },
      { name: 'Редактировать теги', value: 'tags' },
      { name: '← Назад', value: null },
    ],
  });
}

/** Ввод нового названия задачи (с валидацией). */
async function promptNewTitle(current) {
  return input({
    message: 'Новое название задачи:',
    default: current,
    validate: notEmpty('Название'),
  });
}

/**
 * Комбинированный ввод тегов: выбор существующих + новые через запятую.
 * @param {string[]} currentTags текущий набор тегов задачи
 * @param {string[]} allTags все существующие теги
 */
async function promptTags(currentTags, allTags) {
  const available = allTags.filter((t) => !currentTags.includes(t));
  const selected = [...currentTags];
  if (available.length > 0) {
    const picked = await checkbox({
      message: `Текущие теги: ${currentTags.map((t) => `#${t}`).join(' ') || '—'} — выберите дополнительные:`,
      choices: available.map((t) => ({ name: `#${t}`, value: t })),
    });
    selected.push(...picked);
  }
  const raw = await input({
    message: 'Новые теги через запятую (пусто — не добавлять):',
  });
  selected.push(...raw.split(',').map((t) => t.trim()).filter(Boolean));
  return selected;
}

/**
 * Подтверждение удаления (FR-009): красное предупреждение, y/N.
 * @returns {Promise<boolean>}
 */
async function confirmDelete(task) {
  warn(`⚠️ Удаление задачи: «${task.title}»`);
  return confirm({
    message: `Удалить задачу «${task.title}»? (y/N)`,
    default: false,
  });
}

module.exports = {
  selectMainMenu,
  header,
  success,
  warn,
  info,
  renderTaskLine,
  showTaskList,
  showTagFilterMenu,
  showAddTaskForm,
  showTaskActions,
  promptPriority,
  showEditMenu,
  promptNewTitle,
  promptTags,
  confirmDelete,
};