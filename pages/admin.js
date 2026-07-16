import { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import Header from "../components/Header";
import UploadCard from "../components/UploadCard";
import DailyChart from "../components/DailyChart";
import RepeatTickets from "../components/RepeatTickets";
import AdvancedSearch from "../components/AdvancedSearch";

const PERIOD_OPTIONS = [
  { value: "", label: "Все время" },
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "2026", label: "2026 год" },
  { value: "2025", label: "2025 год" },
  { value: "2024", label: "2024 год" },
];

const TABS = [
  { key: "overview", label: "Обзор и исполнители" },
  { key: "search", label: "Поиск по столбцам" },
  { key: "repeats", label: "Повторные заявки" },
];

export default function AdminPage() {
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [executor, setExecutor] = useState("");
  const [period, setPeriod] = useState("");
  const [dailyPeriod, setDailyPeriod] = useState("7d");
  const [tab, setTab] = useState("overview");
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/admin/status");
    const data = await res.json();
    setStatus(data);
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    const params = new URLSearchParams();
    if (executor) params.append("executor", executor);
    if (period) params.append("period", period);
    params.append("dailyPeriod", dailyPeriod);
    const res = await fetch(`/api/admin/stats?${params.toString()}`);
    const data = await res.json();
    setStats(data);
    setLoadingStats(false);
  }, [executor, period, dailyPeriod]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function handleReportsChanged() {
    fetchStatus();
    fetchStats();
  }

  return (
    <>
      <Head>
        <title>Панель администратора — Polair</title>
      </Head>
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            Панель администратора
          </h1>
          <Link href="/" className="text-sm text-polair-blue hover:underline">
            ← На страницу поиска
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <UploadCard
            title="Отчёт за 2026 год"
            reportKey="2026"
            status={status?.["2026"]}
            onChanged={handleReportsChanged}
          />
          <UploadCard
            title="Архив 2024–2025 год"
            reportKey="archive"
            status={status?.archive_2024_2025}
            onChanged={handleReportsChanged}
          />
        </div>

        <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? "border-polair-blue text-polair-blue"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Статистика по исполнителю</h3>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <select
                    value={executor}
                    onChange={(e) => setExecutor(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-polair-blue"
                  >
                    <option value="">Все исполнители</option>
                    {stats?.executors?.map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-polair-blue"
                  >
                    {PERIOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {loadingStats ? (
                  <p className="text-sm text-gray-400">Загрузка...</p>
                ) : stats?.executorStats ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <StatBox label="Кол-во заявок" value={stats.executorStats.totalTickets} />
                    <StatBox
                      label="Сумма, руб"
                      value={stats.executorStats.totalSum?.toLocaleString("ru-RU")}
                    />
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-xs text-gray-400 mb-1">По статусам</p>
                      <div className="flex flex-col gap-1">
                        {Object.entries(stats.executorStats.statusCounts || {}).map(
                          ([s, c]) => (
                            <div key={s} className="flex justify-between text-xs">
                              <span className="text-gray-600 truncate pr-2">{s}</span>
                              <span className="font-semibold text-gray-800">{c}</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {stats && (
                <div className="text-xs text-gray-400">
                  Всего строк загружено в систему: {stats.totalRowsLoaded}
                </div>
              )}
            </div>

            <div className="lg:col-span-1 min-w-0">
              {stats && (
                <DailyChart
                  data={stats.daily || []}
                  period={dailyPeriod}
                  onPeriodChange={setDailyPeriod}
                />
              )}
            </div>
          </div>
        )}

        {tab === "search" && <AdvancedSearch />}

        {tab === "repeats" && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">
              Повторные обращения по оборудованию
            </h3>
            <RepeatTickets repeats={stats?.repeats} />
          </div>
        )}
      </main>
    </>
  );
}

function StatBox({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-polair-dark">{value ?? "—"}</p>
    </div>
  );
}
