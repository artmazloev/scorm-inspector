/**
 * Работа с БД для загрузки пакетов (T-010).
 *
 * Подключение напрямую к Postgres из docker-compose (localhost:5432),
 * без ORM — параметризованные запросы через pg.
 */
import { Pool } from "pg";
import { createHash } from "node:crypto";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.PGHOST ?? "127.0.0.1",
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.POSTGRES_USER ?? "scorm",
      password: process.env.POSTGRES_PASSWORD ?? "scorm",
      database: process.env.POSTGRES_DB ?? "scorm_inspector",
      max: 5,
    });
  }
  return pool;
}

/** Служебный пользователь до появления auth (см. миграцию 002_system_user.sql). */
export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

export interface PackageRecord {
  id: string;
  title: string;
  file_name: string;
  file_sha256: string;
  size_bytes: string;
  created_at: Date;
}

export async function sha256(buf: Buffer): Promise<string> {
  return createHash("sha256").update(buf).digest("hex");
}

export async function insertPackage(rec: {
  title: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
}): Promise<PackageRecord> {
  const res = await getPool().query<PackageRecord>(
    `INSERT INTO packages (uploaded_by, title, file_name, file_sha256, size_bytes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, file_name, file_sha256, size_bytes, created_at`,
    [SYSTEM_USER_ID, rec.title, rec.fileName, rec.sha256, rec.sizeBytes],
  );
  return res.rows[0];
}

/** Сохранить определённую парсером версию SCORM (T-011). Версия null сбрасывает поле. */
export async function updatePackageScormVersion(
  packageId: string,
  version: string | null,
): Promise<void> {
  await getPool().query(
    "UPDATE packages SET scorm_version = $2 WHERE id = $1",
    [packageId, version],
  );
}

/** Дубликат по sha256 — не ошибка, возвращаем существующую запись. */
export async function findPackageBySha(
  sha: string,
): Promise<PackageRecord | null> {
  const res = await getPool().query<PackageRecord>(
    `SELECT id, title, file_name, file_sha256, size_bytes, created_at
     FROM packages WHERE file_sha256 = $1 LIMIT 1`,
    [sha],
  );
  return res.rows[0] ?? null;
}
