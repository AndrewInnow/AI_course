# Tasks: Интерактивный CLI Task Tracker (MVP)

**Input**: Design documents from `/specs/001-cli-task-tracker/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Автотесты НЕ запрошены — конституция (принцип V) предписывает ручную верификацию
по сценариям. Тестовые задачи отсутствуют; проверка — чекпоинты фаз и `quickstart.md`.

**Organization**: Задачи сгруппированы по пользовательским историям для независимой
реализации и проверки каждой истории.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5 из spec.md)
- Include exact file paths in descriptions

## Path Conventions

Single project (plan.md): модули в корне репозитория — `index.js`, `db.js`, `ui.js`,
`package.json`, `.gitignore`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Инициализация проекта и зависимостей

- [x] T001 Create `.gitignore` in project root with entries: `node_modules/`, `tasks.db` (конституция, принцип III)
- [x] T002 Create `package.json` in project root with `"start": "node index.js"` script and install dependencies: `better-sqlite3`, `@inquirer/prompts`, `chalk` (research.md D1–D3)
- [x] T003 [P] Create empty module skeletons `index.js`, `db.js`, `ui.js` in project root (структура из plan.md, принцип IV)

**Checkpoint**: `npm start` запускается без ошибок; зависимости установлены.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ядро, необходимое всем историям: схема БД, завершение работы, скелет приложения

**⚠️ CRITICAL**: Никакая пользовательская история не начинается до завершения этой фазы

- [x] T004 Implement `initDb(dbPath)` in `db.js`: create tables `tasks` (`tasks.id` INTEGER PRIMARY KEY AUTOINCREMENT, `tasks.title` TEXT NOT NULL, `tasks.is_completed` INTEGER NOT NULL DEFAULT 0, `tasks.created_at` TEXT NOT NULL — data-model.md), `tags` (`tags.name` TEXT NOT NULL UNIQUE COLLATE NOCASE — data-model.md), `task_tags` (составной PRIMARY KEY (`task_tags.task_id`, `task_tags.tag_id`), FK `task_tags.task_id` → tasks(id) ON DELETE CASCADE, FK `task_tags.tag_id` → tags(id) ON DELETE CASCADE — data-model.md); enable `PRAGMA foreign_keys = ON`; идемпотентно (contracts/db-api.md)
- [x] T005 Implement `closeDb()` in `db.js`: корректное закрытие соединения SQLite (contracts/db-api.md)
- [x] T006 [P] Implement UI helpers in `ui.js`: заголовки `=== ... ===`, цветовые функции (зелёный — успех/выполненные, серый — теги, красный — предупреждения) через `chalk`, деградация к монохрому (contracts/ui.md, FR-013)
- [x] T007 Implement main loop skeleton in `index.js`: `initDb('tasks.db')` → интерактивное главное меню из 4 пунктов («Просмотреть все задачи», «Фильтровать задачи по тегу», «Добавить новую задачу», «Выход») через `@inquirer/prompts select`, стрелки `↑`/`↓` + `Enter`, пункты-заглушки возвращают в меню, «Выход» вызывает `closeDb()` и завершает процесс с кодом 0 (contracts/ui.md, FR-001, FR-010, FR-012)

**Checkpoint**: Приложение запускается, показывает меню, корректно выходит. БД создаётся
с полной схемой. Фундамент готов — истории можно реализовывать.

---

## Phase 3: User Story 1 - Добавление задачи (Priority: P1) 🎯 MVP

**Goal**: Пользователь может создать задачу с названием и тегами (существующими
и/или новыми)

**Independent Test**: Запустить приложение → «Добавить новую задачу» → ввести название
и тег → убедиться, что задача сохранена (пока проверка через БД/следующую историю)

### Implementation for User Story 1

- [x] T008 [US1] Implement `createTask(title, tagNames[])` in `db.js`: вставка задачи с `created_at` (ISO 8601), нормализация тегов — обрезка пробелов, отбрасывание пустых, дедупликация, создание отсутствующих тегов (`tags.name` UNIQUE COLLATE NOCASE — data-model.md), составной PK `task_tags` исключает дубли связи (data-model.md); валидация непустого названия (`tasks.title` NOT NULL — data-model.md, FR-002); транзакция (contracts/db-api.md)
- [x] T009 [US1] Implement add-task form in `ui.js`: input «Название задачи:» с повторным запросом при пустом/пробельном вводе и сообщением `Название не может быть пустым. Попробуйте снова:`, multiselect существующих тегов с опцией «➕ Новый тег», input «Новые теги через запятую:», подтверждение `✓ Задача добавлена` зелёным (contracts/ui.md, FR-002, FR-003)
- [x] T010 [US1] Wire «Добавить новую задачу» in `index.js` to T009 form, затем возврат в главное меню (FR-010)

**Checkpoint**: Задачи создаются с тегами; пустое название отклоняется с повтором ввода.
История 1 работает независимо.

---

## Phase 4: User Story 2 - Просмотр всех задач (Priority: P1)

**Goal**: Пользователь видит полный список задач со статусами и тегами

**Independent Test**: Добавить 2–3 задачи, открыть список, проверить `[ ]`/`[x]`,
теги `#имя`, пустое состояние

