# Tasks: Приоритеты задач (Post-MVP v2)

**Input**: Design documents from `/specs/002-task-priorities/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Автотесты НЕ запрошены (принцип V конституции — ручная верификация). Проверка —
чекпоинты фаз, [quickstart.md](./quickstart.md) фичи и регрессия
[quickstart.md MVP](../001-cli-task-tracker/quickstart.md).

**Organization**: Задачи сгруппированы по пользовательским историям; фича — дельта поверх
реализованного MVP (001-cli-task-tracker).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US3 из spec.md)
- Include exact file paths in descriptions

## Path Conventions

Изменяются только существующие модули в корне проекта: `db.js`, `ui.js`, `index.js`
(новых файлов и зависимостей нет — plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Базовая проверка перед изменениями

- [x] T001 Verify baseline: `npm start` запускает MVP без ошибок; зафиксировать текущее состояние `tasks.db` (резервная копия `copy tasks.db tasks.backup.db` для проверки миграции по quickstart.md, «Предварительные требования»)

**Checkpoint**: MVP работает — можно начинать изменения.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Слой данных: миграция, валидация и сортировка по приоритету

**⚠️ CRITICAL**: Никакая пользовательская история не начинается до завершения этой фазы

- [x] T002 Implement priority migration in `initDb()` in `db.js`: после создания таблиц проверить `PRAGMA table_info(tasks)`; если колонки `priority` нет — `ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low'))`; идемпотентно, без изменения существующих строк (`tasks.priority` — data-model.md, research.md R2, FR-108)
- [x] T003 Implement priority in data operations in `db.js`: валидация значения (`'high'|'medium'|'low'`, иначе `Error('Недопустимый приоритет')`), параметр `priority = 'medium'` в `createTask(title, tagNames, priority)` с записью в INSERT (`tasks.priority` DEFAULT 'medium' — data-model.md), поддержка `priority?` в `updateTask(id, {...})`, поле `priority` в `TaskView` всех выборок (`getTask`/`listTasks`/`listTasksByTag`); транзакции без изменений (contracts/db-api.md, FR-102, FR-104, FR-107)
- [x] T004 Implement priority ordering in `db.js`: заменить ORDER BY в `listTasks()` и `listTasksByTag()` на `is_completed ASC, CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC, created_at DESC, id DESC` (data-model.md «Представление списка», FR-106, research.md R3)

**Checkpoint**: Миграция существующей БД проходит без потери данных (проверка: запустить
приложение — старые задачи на месте, ошибки нет); операции БД принимают и возвращают
priority (проверка через `node -e` как в 001).

---

## Phase 3: User Story 1 - Приоритет при создании задачи (Priority: P1) 🎯

**Goal**: Новая задача сохраняется с выбранным приоритетом (умолчание «средний»)

**Independent Test**: Добавить две задачи — с выбором «Высокий» и с подтверждением
умолчания — и проверить сохранённые значения

### Implementation for User Story 1

- [x] T005 [US1] Implement priority step in add-task form in `ui.js`: последний шаг `showAddTaskForm` — `select` «Приоритет» с пунктами «Средний (!!) — по умолчанию» (курсор по умолчанию), «Высокий (!!!)», «Низкий (!)»; возвращает выбранное значение; форма остаётся трёхшаговой без доп. экранов (contracts/ui.md «Форма добавления», FR-103, SC-105)
- [x] T006 [US1] Wire priority into creation flow in `index.js`: `handleAddTask()` передаёт выбранный приоритет третьим аргументом в `db.createTask()` (contracts/db-api.md, FR-103)

**Checkpoint**: Сценарий 2 из quickstart.md проходит (обе задачи сохранены с нужным
приоритетом). История 1 работает независимо.

---

## Phase 4: User Story 2 - Отображение приоритета и порядок списка (Priority: P1)

**Goal**: Приоритеты видны в списке; активные задачи сгруппированы по приоритету

**Independent Test**: Создать задачи A (низкий), B (высокий), C (средний), D (высокий) —
порядок D, B, C, A; выполнить одну — она уходит в конец без метки

### Implementation for User Story 2

- [x] T007 [US2] Implement priority display in `ui.js`: в `renderTaskLine()` для активных задач метка перед названием — `!!!` (high) / `!!` (medium) / `!` (low), для выполненных метка не выводится; над списком легенда `Приоритет: !!! высокий · !! средний · ! низкий` (в `showTaskList()` перед выбором, только если список непуст); палитра цветов не расширяется, метки читаемы в монохроме (contracts/ui.md «Список», research.md R4, FR-105, FR-013)

