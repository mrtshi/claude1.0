import { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import Header from "../components/Header";
import UploadCard from "../components/UploadCard";
import DailyChart from "../components/DailyChart";
import RepeatTickets from "../components/RepeatTickets";
import AdvancedSearch from "../components/AdvancedSearch";
import RepairDurationStats from "../components/RepairDurationStats";

const TABS = [
  { key: "overview", label: "Обзор и исполнители" },
  { key: "duration", label: "Сроки ремонта" },
  { key: "search", label: "Поиск по столбцам" },
  { key: "repeats", label: "Повторные заявки" },
];

// Years available for quick selection and per-year columns
const YEAR_BUTTONS = [2024, 2025, 2026];

// Converts an HTML date input value (YYYY-MM-DD) to Russian dd.mm.yyyy
// display format. Returns empty string for empty input.
function formatRuDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
}

export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [executor, setExecutor] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dailyPeriod, setDailyPeriod] = useState("7d");
  const [drillMonth, setDrillMonth] = useState(null);
  const [tab, setTab] = useState("overview");
  // The "Сроки ремонта" tab keeps its own filters (dates, executor)
  // inside the component. To stop them resetting when the user
  // switches tabs, the component is mounted the first time the tab is
  // opened and then kept mounted (just hidden) instead of being
  // destroyed and recreated on every switch.
  const [durationOpened, setDurationOpened] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [statsError, setStatsError] = useState("");

  // The year whose full range (01.01–31.12) is currently selected via
  // the quick buttons; null when a custom date range is set.
  const activeYear =
    YEAR_BUTTONS.find(
      (y) => startDate === `${y}-01-01` && endDate === `${y}-12-31`
    ) ?? null;

  const fetchStatus = useCallback(async () => {
    setStatusError("");
    try {
      const res = await fetch("/api/admin/status");
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Сервер вернул ошибку ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
      }
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("fetchStatus failed", err);
      setStatusError(
        "Не удалось загрузить информацию о загруженных файлах. " +
          (err.message || "Проверьте соединение и попробуйте обновить страницу.")
      );
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError("");
    try {
      const params = new URLSearchParams();
      if (executor) params.append("executor", executor);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("dailyPeriod", dailyPeriod);
      if (drillMonth) params.append("drillMonth", drillMonth);
      const res = await fetch(`/api/admin/stats?${params.toString()}`);
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Сервер вернул ошибку ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("fetchStats failed", err);
      setStats(null);
      setStatsError(
        "Не удалось загрузить статистику. " +
          (err.message || "Проверьте соединение и попробуйте обновить страницу.")
      );
    } finally {
      setLoadingStats(false);
    }
  }, [executor, startDate, endDate, dailyPeriod, drillMonth]);

  // On mount, check whether we already have a valid session cookie
  // before showing either the login screen or the dashboard.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/check-session");
        const data = await res.json();
        setAuthenticated(Boolean(data.authenticated));
      } catch (err) {
        setAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchStatus();
  }, [authenticated, fetchStatus]);

  useEffect(() => {
    if (!authenticated) return;
    fetchStats();
  }, [authenticated, fetchStats]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Неверный пароль");
      } else {
        setAuthenticated(true);
        setPasswordInput("");
      }
    } catch (err) {
      setLoginError("Ошибка соединения с сервером");
    } finally {
      setLoggingIn(false);
    }
  }

  function handleReportsChanged() {
    fetchStatus();
    fetchStats();
  }

  function selectYear(y) {
    if (activeYear === y) {
      setStartDate("");
      setEndDate("");
    } else {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    }
  }

  if (!authChecked) {
    return (
      <>
        <Head>
          <title>Панель администратора — Polair</title>
        </Head>
        <Header />
        <main className="max-w-md mx-auto px-4 py-16 text-center text-gray-400 text-sm">
          Загрузка...
        </main>
      </>
    );
  }

  if (!authenticated) {
    return (
      <>
        <Head>
          <title>Панель администратора — Polair</title>
        </Head>
        <Header />
        <main className="max-w-sm mx-auto px-4 py-16">
          <h1 className="text-xl font-bold text-gray-800 text-center mb-2">
            Панель администратора
          </h1>
          <p className="text-gray-500 text-center text-sm mb-8">
            Введите пароль для доступа к статистике
          </p>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Пароль"
              autoFocus
              className="border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-polair-blue focus:border-transparent text-center tracking-widest"
              inputMode="numeric"
            />
            <button
              type="submit"
              disabled={loggingIn || !passwordInput}
              className="bg-polair-blue hover:bg-polair-dark transition-colors text-white font-medium rounded-lg px-6 py-3 disabled:opacity-60"
            >
              {loggingIn ? "Проверка..." : "Войти"}
            </button>
          </form>
          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mt-4 text-center">
              {loginError}
            </div>
          )}
          <div className="text-center mt-6">
            <Link href="/" className="text-sm text-polair-blue hover:underline">
              ← На страницу поиска
            </Link>
          </div>
        </main>
      </>
    );
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

        {statusError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6 flex items-center justify-between gap-3 flex-wrap">
            <span>{statusError}</span>
            <button
              onClick={fetchStatus}
              className="bg-red-100 hover:bg-red-200 transition-colors text-red-700 text-xs font-medium rounded-md px-3 py-1.5 whitespace-nowrap"
            >
              Повторить попытку
            </button>
          </div>
        )}

        {statsError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6 flex items-center justify-between gap-3 flex-wrap">
            <span>{statsError}</span>
            <button
              onClick={fetchStats}
              className="bg-red-100 hover:bg-red-200 transition-colors text-red-700 text-xs font-medium rounded-md px-3 py-1.5 whitespace-nowrap"
            >
              Повторить попытку
            </button>
          </div>
        )}

        {status && status.durableStorage === false && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm mb-6">
            <strong>Внимание:</strong> не удалось подключиться к
            постоянному хранилищу (Vercel Blob). Загруженные отчёты могут
            периодически пропадать после перезапуска сервера. Проверьте,
            что Blob-хранилище создано и подключено к этому проекту в
            Vercel (Storage → ваш проект должен быть в списке
            подключённых), и что был выполнен <strong>Redeploy</strong>{" "}
            после подключения. Подробности — в README проекта.
          </div>
        )}

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
              onClick={() => {
                setTab(t.key);
                if (t.key === "duration") setDurationOpened(true);
              }}
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
          <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Статистика по исполнителю</h3>

                {/* Quick year selection */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-xs text-gray-400 mr-1">Год:</span>
                  {YEAR_BUTTONS.map((y) => (
                    <button
                      key={y}
                      onClick={() => selectYear(y)}
                      className={`px-4 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                        activeYear === y
                          ? "bg-polair-blue text-white border-polair-blue"
                          : "bg-white text-gray-600 border-gray-300 hover:border-polair-blue hover:text-polair-blue"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
                  <select
                    value={executor}
                    onChange={(e) => setExecutor(e.target.value)}
                    className="w-full sm:flex-1 sm:min-w-[180px] border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-polair-blue"
                  >
                    <option value="">Все исполнители</option>
                    {stats?.executors?.map((ex) => (
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
                        onClick={() => {
                          setStartDate("");
                          setEndDate("");
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
                      >
                        Сбросить
                      </button>
                    )}
                  </div>
                </div>

                {loadingStats ? (
                  <p className="text-sm text-gray-400">Загрузка...</p>
                ) : stats?.executorStats ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatBox label="Уникальных заявок" value={stats.executorStats.totalTickets} />
                    <div>
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

              {stats?.monthlyAverageCheck?.months?.length > 0 && (
                <MonthlyAverageCheck
                  data={stats.monthlyAverageCheck}
                  executor={executor}
                />
              )}

            </div>

            <div className="lg:col-span-1 min-w-0 flex flex-col gap-6">
              {stats && (
                <DailyChart
                  data={stats.daily || []}
                  chartMode={stats.chartMode}
                  drillMonthLabel={stats.drillMonthLabel}
                  period={dailyPeriod}
                  onPeriodChange={(newPeriod) => {
                    setDrillMonth(null);
                    setDailyPeriod(newPeriod);
                  }}
                  onDrillMonth={(monthNum) => setDrillMonth(monthNum)}
                  onBackToMonths={() => setDrillMonth(null)}
                />
              )}

            </div>
          </div>

          {/* Средний чек — колонки по годам */}
          {stats?.yearly && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-800 mb-1">Средний чек по годам</h3>
              <p className="text-xs text-gray-400 mb-4">
                Утверждённые заявки за каждый год{executor ? ` · ${executor}` : ""}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {YEAR_BUTTONS.map((y) => {
                  const yd = stats.yearly[y];
                  return (
                    <div
                      key={y}
                      className="bg-white border border-gray-200 rounded-xl shadow-sm p-4"
                    >
                      <p className="text-xs text-gray-400 mb-1">{y} год</p>
                      {yd && yd.averageCheck !== null ? (
                        <>
                          <p className="text-2xl font-bold text-polair-dark">
                            {yd.averageCheck.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            ₽
                          </p>
                          <p className="text-[11px] text-gray-400 mt-2">
                            По {yd.approvedCount} утверждённым заявкам на сумму{" "}
                            {yd.approvedSum.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            ₽
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 italic">
                          Нет утверждённых заявок за {y} год
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Топ исполнителей — колонки по годам */}
          {stats?.yearly && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-800 mb-1">Топ исполнителей по годам</h3>
              <p className="text-xs text-gray-400 mb-4">
                По количеству уникальных заявок за каждый год
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {YEAR_BUTTONS.map((y) => {
                  const list = stats.yearly[y]?.topExecutors || [];
                  return (
                    <div
                      key={y}
                      className="bg-white border border-gray-200 rounded-xl shadow-sm p-5"
                    >
                      <h4 className="font-semibold text-gray-800 text-sm mb-4">{y} год</h4>
                      {list.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {list.map((e, i) => (
                            <div key={e.executor + i} className="flex items-center gap-3">
                              <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-right">
                                {i + 1}
                              </span>
                              <span
                                className="text-sm text-gray-700 flex-1 min-w-0 truncate"
                                title={e.executor}
                              >
                                {e.executor}
                              </span>
                              <span className="text-sm font-semibold text-polair-dark flex-shrink-0">
                                {e.count}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Нет данных за {y} год</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats?.costBreakdown?.months?.length > 0 && (
          {/* Разбивка стоимости — отдельная таблица за каждый год */}
          {stats?.yearly &&
            YEAR_BUTTONS.map((y) =>
              stats.yearly[y]?.costBreakdown?.months?.length > 0 ? (
                <div className="mt-6" key={y}>
                  <CostBreakdown
                    data={stats.yearly[y].costBreakdown}
                    executor={executor}
                    title={`Разбивка стоимости по месяцам — ${y} год`}
                  />
                </div>
              ) : null
            )}

          {stats && (
            <div className="text-xs text-gray-400 mt-4">
              Всего строк загружено в систему: {stats.totalRowsLoaded}
            </div>
          )}
          </>
        )}

        {durationOpened && (
          <div className={tab === "duration" ? "" : "hidden"}>
            <RepairDurationStats />
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

function fmtMoney(n) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Average check for every month in the data (approved tickets only,
// month = month of "Дата принятия заявки"). Independent of the calendar
// period above; follows the executor filter, like the "Средний чек" box.
function MonthlyAverageCheck({ data, executor }) {
  const { months, total, undatedCount } = data;
  const maxAvg = months.reduce((m, r) => Math.max(m, r.averageCheck || 0), 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <h3 className="font-semibold text-gray-800 text-sm mb-1">Средний чек по месяцам</h3>
      <p className="text-[11px] text-gray-400 mb-3">
        Утверждённые заявки, месяц — по дате принятия. Не зависит от выбранного периода
        {executor ? ` · ${executor}` : ""}
      </p>

      <div className="flex flex-col gap-2.5 max-h-[460px] overflow-y-auto pr-1">
        {months.map((m) => (
          <div key={m.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-gray-700">{m.label}</span>
              <span className="text-[11px] text-gray-400 flex-shrink-0">{m.count} шт.</span>
              <span className="text-sm font-semibold text-polair-dark flex-shrink-0 w-28 text-right">
                {m.averageCheck !== null ? `${fmtMoney(m.averageCheck)} ₽` : "—"}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-polair-blue rounded-full"
                style={{
                  width: maxAvg && m.averageCheck ? `${(m.averageCheck / maxAvg) * 100}%` : "0%",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {total && (
        <div className="border-t border-gray-100 mt-3 pt-3 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-gray-700">Всего</span>
          <span className="text-[11px] text-gray-400">{total.count} шт.</span>
          <span className="text-sm font-bold text-polair-dark w-28 text-right">
            {total.averageCheck !== null ? `${fmtMoney(total.averageCheck)} ₽` : "—"}
          </span>
        </div>
      )}

      {undatedCount > 0 && (
        <p className="text-[11px] text-amber-700 mt-2">
          Не вошли в список: {undatedCount} утверждённых заявок без даты принятия
        </p>
      )}
    </div>
  );
}

function fmtKm(n) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

// Cost breakdown by month (works / parts from responsible storage / own
// parts / transport) with total mileage. Same population as the average
// check: approved tickets, month = month of "Дата принятия заявки". The
// "Общая стоимость" column equals the monthly sum behind the average check.
function CostBreakdown({ data, executor, title = "Разбивка стоимости по месяцам" }) {
  const { months, total, hasOther, undatedCount } = data;

  const columns = [
    { key: "work", label: "Стоимость работ" },
    { key: "storageParts", label: "Запчасти с отв. хранения" },
    { key: "ownParts", label: "Собственные запчасти" },
    { key: "transport", label: "Транспортные расходы" },
    ...(hasOther ? [{ key: "other", label: "Прочее" }] : []),
  ];

  const cellCls = "py-2 pl-3 text-right whitespace-nowrap";

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-400 mb-4">
        Утверждённые заявки, месяц — по дате принятия. Не зависит от выбранного периода
        {executor ? ` · ${executor}` : ""}. «Общая стоимость» равна сумме заявок за месяц,
        на которой строится средний чек. Пробег — километры по строкам «Тран. расходы».
      </p>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-xs min-w-[760px]">
          <thead>
            <tr className="text-gray-400 border-b border-gray-200 align-bottom">
              <th className="py-2 pr-3 text-left font-medium">Месяц</th>
              <th className="py-2 pl-3 text-right font-medium">Заявок</th>
              {columns.map((c) => (
                <th key={c.key} className="py-2 pl-3 text-right font-medium">
                  {c.label}, ₽
                </th>
              ))}
              <th className="py-2 pl-3 text-right font-medium">Пробег общий, км</th>
              <th className="py-2 pl-3 text-right font-medium text-gray-600">Общая стоимость, ₽</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key} className="border-b border-gray-100">
                <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{m.label}</td>
                <td className={`${cellCls} text-gray-500`}>{m.tickets}</td>
                {columns.map((c) => (
                  <td key={c.key} className={`${cellCls} text-gray-700`}>
                    {m.tickets > 0 ? fmtMoney(m[c.key]) : "—"}
                  </td>
                ))}
                <td className={`${cellCls} text-gray-700`}>
                  {m.tickets > 0 ? fmtKm(m.mileage) : "—"}
                </td>
                <td className={`${cellCls} font-semibold text-polair-dark`}>
                  {m.tickets > 0 ? fmtMoney(m.total) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          {total && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold text-gray-800">
                <td className="py-2 pr-3">Всего</td>
                <td className={cellCls}>{total.tickets}</td>
                {columns.map((c) => (
                  <td key={c.key} className={cellCls}>
                    {fmtMoney(total[c.key])}
                  </td>
                ))}
                <td className={cellCls}>{fmtKm(total.mileage)}</td>
                <td className={`${cellCls} text-polair-dark`}>{fmtMoney(total.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {undatedCount > 0 && (
        <p className="text-[11px] text-amber-700 mt-3">
          Не вошли в таблицу: {undatedCount} утверждённых заявок без даты принятия
        </p>
      )}
    </div>
  );
}
