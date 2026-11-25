# Implementation Plan: Приоритеты задач (Post-MVP v2)

**Branch**: `002-task-priorities` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-task-priorities/spec.md`

**Base**: изменения поверх реализованного MVP ([001-cli-task-tracker](../001-cli-task-tracker/plan.md)).

## Summary

К задаче добавляется атрибут приоритета (высокий / средний / низкий, по умолчанию «средний»):
выбор в форме добавления задачи и в подменю действий, символьная метка у активных задач в
списке, группировка активных задач по приоритету внутри общего порядка списка. Технически —
одна колонка `tasks.priority` с CHECK-ограничением, идемпотентная миграция существующей
`tasks.db`, новый `ORDER BY` в `db.js` и два UI-шага в `ui.js`. Новых зависимостей нет.

## Technical Context

**Language/Version**: JavaScript на Node.js 20+ / 22+, CommonJS (без изменений относительно MVP).

**Primary Dependencies**: без изменений — `better-sqlite3`, `@inquirer/prompts`,
встроенный `util.styleText`.

**Storage**: существующий файл `tasks.db` в корне проекта. Добавляется колонка
`tasks.priority`; для уже созданных баз — миграция при старте приложения (research.md R2,
data-model.md).

**Testing**: ручная верификация по [quickstart.md](./quickstart.md) этой фичи и регрессия
по `specs/001-cli-task-tracker/quickstart.md` (принцип V конституции; автотесты не вводятся).

**Target Platform**: без изменений (Windows — основная среда, macOS/Linux без адаптации).

**Project Type**: CLI (single project).

**Performance Goals**: без изменений. Сортировка по приоритету выполняется в SQL в том же
запросе списка; дополнительных запросов не добавляется.

**Constraints**: данные существующих пользователей сохраняются без ручных действий
(принцип III, FR-108, SC-104); каждое изменение приоритета фиксируется немедленно (FR-014);
новых зависимостей не вводится.

**Scale/Scope**: одна колонка, один шаг в форме добавления, один пункт подменю, одна метка
в строке списка, новый порядок сортировки, легенда над списком.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Статус | Комментарий |
|---------|--------|-------------|
| I. Простота прежде всего | ✅ PASS | Один атрибут с тремя значениями; без нового экрана и без фильтра по приоритету (Assumptions spec); новых модулей нет |
| II. Интерактивность вместо флагов | ✅ PASS | Приоритет выбирается стрелками из `select`; CLI-флаги не вводятся |
| III. Локальность и надёжность данных | ✅ PASS | Миграция `ALTER TABLE ... ADD COLUMN ... DEFAULT 'medium'` не теряет строк; запись немедленная |
| IV. Трёхслойная архитектура | ✅ PASS | Миграция и `ORDER BY` — только в `db.js`; метки и выбор — только в `ui.js`; проводка — в `index.js` |
| V. Проверка по сценариям успеха | ✅ PASS | Сценарии приоритета в quickstart.md 002 + регрессия quickstart.md 001 |
| Технологические ограничения | ✅ PASS | Node LTS, те же библиотеки, Non-Goals не нарушены |
| Workflow & Quality Gates | ✅ PASS | PRD обновлён до спецификации (раздел 10, Non-Goals скорректирован) |

**Post-design re-check (после Phase 1)**: нарушений нет. Миграция и CHECK-ограничение
реализуют инварианты FR-101/FR-102 на уровне хранения, а не только UI. Complexity Tracking пуст.

## Project Structure

### Documentation (this feature)

```text
specs/002-task-priorities/
├── plan.md              # Этот файл (/speckit-plan)
├── research.md          # Phase 0: решения R1–R6
├── data-model.md        # Phase 1: дельта модели данных (колонка priority, миграция, порядок)
├── quickstart.md        # Phase 1: сценарии ручной проверки фичи и регрессии
├── contracts/
│   ├── ui.md            # Дельта контракта UI: метки, легенда, шаг приоритета, пункт подменю
│   └── db-api.md        # Дельта контракта db.js: priority в createTask/updateTask/TaskView, миграция
├── checklists/
│   └── requirements.md  # Чеклист качества спецификации (/speckit-specify)
└── tasks.md             # Создаётся на этапе /speckit-tasks
```

### Source Code (repository root)

Новых файлов в исходном коде нет — изменяются существующие модули:

```text
├── db.js      # миграция колонки priority в initDb; priority в createTask/updateTask/TaskView;
│              # новый ORDER BY в listTasks/listTasksByTag
├── ui.js      # метка приоритета в renderTaskLine; легенда над списком;
│              # select приоритета в форме добавления и в подменю действий
└── index.js   # пункт «Изменить приоритет» в handleTaskActions; передача priority в createTask
```

**Structure Decision**: изменения локализованы в трёх модулях, которые уже задают границы
слоёв (принцип IV). Выделять отдельный модуль «приоритеты» не нужно — для трёх значений
это лишняя абстракция (принцип I).

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

Нарушений конституции нет — таблица остаётся пустой.
