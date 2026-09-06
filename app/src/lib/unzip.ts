/**
 * Распаковка zip-пакета (T-010).
 *
 * Безопасность:
 * - zip-slip: путь каждой записи нормализуется и проверяется, что он остаётся
 *   внутри целевой директории (способы обхода: ../, абсолютные пути, диски).
 * - лимит суммарного распакованного размера (zip bomb) и количества файлов.
 *
 * Распакованные пакеты лежат вне репозитория (C-02/C-03): <DATA_DIR>/<packageId>/.
 */
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";

export class InvalidZipError extends Error {}

export interface UnzipResult {
  /** Относительные пути распакованных файлов (POSIX-стиль, внутри пакета). */
  files: string[];
}

const MAX_TOTAL_UNCOMPRESSED = 512 * 1024 * 1024; // 512 МБ
const MAX_FILES = 10_000;

export function unzipToDir(
  zipBuf: Buffer,
  destDir: string,
): Promise<UnzipResult> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(zipBuf, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(
          new InvalidZipError(
            `Файл не является корректным zip-архивом: ${err?.message ?? "неизвестная ошибка"}`,
          ),
        );
        return;
      }

      const files: string[] = [];
      let totalUncompressed = 0;
      let settled = false;

      const fail = (e: Error) => {
        if (settled) return;
        settled = true;
        // Не оставлять частично распакованный мусор.
        void rm(destDir, { recursive: true, force: true }).finally(() =>
          reject(e),
        );
      };

      const done = () => {
        if (settled) return;
        settled = true;
        resolve({ files });
      };

      zipfile.on("error", (e: Error) =>
        fail(new InvalidZipError(`Ошибка чтения архива: ${e.message}`)),
      );
      zipfile.on("end", done);

      zipfile.on("entry", (entry: yauzl.Entry) => {
        if (files.length + 1 > MAX_FILES) {
          fail(
            new InvalidZipError(
              `В архиве слишком много файлов (лимит ${MAX_FILES})`,
            ),
          );
          return;
        }
        totalUncompressed += entry.uncompressedSize;
        if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
          fail(
            new InvalidZipError(
              "Распакованное содержимое превышает лимит 512 МБ (возможен zip bomb)",
            ),
          );
          return;
        }

        // Каталоги не создаём как файлы; mkdir сделаем при распаковке файлов.
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }

        // Нормализация + защита от zip-slip.
        const normalized = normalize(entry.fileName).split(sep).join("/");
        const resolved = join(destDir, normalized);
        if (
          !resolved.startsWith(destDir + sep) ||
          normalized.startsWith("/") ||
          normalized.split("/").includes("..")
        ) {
          fail(
            new InvalidZipError(
              `Небезопасный путь в архиве: ${entry.fileName}`,
            ),
          );
          return;
        }

        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            fail(
              new InvalidZipError(
                `Не удалось прочитать запись ${entry.fileName}: ${streamErr?.message ?? "?"}`,
              ),
            );
            return;
          }
          const outPath = resolved;
          mkdir(dirname(outPath), { recursive: true })
            .then(() => pipeline(readStream, createWriteStream(outPath)))
            .then(() => {
              files.push(normalized);
              zipfile.readEntry();
            })
            .catch((e: Error) =>
              fail(
                new InvalidZipError(
                  `Ошибка распаковки ${entry.fileName}: ${e.message}`,
                ),
              ),
            );
        });
      });

      zipfile.readEntry();
    });
  });
}
