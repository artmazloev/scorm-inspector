# База данных (T-002)

## Состав

- `migrations/001_init.sql` — схема: `users`, `packages`, `findings`, `comments`, `sessions`.
- `app/scripts/migrate.ts` — инструмент миграций (TS, без внешних зависимостей:
  psql выполняется внутри контейнера БД). Реестр применённых — таблица `schema_migrations`.

## Запуск

```bash
docker compose up -d          # поднимает Postgres (порт 5432 по умолчанию)
npm run migrate               # применяет миграции одной командой
```

Повторный `npm run migrate` — no-op («Миграции актуальны»).

## Переменные

`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` — см. `.env.example`.
Локальные креды по умолчанию (scorm/scorm) — только для разработки.

## Замечания

- Таблица `users` — хранение аккаунтов; логика auth добавляется в T-040 (по issue — не подключать).
- Содержимое пакетов в БД не хранится (только метаданные, находки, комментарии) — C-02/C-03.