### Implementation for User Story 2

- [x] T011 [US2] Implement `listTasks()` in `db.js`: задачи с агрегированным списком тегов (LEFT JOIN task_tags/tags, group by task, теги отсортированы по имени), TaskView `{id, title, is_completed, created_at, tags[]}`; порядок списка по FR-006 (Clarifications): активные первыми, внутри группы новые сверху — `ORDER BY is_completed ASC, created_at DESC, id DESC` (contracts/db-api.md, data-model.md)
- [x] T012 [US2] Implement task-list rendering in `ui.js`: формат `[ ]`/`[x]` + название + теги серым `#имя`, выполненные — зелёным/приглушённым; длинные названия не ломают вывод (перенос/усечение при показе — data-model.md edge case); пустой список → `Список задач пуст. Создайте первую задачу!` → возврат в меню (contracts/ui.md, FR-006, FR-011)
- [x] T013 [US2] Wire «Просмотреть все задачи» in `index.js` to T012 rendering со стрелочным выбором задачи (select) и пунктом «← Назад в меню»; выбор задачи пока возвращает в меню (заполнится в US4) (contracts/ui.md, FR-010)

**Checkpoint**: MVP-ядро готово: задачи добавляются и просматриваются. Остановитесь
и проверьте истории 1–2 независимо.

---

## Phase 5: User Story 5 - Сохранность данных между запусками (Priority: P1)

**Goal**: Все данные переживают перезапуск, включая прерывание Ctrl+C

**Independent Test**: Добавить задачи → выйти → запустить снова → данные на месте;
Ctrl+C — корректное завершение

### Implementation for User Story 5

- [x] T014 [US5] Register SIGINT handler in `index.js`: Ctrl+C вызывает `closeDb()` и завершает процесс с кодом 0 без стектрейса (FR-012, research.md D7)
- [x] T015 [US5] Verify immediate persistence in `db.js` mutations: убедиться, что каждая операция записи (create/toggle/update/delete) обёрнута в транзакцию и данные фиксируются немедленно, переживая любой перезапуск (FR-014, contracts/db-api.md инвариант 3)

**Checkpoint**: Сценарий 2 из quickstart.md (сохранность + Ctrl+C) проходит полностью.

---

## Phase 6: User Story 3 - Фильтрация по тегу (Priority: P2)

**Goal**: Пользователь фильтрует задачи по выбранному тегу

**Independent Test**: Добавить задачи с разными тегами → фильтр по одному → только
задачи с ним

### Implementation for User Story 3

- [x] T016 [US3] Implement `listUsedTags()` and `listTasksByTag(tagName)` in `db.js`: только теги с хотя бы одной связью в task_tags (data-model.md); выборка по имени case-insensitive (contracts/db-api.md)
- [x] T017 [US3] Implement tag-filter screen in `ui.js`: select существующих тегов + «← Назад в меню»; пусто тегов → `Теги пока не созданы`; у тега нет задач → `У этого тега пока нет задач`; результат — список задач в формате T012 (contracts/ui.md, FR-007, FR-011)
- [x] T018 [US3] Wire «Фильтровать задачи по тегу» in `index.js` to T017 screen, затем возврат в меню (FR-010)

**Checkpoint**: Истории 1–3 (и 5) работают независимо; фильтрация корректна.

---

## Phase 7: User Story 4 - Управление выбранной задачей (Priority: P2)

**Goal**: Полный CRUD: переключение статуса, редактирование, удаление с подтверждением

**Independent Test**: Создать задачу → переключить статус → переименовать → удалить
(и отменить удаление) → проверить список

### Implementation for User Story 4

