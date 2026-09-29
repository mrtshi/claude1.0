import { useEffect, useState, useCallback } from "react";

const PERIOD_OPTIONS = [
  { value: "", label: "Все время" },
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "2026", label: "2026 год" },
  { value: "2025", label: "2025 год" },
  { value: "2024", label: "2024 год" },
];

export default function RepairDurationStats() {
  const [executor, setExecutor] = useState("");
  const [period, setPeriod] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (executor) params.append("executor", executor);
      if (period) params.append("period", period);
      const res = await fetch(`/api/admin/duration?${params.toString()}`);
      if (res.status === 401) {
        setError("Требуется авторизация. Обновите страницу и войдите заново.");
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Сервер вернул ошибку ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("RepairDurationStats fetch failed", e);
      setError("Не удалось загрузить статистику. " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  }, [executor, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = data?.durationStats;
  const maxDistribution = stats?.distribution?.reduce(
    (max, d) => Math.max(max, d.count),
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Сроки выполнения ремонта</h3>
        <p className="text-xs text-gray-400 mb-4">
          Считается как разница между датой принятия заявки и датой выполнения ремонта
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <select
            value={executor}
            onChange={(e) => setExecutor(e.target.value)}
            className="w-full sm:flex-1 sm:min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-polair-blue"
          >
            <option value="">Все исполнители</option>
            {data?.executors?.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full sm:w-auto sm:flex-shrink-0 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-polair-blue"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
            <span>{error}</span>
            <button
              onClick={fetchData}
              className="bg-red-100 hover:bg-red-200 transition-colors text-red-700 text-xs font-medium rounded-md px-3 py-1.5 whitespace-nowrap"
            >
              Повторить попытку
            </button>
          </div>
        )}

        {loading && !stats && <p className="text-sm text-gray-400">Загрузка...</p>}

        {stats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <StatBox label="Среднее, дней" value={stats.average ?? "—"} />
              <StatBox label="Медиана, дней" value={stats.median ?? "—"} />
              <StatBox label="Минимум, дней" value={stats.min ?? "—"} />
              <StatBox label="Максимум, дней" value={stats.max ?? "—"} />
            </div>

            <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 mb-5">
              <span>
                Учтено заявок с известным сроком:{" "}
                <span className="font-semibold text-gray-700">{stats.ticketsWithDuration}</span>
              </span>
              {stats.notCompletedCount > 0 && (
                <span>
                  Ещё не выполнено (нет даты выполнения):{" "}
                  <span className="font-semibold text-gray-700">{stats.notCompletedCount}</span>
                </span>
              )}
              {stats.invalidCount > 0 && (
                <span>
                  Некорректные даты:{" "}
                  <span className="font-semibold text-gray-700">{stats.invalidCount}</span>
                </span>
              )}
            </div>

            {stats.ticketsWithDuration === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Нет заявок с одновременно заполненной датой принятия и датой выполнения за
                выбранный период
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-500 mb-1">Распределение по срокам</p>
                {stats.distribution.map((d) => (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-28 flex-shrink-0">{d.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden min-w-0">
                      <div
                        className="bg-polair-blue h-full rounded-full transition-all"
                        style={{
                          width: maxDistribution
                            ? `${Math.max((d.count / maxDistribution) * 100, d.count > 0 ? 4 : 0)}%`
                            : "0%",
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-10 text-right flex-shrink-0">
                      {d.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {data?.executorRanking && data.executorRanking.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-1">Средний срок по исполнителям</h3>
          <p className="text-xs text-gray-400 mb-4">От самого быстрого к самому медленному</p>
          <div className="overflow-x-auto -mx-5">
            <div className="px-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-200">
                    <th className="py-2 pr-3">Исполнитель</th>
                    <th className="py-2 pr-3">Заявок с известным сроком</th>
                    <th className="py-2">Средний срок, дней</th>
                  </tr>
                </thead>
                <tbody>
                  {data.executorRanking.map((r, i) => (
                    <tr key={r.executor + i} className="border-b border-gray-100">
                      <td className="py-2 pr-3 text-gray-700 font-medium">{r.executor}</td>
                      <td className="py-2 pr-3 text-gray-600">{r.ticketCount}</td>
                      <td className="py-2 text-gray-600 font-semibold">{r.average}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-polair-dark">{value}</p>
    </div>
  );
}
