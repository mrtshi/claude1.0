import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Header from "../components/Header";

const STATUS_COLORS = {
  "утвержден": "bg-green-100 text-green-800",
  "в работе": "bg-yellow-100 text-yellow-800",
  "отклонен": "bg-red-100 text-red-800",
};

function statusClass(status) {
  const key = (status || "").toLowerCase();
  for (const [k, v] of Object.entries(STATUS_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "bg-gray-100 text-gray-800";
}

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  async function handleSearch(e) {
    e?.preventDefault();
    setError("");
    setResults(null);

    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      // POST, so that if the text is the admin password it travels in the
      // request body and not in the URL (URLs end up in server logs).
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ничего не найдено");
      } else if (data.admin) {
        // The text was the admin password: the server has opened an admin
        // session, go to the panel.
        router.push("/admin");
      } else {
        setResults(data.results);
      }
    } catch (err) {
      setError("Ошибка соединения с сервером. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Отслеживание заявок на ремонт оборудования</title>
      </Head>
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center mb-8">
          Отслеживание заявок на ремонт оборудования
        </h1>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Номер заявки или серийный номер"
            className="ym-disable-keys flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-polair-blue focus:border-transparent"
            inputMode="numeric"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-polair-blue hover:bg-polair-dark transition-colors text-white font-medium rounded-lg px-6 py-3 disabled:opacity-60"
          >
            {loading ? "Поиск..." : "Найти"}
          </button>
        </form>

        <p className="text-gray-500 text-center mb-8 text-sm sm:text-base">
          Введите номер заявки или серийный номер оборудования для получения информации
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        {results && results.length > 0 && (
          <div className="space-y-4">
            {results.map((r, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl shadow-sm p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">
                    Заявка № {r.ticketNumber || "—"}
                  </span>
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${statusClass(
                      r.status
                    )}`}
                  >
                    {r.status || "Статус не указан"}
                  </span>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Row label="Номенклатура" value={r.nomenclature} full />
                  <Row label="Серийный номер" value={r.serialNumber} />
                  <Row label="Исполнитель" value={r.executor} />
                  <Row label="Дата заявки" value={r.dateReceived} />
                  <Row label="Дата выполнения" value={r.dateDone} />
                  <Row label="Организация" value={r.organization} />
                  <Row label="Местонахождение" value={r.location} full />
                  {r.malfunction && <Row label="Неисправность" value={r.malfunction} full />}
                </dl>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function Row({ label, value, full }) {
  if (!value) return null;
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-gray-400 text-xs">{label}</dt>
      <dd className="text-gray-800 font-medium">{value}</dd>
    </div>
  );
}
