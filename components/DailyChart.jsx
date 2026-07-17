import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const PERIOD_OPTIONS = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "2026", label: "2026 год" },
  { value: "2025", label: "2025 год" },
  { value: "2024", label: "2024 год" },
];

function ChartBody({ data, height, tickInterval }) {
  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" debounce={50}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f6" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            interval={tickInterval}
          />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={30} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            labelFormatter={(label) => `Дата: ${label}`}
          />
          <Bar dataKey="count" fill="#0b5ed7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PeriodSelect({ period, onPeriodChange, className }) {
  return (
    <select
      value={period}
      onChange={(e) => onPeriodChange(e.target.value)}
      className={
        className ||
        "text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-polair-blue"
      }
    >
      {PERIOD_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default function DailyChart({ data, period, onPeriodChange }) {
  const [expanded, setExpanded] = useState(false);

  const maxItem = data.reduce(
    (max, d) => (d.count > max.count ? d : max),
    { count: -1, date: null }
  );

  const compactTickInterval = data.length > 15 ? Math.floor(data.length / 8) : 0;
  const expandedTickInterval = data.length > 40 ? Math.floor(data.length / 20) : 0;

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col gap-3 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-800 text-sm">Заявки по дням</h3>
          <div className="flex items-center gap-2">
            <PeriodSelect period={period} onPeriodChange={onPeriodChange} />
            <button
              onClick={() => setExpanded(true)}
              title="Развернуть график"
              aria-label="Развернуть график"
              className="text-gray-400 hover:text-polair-blue transition-colors p-1 rounded-md hover:bg-polair-light"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h6v6" />
                <path d="M9 21H3v-6" />
                <path d="M21 3l-7 7" />
                <path d="M3 21l7-7" />
              </svg>
            </button>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="text-xs text-gray-400 italic py-8 text-center">Нет данных за выбранный период</div>
        ) : (
          <ChartBody data={data} height={180} tickInterval={compactTickInterval} />
        )}

        {maxItem.date && (
          <p className="text-xs text-gray-500">
            Больше всего заявок:{" "}
            <span className="font-semibold text-polair-dark">{maxItem.date}</span> (
            {maxItem.count} шт.)
          </p>
        )}
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="font-semibold text-gray-800 text-lg">Заявки по дням</h3>
              <div className="flex items-center gap-3">
                <PeriodSelect
                  period={period}
                  onPeriodChange={onPeriodChange}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-polair-blue"
                />
                <button
                  onClick={() => setExpanded(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1"
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
            </div>

            {data.length === 0 ? (
              <div className="text-sm text-gray-400 italic py-16 text-center">
                Нет данных за выбранный период
              </div>
            ) : (
              <ChartBody data={data} height={420} tickInterval={expandedTickInterval} />
            )}

            {maxItem.date && (
              <p className="text-sm text-gray-500 mt-4">
                Больше всего заявок:{" "}
                <span className="font-semibold text-polair-dark">{maxItem.date}</span> (
                {maxItem.count} шт.)
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
