import { useEffect, useState, useCallback } from "react";

const SEVERITY_STYLES = {
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-800",
};

const SEVERITY_TEXT_COLOR = {
  green: "text-green-700",
  yellow: "text-yellow-700",
  red: "text-red-700",
};

function SeverityBadge({ days, severity }) {
  if (days === null || days === undefined) return <span className="text-gray-400">—</span>;
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_STYLES[severity] || "bg-gray-100 text-gray-600"}`}>
      {days} дн.
    </span>
  );
}

export default function RepairDurationStats() {
  const [executor, setExecutor] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drillExecutor, setDrillExecutor] = useState(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillTickets, setDrillTickets] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (executor) params.append("executor", executor);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
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
  }, [executor, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function openExecutorDrilldown(execName) {
    setDrillExecutor(execName);
    setDrillLoading(true);
    setDrillTickets(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("drillExecutor", execName);
      const res = await fetch(`/api/admin/duration?${params.toString()}`);
      const json = await res.json();
      setDrillTickets(json.drillExecutorTickets || []);
    } catch (e) {
      console.error("Executor drilldown fetch failed", e);
      setDrillTickets([]);
    } finally {
      setDrillLoading(false);
    }
  }

  const stats = data?.durationStats;
  const maxDistribution = stats?.distribution?.reduce(
    (max, d) => Math.max(max, d.count),
    0
  );

  function clearDates() {
    setStartDate("");
    setEndDate("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Сроки выполнения ремонта</h3>
        <p className="text-xs text-gray-400 mb-4">
          Считается как разница между датой принятия заявки и датой выполнения ремонта.{" "}
          <span className="text-green-700 font-medium">До 10 дней — норма</span>,{" "}
          <span className="text-yellow-700 font-medium">11–20 — внимание</span>,{" "}
          <span className="text-red-700 font-medium">от 21 — долго</span>.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
          <select
            value={executor}
            onChange={(e) => setExecutor(e.target.value)}
            className="w-full sm:flex-1 sm:min-w-[180px] border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-polair-blue"
          >
            <option value="">Все исполнители</option>
            {data?.executors?.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-polair-blue"
              aria-label="Начало периода"
            />
            <span className="text-gray-400 text-sm">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-polair-blue"
              aria-label="Конец периода"
            />
            {(startDate || endDate) && (
              <button
                onClick={clearDates}
                className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
              >
                Сбросить
              </button>
            )}
          </div>
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
              <StatBox label="Среднее, дней" value={stats.average ?? "—"} severity={stats.averageSeverity} />
              <StatBox label="Медиана, дней" value={stats.median ?? "—"} severity={stats.medianSeverity} />
              <StatBox label="Минимум, дней" value={stats.min ?? "—"} />
              <StatBox label="Максимум, дней" value={stats.max ?? "—"} severity={getRoughSeverity(stats.max)} />
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

      {data?.topLongest && data.topLongest.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-1">Топ-10 самых долгих заявок</h3>
          <p className="text-xs text-gray-400 mb-4">
            Заявки с наибольшим сроком от принятия до выполнения за выбранный период
          </p>
          <div className="overflow-x-auto -mx-5">
            <div className="px-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-200">
                    <th className="py-2 pr-3">№ заявки</th>
                    <th className="py-2 pr-3">Номенклатура</th>
                    <th className="py-2 pr-3">Исполнитель</th>
                    <th className="py-2 pr-3">Дата принятия</th>
                    <th className="py-2 pr-3">Дата выполнения</th>
                    <th className="py-2">Срок</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topLongest.map((t, i) => (
                    <tr key={t.ticketNumber + i} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-medium text-gray-700 whitespace-nowrap">{t.ticketNumber || "—"}</td>
                      <td className="py-2 pr-3 text-gray-600">{t.nomenclature || "—"}</td>
                      <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{t.executor || "—"}</td>
                      <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{t.dateReceived || "—"}</td>
                      <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{t.dateDone || "—"}</td>
                      <td className="py-2">
                        <SeverityBadge days={t.durationDays} severity={t.severity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {data?.executorRanking && data.executorRanking.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-1">Средний срок по исполнителям</h3>
          <p className="text-xs text-gray-400 mb-4">
            От самого быстрого к самому медленному. Нажмите на исполнителя, чтобы увидеть его
            самые долгие заявки
          </p>
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
                    <tr
                      key={r.executor + i}
                      onClick={() => openExecutorDrilldown(r.executor)}
                      className="border-b border-gray-100 cursor-pointer hover:bg-polair-light transition-colors"
                    >
                      <td className="py-2 pr-3 text-gray-700 font-medium">{r.executor}</td>
                      <td className="py-2 pr-3 text-gray-600">{r.ticketCount}</td>
                      <td className="py-2">
                        <SeverityBadge days={r.average} severity={r.severity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {drillExecutor && (
        <ExecutorDrilldownModal
          executor={drillExecutor}
          loading={drillLoading}
          tickets={drillTickets}
          onClose={() => setDrillExecutor(null)}
        />
      )}
    </div>
  );
}

function getRoughSeverity(days) {
  if (days === null || days === undefined) return null;
  if (days <= 10) return "green";
  if (days <= 20) return "yellow";
  return "red";
}

function StatBox({ label, value, severity }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${severity ? SEVERITY_TEXT_COLOR[severity] : "text-polair-dark"}`}>
        {value}
      </p>
    </div>
  );
}

function ExecutorDrilldownModal({ executor, loading, tickets, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-800">{executor}</h3>
            <p className="text-xs text-gray-500 mt-1">
              Заявки, отсортированные от самой долгой к самой быстрой
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4">
          {loading && <p className="text-sm text-gray-400">Загрузка...</p>}

          {!loading && tickets && tickets.length === 0 && (
            <p className="text-sm text-gray-400 italic">
              Нет заявок с известным сроком выполнения за выбранный период
            </p>
          )}

          {!loading && tickets && tickets.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-2 pr-2">№ заявки</th>
                  <th className="pb-2 pr-2">Номенклатура</th>
                  <th className="pb-2 pr-2">Дата принятия</th>
                  <th className="pb-2 pr-2">Дата выполнения</th>
                  <th className="pb-2">Срок</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t, i) => (
                  <tr key={t.ticketNumber + i} className="border-t border-gray-100">
                    <td className="py-2 pr-2 font-medium text-gray-700 whitespace-nowrap">{t.ticketNumber || "—"}</td>
                    <td className="py-2 pr-2 text-gray-600">{t.nomenclature || "—"}</td>
                    <td className="py-2 pr-2 text-gray-600 whitespace-nowrap">{t.dateReceived || "—"}</td>
                    <td className="py-2 pr-2 text-gray-600 whitespace-nowrap">{t.dateDone || "—"}</td>
                    <td className="py-2">
                      <SeverityBadge days={t.durationDays} severity={t.severity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
