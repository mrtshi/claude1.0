import { useState, useEffect } from "react";

const TEXT_FIELDS = [
  { key: "serialNumber", label: "Заводской №" },
  { key: "location", label: "Местонахождение оборудования" },
];

export default function AdvancedSearch() {
  const [filters, setFilters] = useState({});
  const [statuses, setStatuses] = useState([]);
  const [executors, setExecutors] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/statuses");
        if (!res.ok) return;
        const data = await res.json();
        setStatuses(data.statuses || []);
      } catch (e) {
        console.error("Failed to load statuses", e);
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/admin/executors");
        if (!res.ok) return;
        const data = await res.json();
        setExecutors(data.executors || []);
      } catch (e) {
        console.error("Failed to load executors", e);
      }
    })();
  }, []);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSearch() {
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
      const res = await fetch(`/api/admin/columnSearch?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка поиска");
      } else {
        setResults(data.results);
      }
    } catch (e) {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setFilters({});
    setResults(null);
    setError("");
  }

  const hasActiveInput =
    Object.values(filters).some((v) => v) || results !== null || error;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col gap-4">
      <h3 className="font-semibold text-gray-800">Поиск по столбцам</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TEXT_FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">{f.label}</label>
            <input
              type="text"
              value={filters[f.key] || ""}
              onChange={(e) => updateFilter(f.key, e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-polair-blue"
              placeholder={`Введите ${f.label.toLowerCase()}`}
            />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Исполнитель</label>
          <select
            value={filters.executor || ""}
            onChange={(e) => updateFilter("executor", e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-polair-blue"
          >
            <option value="">Все исполнители</option>
            {executors.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Статус заявки в Фениксе</label>
          <select
            value={filters.status || ""}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-polair-blue"
          >
            <option value="">Любой статус</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-polair-blue hover:bg-polair-dark transition-colors text-white text-sm font-medium rounded-lg px-5 py-2 disabled:opacity-60"
        >
          {loading ? "Поиск..." : "Искать"}
        </button>
        {hasActiveInput && (
          <button
            onClick={handleClear}
            className="bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 text-sm font-medium rounded-lg px-5 py-2"
          >
            Очистить
          </button>
        )}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {results && (
        <div className="overflow-x-auto -mx-5">
          <div className="px-5">
            <p className="text-xs text-gray-500 mb-2">Найдено: {results.length}</p>
            {results.length > 0 && (
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-200">
                    <th className="py-2 pr-3">№ заявки</th>
                    <th className="py-2 pr-3">Зав. №</th>
                    <th className="py-2 pr-3">Местонахождение</th>
                    <th className="py-2 pr-3">Исполнитель</th>
                    <th className="py-2">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-medium text-gray-700">{r.ticketNumber}</td>
                      <td className="py-2 pr-3 text-gray-600">{r.serialNumber}</td>
                      <td className="py-2 pr-3 text-gray-600">{r.location}</td>
                      <td className="py-2 pr-3 text-gray-600">{r.executor}</td>
                      <td className="py-2 text-gray-600">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