**Checkpoint**: Сценарии 1 и 3 из quickstart.md проходят: старые задачи — в группе
«средний», порядок D→B→C→A, выполненные внизу без меток. Сортировка реализована
в T004 (foundational), отображение — здесь.

---

## Phase 5: User Story 3 - Изменение приоритета (Priority: P2)

**Goal**: Приоритет выбранной задачи меняется через подменю и сразу виден в списке

**Independent Test**: Изменить приоритет задачи с «средний» на «высокий» — задача
переместилась в верхнюю группу; «Назад» — без изменений; перезапуск — сохранено

### Implementation for User Story 3

- [x] T008 [US3] Implement change-priority submenu in `ui.js`: новый пункт «Изменить приоритет» в `showTaskActions()` между «Редактировать» и «Удалить»; экран выбора `select` «Новый приоритет»: «Высокий (!!!)», «Средний (!!)», «Низкий (!)» с пометкой `(сейчас)` у текущего значения и пунктом «← Назад»; доступно и для выполненных задач (contracts/ui.md «Подменю», FR-107, US3-3)
- [x] T009 [US3] Wire change-priority flow in `index.js`: обработка пункта в `handleTaskActions()` — выбор значения → `db.updateTask(id, { priority })` → `✓ Приоритет обновлён` → возврат в обновлённый список задач; «← Назад» — без изменений и без сообщений (Clarifications Q1 из 001, FR-010/FR-107)

**Checkpoint**: Сценарии 4 и 5 из quickstart.md проходят полностью.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Регрессия и финальная верификация

- [x] T010 Run full MVP regression per `specs/001-cli-task-tracker/quickstart.md`: сценарии 1–4 с учётом ожидаемых отличий (шаг «Приоритет» в форме, метки у активных задач); любое расхождение, кроме этих двух, — дефект
- [x] T011 Run full feature validation per `specs/002-task-priorities/quickstart.md`: сценарии 1–6, включая миграцию существующей базы (сценарий 1) и сохранность приоритета после перезапуска (SC-103); фича завершена только при полном прохождении (принцип V)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей
- **Foundational (Phase 2)**: зависит от Phase 1 — БЛОКИРУЕТ все истории; T002 → T003 → T004
  строго последовательно (один файл `db.js`)
- **US1 (Phase 3)**: после Phase 2 (T005 → T006, оба касаются разных файлов, но T006
  зависит от сигнатуры из T003)
- **US2 (Phase 4)**: после Phase 2 (T007 — только `ui.js`)
- **US3 (Phase 5)**: после Phase 2; T009 зависит от T008
- **Polish (Phase 6)**: после всех историй

### User Story Dependencies

- **US1 (P1)**: только Foundational
- **US2 (P1)**: только Foundational (для демонстрации нужны задачи из US1)
- **US3 (P2)**: только Foundational (интегрируется с подменю из 001)

### Within Each User Story

- `ui.js` перед проводкой в `index.js`
- Чекпоинт каждой истории — ручная проверка Independent Test

### Parallel Opportunities

- В этом небольшом дельта-изменении параллельных задач мало: T002–T004 и T005–T009
  затрагивают общие файлы и выполняются последовательно
- T010 и T011 можно выполнить в одном проходе после T009

---

## Implementation Strategy

### Incremental Delivery

1. Phase 1: базовая проверка → Phase 2: слой данных (миграция!)
2. US1 → проверить → US2 (список «оживает») → проверить → US3
3. Phase 6: регрессия MVP + полный прогон quickstart 002

### Single-Developer Strategy

Строгая последовательность T001→T011, коммит после каждой фазы, чекпоинт после каждой
истории. Особое внимание — T002: миграция выполняется на реальной пользовательской БД,
поэтому резервная копия из T001 обязательна.

---

## Notes

- [P] tasks = разные файлы, нет зависимостей (в этой фиче параллельность ограничена)
- [Story] label связывает задачу с историей из spec.md
- Автотесты не создаются (не запрошены; конституция — ручная верификация)
- Нумерация FR/SC продолжена с 101 — ссылки в задачах ведут на spec.md фичи 002
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
