"use client";

/**
 * Страница загрузки пакета (T-010, RQ-010): drag-n-drop + выбор файла,
 * POST /api/upload, показ результата или понятной ошибки.
 */
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface UploadResult {
  package: { id: string; title: string; file_name: string };
  deduplicated: boolean;
  files: number | null;
}

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const upload = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res
        .json()
        .catch(() => ({
          error: `Некорректный ответ сервера (HTTP ${res.status})`,
        }));
      if (!res.ok) {
        setError(data.error ?? `Ошибка загрузки (HTTP ${res.status})`);
      } else {
        setResult(data as UploadResult);
      }
    } catch (e) {
      setError(`Сеть недоступна: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Загрузка пакета</h1>
      <p className="mt-2 text-gray-500">
        Перетащите zip-архив SCORM 2004 (3rd/4th ed.) или выберите файл.
      </p>

      <div
        role="button"
        aria-label="Зона загрузки пакета"
        data-testid="dropzone"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void upload(f);
        }}
        className={`mt-6 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        {busy ? (
          <p className="text-blue-600" data-testid="upload-busy">
            Загрузка и распаковка…
          </p>
        ) : (
          <>
            <p className="text-lg">📦 Отпустите файл здесь</p>
            <p className="text-sm text-gray-500">
              или нажмите, чтобы выбрать .zip
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div
          className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700"
          data-testid="upload-error"
        >
          <p className="font-semibold">Ошибка</p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div
          className="mt-4 rounded-lg border border-green-300 bg-green-50 p-4"
          data-testid="upload-success"
        >
          {result.deduplicated ? (
            <p className="text-green-800">
              Такой пакет уже загружен (дедупликация по sha256):{" "}
              <strong>{result.package.title}</strong>
            </p>
          ) : (
            <p className="text-green-800">
              Пакет загружен: <strong>{result.package.title}</strong>,
              распаковано файлов: {result.files}
            </p>
          )}
          <p className="mt-1 text-sm text-gray-600">
            ID пакета: {result.package.id}
          </p>
          <button
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onClick={() => router.push(`/report/${result.package.id}`)}
          >
            Перейти к отчёту
          </button>
        </div>
      )}
    </main>
  );
}
