/**
 * POST /api/upload — приём zip-пакета (T-010, RQ-010).
 *
 * multipart/form-data, поле `file`. Поток:
 * 1. чтение файла, проверка zip-сигнатуры;
 * 2. дедуп по sha256 (повторная загрузка того же файла → существующая запись);
 * 3. вставка записи в packages;
 * 4. распаковка в <DATA_DIR>/<packageId>/ (вне репозитория, C-02/C-03).
 *
 * Ошибки: 400 {error} — не zip / битый архив; 500 — прочее.
 */
import { NextResponse } from "next/server";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { findPackageBySha, getPool, insertPackage, sha256 } from "@/lib/db";
import { InvalidZipError, unzipToDir } from "@/lib/unzip";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 МБ
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// Пакеты храним вне репозитория (C-02/C-03). Переопределяется SCORM_DATA_DIR.
export function dataDir(): string {
  return (
    process.env.SCORM_DATA_DIR ??
    join(homedir(), ".scorm-inspector", "packages")
  );
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Ожидается multipart/form-data с полем file" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Не передан файл (поле file)" },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `Файл больше лимита ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ`,
      },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!buf.subarray(0, 4).equals(ZIP_MAGIC)) {
    return NextResponse.json(
      { error: "Это не zip-архив (файл должен быть SCORM-пакетом .zip)" },
      { status: 400 },
    );
  }

  const hash = await sha256(buf);

  // Дедуп: тот же файл уже загружен — отдаём существующую запись, не распаковываем заново.
  const existing = await findPackageBySha(hash);
  if (existing) {
    return NextResponse.json({
      package: existing,
      deduplicated: true,
      files: null,
    });
  }

  let pkg;
  try {
    pkg = await insertPackage({
      title: file.name.replace(/\.zip$/i, ""),
      fileName: file.name,
      sha256: hash,
      sizeBytes: file.size,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Ошибка записи в БД: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  const destDir = join(dataDir(), pkg.id);
  try {
    await mkdir(destDir, { recursive: true });
    const { files } = await unzipToDir(buf, destDir);
    return NextResponse.json(
      { package: pkg, deduplicated: false, files: files.length },
      { status: 201 },
    );
  } catch (e) {
    // Откатываем запись в БД — пакет не распакован, «мёртвых» записей не оставляем.
    await getPool().query("DELETE FROM packages WHERE id = $1", [pkg.id]);
    if (e instanceof InvalidZipError) {
      return NextResponse.json(
        { error: `Битый zip-архив: ${e.message}` },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: `Ошибка распаковки: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