- [x] T019 [US4] Implement `getTask(id)`, `toggleTask(id)`, `updateTask(id, {title?, tagNames?})`, `deleteTask(id)` in `db.js`: toggle инвертирует `tasks.is_completed` (только 0/1 — data-model.md), update заменяет набор тегов целиком с нормализацией как в T008, delete с каскадом связей (`task_tags.task_id` ON DELETE CASCADE — data-model.md), несуществующий id → Error (contracts/db-api.md)
- [x] T020 [US4] Implement task action submenu in `ui.js`: «Переключить статус» / «Редактировать» (подменю: название / теги / ← Назад) / «Удалить» (confirm `Удалить задачу «...»? (y/N)` с красным предупреждением, при `n` — без изменений) / «← Назад к списку»; сообщения `✓ Статус обновлён`, `✓ Задача удалена` (contracts/ui.md, FR-008, FR-009)
- [x] T021 [US4] Implement edit form in `ui.js`: валидация названия как в T009 (повтор при пустом), редактирование тегов — тот же комбинированный ввод (multiselect + новые через запятую) (contracts/ui.md, FR-003)
- [x] T022 [US4] Wire task selection in `index.js` (из T013) to T020 submenu: выбор задачи из списка открывает подменю, после действия — обновлённый список, «Назад» — меню (FR-010)

**Checkpoint**: Полный CRUD работает; сценарий 1 из quickstart.md (кроме фильтра) проходит.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Граничные случаи, финальная верификация

- [x] T023 [P] Handle edge cases in `ui.js` + `db.js`: тег из одних пробелов отбрасывается, дубликат тега связывается один раз, `Ctrl+C` во время любого промпта завершает корректно (spec.md Edge Cases, FR-012)
- [x] T024 [P] Review color output degradation in `ui.js`: отсутствие поддержки цвета в терминале — монохромный вывод без сбоев (spec.md Assumptions)
- [x] T025 Run full validation per `quickstart.md`: пройти все 4 сценария, зафиксировать результаты; фича завершена только при полном прохождении (принцип V конституции)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей — начать немедленно
- **Foundational (Phase 2)**: зависит от Phase 1 — БЛОКИРУЕТ все истории
- **User Stories (Phases 3–7)**: порядок по приоритетам spec.md — US1 → US2 → US5 → US3 → US4;
  каждая история независима (опирается только на Phase 2)
- **Polish (Phase 8)**: после всех историй

### User Story Dependencies

- **US1 (P1)**: только Phase 2. Зависимостей от других историй нет
- **US2 (P1)**: только Phase 2 (для демонстрации удобно иметь US1)
- **US5 (P1)**: только Phase 2 (+ реализованные операции записи из US1/US2 для проверки)
- **US3 (P2)**: только Phase 2 (нужны задачи с тегами из US1 для проверки)
- **US4 (P2)**: интегрируется с точкой выбора из US2 (T013), но логика подменю независима

### Within Each User Story

- db.js операции перед ui.js экранами
- ui.js перед проводкой в index.js
- Чекпоинт каждой истории — ручная проверка её Independent Test

### Parallel Opportunities

- T003 параллелен Setup-задачам T001–T002 (разные файлы)
- T006 параллелен T004–T005 в Phase 2 (разные файлы)
- После Phase 2 истории US1 и US2 можно вести параллельно (разные функции db.js/ui.js)
- T023, T024 параллельны в Phase 8

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Завершить Phase 1: Setup
2. Завершить Phase 2: Foundational (CRITICAL — блокирует всё)
3. Завершить Phases 3–4: US1 + US2 → минимально полезный трекер (добавить и посмотреть)
4. **STOP and VALIDATE**: проверить US1/US2 независимо

### Incremental Delivery

1. Setup + Foundational → фундамент готов
2. US1 → проверить → US2 → проверить → **MVP!**
3. US5 (надёжность) → US3 (фильтры) → US4 (полный CRUD) → проверять после каждой
4. Polish + финальный прогон quickstart.md

### Single-Developer Strategy

Для одного разработчика (учебный проект): строгая последовательность T001→T025,
чекспоинт после каждой фазы, коммит после каждой логической группы задач.

---

## Notes

- [P] tasks = разные файлы, нет зависимостей
- [Story] label связывает задачу с историей из spec.md
- Автотесты не создаются (не запрошены; конституция — ручная верификация)
- Коммит после каждой задачи или логической группы
- Останавливайтесь на чекпоинтах для независимой проверки истории
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
