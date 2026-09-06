# Runbook: старт таски в новой сессии

Назначение: владелец (или другой агент Hermes) начинает любую таску в **свежей сессии** — контекст и репозиторий подтягиваются автоматически. Пересылаемый шаблон — одна строка.

## Шаблон запроса владельца

```
Работаем по scorm-inspector. Возьми issue #N из
github.com/artmazloev/scorm-inspector и реализуй по протоколу из
docs/runbook-task-session.md. Проект в Hermes: «scorm-inspector».
```

Всё остальное агент найдёт сам (см. «Откуда контекст»).

## Откуда контекст (цепочка для агента)

1. **Hermes-проект** `scorm-inspector` (p_8b214b00) — рабочая папка `/Users/artur/scorm-inspector`, это локальный клон репо (origin: https://github.com/artmazloev/scorm-inspector).
2. **Навык `project-briefing-rules`** — правила совместной работы (язык, E2E, артефакты, критика). Загружать первым.
3. **Issue #N** — `gh issue view N --repo artmazloev/scorm-inspector`: цель, критерий готовности, allowed/forbidden changes, требования RQ-/C-.
4. **docs/requirements.md** — критерии приёмки требований и ограничения must_not_break (C-01…C-04).
5. **docs/context.md** — замысел и архитектура (стек: Next.js + Postgres + SCORM 2004 RTE).
6. **docs/plan.md** — место таски в фазах, соответствие таска ↔ issue.
7. **docs/decisions/** — принятые ADR (не противоречить).

## Протокол выполнения таски (для агента)

1. `gh issue view N --repo artmazloev/scorm-inspector` — прочитать work packet.
2. Перевести issue In Progress в GitHub Project (`gh project item-edit` либо сообщить владельцу).
3. Ветка: `git checkout main && git pull && git checkout -b feat/t-0NN-short-name`.
4. Реализация; запрещённое из issue не трогать.
5. Тесты + E2E-подтверждение критерия готовности (реальный вывод, не «должно работать»).
6. PR с шаблоном `.github/PULL_REQUEST_TEMPLATE.md`, в теле `Closes #N`.
7. CI зелёный → мерж (владелец в UI или агент через `gh pr merge --squash --admin`).
8. Issue закроется автоматически (`Closes #N`); проверить, что в Project item ушёл в Done.
9. Краткий итог владельцу: что сделано, чем подтверждено, что осталось.

## Ограничения (напоминание)

- C-02/C-03: реальные учебные пакеты в репо не заливать — только синтетические фикстуры.
- C-04: стек TypeScript; отступление — через ADR.
- Прямые пуш-коммиты в main запрещены (кроме admin-обхода для мелочей вроде docs — избегать).
- Секреты в отчётах — `[REDACTED]`.

## Если сессия видит незнакомое состояние

- `git status` / `git log --oneline -5` в `/Users/artur/scorm-inspector` — понять, где мы.
- `gh issue list --repo artmazloev/scorm-inspector` — актуальные таски.
- `docs/plan.md` — соответствие таска ↔ issue и фазы.
