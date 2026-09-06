import Link from "next/link";

const routes = [
  { href: "/upload", label: "Загрузка пакета" },
  { href: "/packages", label: "Пакеты" },
  { href: "/report", label: "Отчёт" },
  { href: "/play", label: "Плеер" },
];

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">SCORM Inspector</h1>
      <ul className="mt-4 space-y-2">
        {routes.map((r) => (
          <li key={r.href}>
            <Link className="text-blue-600 underline" href={r.href}>
              {r.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
