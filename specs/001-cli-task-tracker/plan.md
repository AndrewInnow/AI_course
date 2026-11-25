# Implementation Plan: Интерактивный CLI Task Tracker (MVP)

**Branch**: `001-cli-task-tracker` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-cli-task-tracker/spec.md`

## Summary

Интерактивное консольное приложение для управления личными задачами: главное меню со
стрелочной навигацией, CRUD-операции над задачами, теги с фильтрацией по ним и локальное
persistent-хранение в едином файле SQLite. Технический подход (из конституции и research):
Node.js LTS + `@inquirer/prompts` для TUI, `better-sqlite3` для синхронного доступа к БД,
трёхслойная структура `db.js` / `ui.js` / `index.js` без дополнительных зависимостей.

## Technical Context

**Language/Version**: JavaScript на Node.js актуальной LTS-версии (Node 20+ / 22+),
CommonJS-модули (без этапа сборки).

**Primary Dependencies**:
- `better-sqlite3` — синхронный SQLite-драйвер (единственная нативная зависимость);
- `@inquirer/prompts` — интерактивные промпты (select, input, confirm);
- `chalk` — цветовой вывод консоли (если решим не использовать встроенный
  `util.styleText`; см. research.md, решение D3).

**Storage**: локальный файл SQLite `tasks.db` в корне проекта (в `.gitignore`);
схема `tasks`, `tags`, `task_tags` создаётся автоматически при первом запуске.

**Testing**: ручная верификация по сценариям из spec.md (принцип V конституции);
автотесты опциональны и в MVP не создаются. Проверка — `quickstart.md`.

**Target Platform**: консоль/терминал на Windows (основная среда пользователя),
macOS и Linux — без отдельной адаптации.

**Project Type**: CLI (single project).

**Performance Goals**: запуск до главного меню < 5 сек (SC-001); отклик меню и списков
практически мгновенный для объёмов до сотен задач.

**Constraints**: без сети и серверов; один пользователь; корректное завершение с кодом 0
при «Выход» и `Ctrl+C`; немедленная фиксация каждого изменения в БД (FR-014).

**Scale/Scope**: MVP из PRD — 4 пункта главного меню, полный CRUD, теги многие-ко-многим,
фильтрация по тегу; один файл хранилища; 3 модуля исходного кода.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Статус | Комментарий |
|---------|--------|-------------|
| I. Простота прежде всего | ✅ PASS | Три модуля, две внешние зависимости, ничего вне Non-Goals PRD |
| II. Интерактивность вместо флагов | ✅ PASS | Только интерактивное меню со стрелками; CLI-флаги не вводятся |
| III. Локальность и надёжность данных | ✅ PASS | `tasks.db` в корне проекта, автосоздание схемы, немедленная запись, код выхода 0 |
| IV. Трёхслойная архитектура | ✅ PASS | `db.js` (только SQL) / `ui.js` (только I/O) / `index.js` (цикл навигации) |
| V. Проверка по сценариям успеха | ✅ PASS | `quickstart.md` содержит все 4 сценария метрик успеха PRD; автотесты не создаются |
| Технологические ограничения | ✅ PASS | Node LTS, `better-sqlite3`, `@inquirer/prompts`, Non-Goals соблюдены |
| Workflow & Quality Gates | ✅ PASS | PRD — источник требований; проверка соответствия выполнена в этом плане |

Post-design re-check (после Phase 1): violations нет, Complexity Tracking остаётся
пустым — структура и зависимости не выходят за рамки конституции.

## Project Structure

### Documentation (this feature)

```text
specs/001-cli-task-tracker/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── ui.md            # Контракт пользовательского интерфейса (меню/промпты)
│   └── db-api.md        # Контракт модуля доступа к данным (db.js)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
├── index.js             # Точка входа, главный цикл навигации
├── db.js                # Инициализация SQLite, схема, все SQL-запросы
├── ui.js                # Меню, списки, промпты, цветовое оформление
├── package.json         # Манифест, скрипт "start": "node index.js"
├── .gitignore           # node_modules/, tasks.db
└── tasks.db             # (создаётся при первом запуске, в .gitignore)
```

**Structure Decision**: выбрана структура Option 1 (single project) в минимальной форме,
определённой принципом IV конституции: три модуля в корне проекта без вложенных
каталогов `src/`/`tests/` — для учебного проекта из трёх файлов это самый простой
и прозрачный вариант. Каталог `contracts/` документирует внутренние интерфейсы модулей
(единственная «внешняя» поверхность — интерактивный UI, зафиксирован в `contracts/ui.md`).

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

Нарушений конституции нет — таблица остаётся пустой.
