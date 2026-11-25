# Контракт db.js (дельта): Приоритеты задач

**Feature**: 002-task-priorities | **Date**: 2026-11-25

Дельта к [контракту MVP](../../001-cli-task-tracker/contracts/db-api.md). Все функции остаются
синхронными; SQL по-прежнему только в `db.js` (принцип IV). Модель —
[data-model.md](../data-model.md).

## Инициализация

```js
initDb(dbPath) -> void
```

- Дополнительно к созданию таблиц: если в `tasks` нет колонки `priority`, добавляет её
  (миграция, research.md R2).
- Идемпотентно: повторный вызов не меняет схему и данные.
- Не теряет строк существующих задач.

## Операции над задачами

```js
createTask(title, tagNames[], priority = 'medium') -> { id }
```
- `priority` — одно из `'high' | 'medium' | 'low'`; иное значение → `Error('Недопустимый приоритет')`.
- Остальное поведение без изменений (валидация названия, нормализация тегов, транзакция).

```js
listTasks() -> TaskView[]
listTasksByTag(tagName) -> TaskView[]
```
- Порядок: `is_completed ASC`, затем ранг приоритета, затем `created_at DESC, id DESC`
  (см. data-model.md, «Представление списка»).

```js
getTask(id) -> TaskView | undefined
toggleTask(id) -> newIsCompleted (0|1)
deleteTask(id) -> void
```
- Без изменений; `toggleTask` не меняет приоритет.

```js
updateTask(id, { title?, tagNames?, priority? }) -> void
```
- Обновляет переданные поля; `priority` проверяется как в `createTask`.
- Несуществующий `id` → `Error` (как в MVP).

## TaskView (дельта)

```js
TaskView = {
  id, title, is_completed, created_at, tags: string[],
  priority: 'high' | 'medium' | 'low'   // новое поле
}
```

## Списки тегов

```js
listUsedTags() -> { id, name }[]
```
- Без изменений.

## Инварианты (дельта)

1. Колонка `priority` всегда содержит одно из трёх значений (CHECK в БД + проверка в `db.js`).
2. Миграция не изменяет статусы, теги и названия существующих задач.
3. Изменение приоритета — атомарная транзакция, как и любая запись (инвариант 3 из MVP).
