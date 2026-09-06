/**
 * Инструмент миграций (T-002). Без внешних зависимостей: psql берётся
 * из контейнера БД через docker compose exec.
 *
 * Применяет по порядку все db/migrations/*.sql, ещё не записанные
 * в таблицу schema_migrations, в одной транзакции на файл.
 *
 * Запуск: npm run migrate  (из корня репо; см. корневой package.json)
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = join(__dirname, "..", "..");
const COMPOSE_FILE = join(REPO_ROOT, "docker-compose.yml");
const MIGRATIONS_DIR = join(REPO_ROOT, "db", "migrations");
const SERVICE = "db";
const PG_USER = process.env.POSTGRES_USER ?? "scorm";
const PG_DB = process.env.POSTGRES_DB ?? "scorm_inspector";

function runInContainer(args: string[], opts: { input?: string } = {}): string {
  return execFileSync(
    "docker",
    ["compose", "-f", COMPOSE_FILE, "exec", "-T", "-e", `PGUSER=${PG_USER}`, "-e", `PGDATABASE=${PG_DB}`, SERVICE, ...args],
    { input: opts.input, encoding: "utf8" },
  );
}

function ensureMigrationsTable(): void {
  runInContainer([
    "psql", "-v", "ON_ERROR_STOP=1", "-q",
    "-c", `CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  ]);
}

function appliedMigrations(): Set<string> {
  const out = runInContainer([
    "psql", "-t", "-A", "-c", "SELECT name FROM schema_migrations ORDER BY name",
  ]);
  return new Set(out.split("\n").filter(Boolean));
}

function applyMigration(name: string, sql: string): void {
  const wrapped = `BEGIN;\n${sql}\nINSERT INTO schema_migrations(name) VALUES ('${name}');\nCOMMIT;`;
  try {
    runInContainer(["psql", "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"], { input: wrapped });
  } catch (err) {
    throw new Error(
      `Миграция ${name} не применилась (транзакция откатена):\n${err instanceof Error ? err.message : err}`,
    );
  }
}

function main(): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log(`Нет файлов миграций в ${MIGRATIONS_DIR}`);
    return;
  }

  ensureMigrationsTable();
  const applied = appliedMigrations();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log(`Миграции актуальны (${files.length} применено ранее).`);
    return;
  }

  for (const name of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, name), "utf8");
    applyMigration(name, sql);
    console.log(`применено: ${name}`);
  }
  console.log(`Готово: применено ${pending.length}, всего файлов миграций: ${files.length}.`);
}

main();
