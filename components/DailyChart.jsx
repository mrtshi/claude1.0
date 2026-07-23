import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const PERIOD_OPTIONS = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "2026", label: "2026 год" },
  { value: "2025", label: "2025 год" },
  { value: "2024", label: "2024 год" },
];

function CustomYAxisTick({ x, y, payload }) {
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fontSize={11}
      fill="#4b5563"
      fontFamily="inherit"
    >
      {payload.value}
    </text>
  );
}

function CustomXAxisTick({ x, y, payload }) {
  return (
    <text
      x={x}
      y={y}
      dy={12}
      textAnchor="middle"
      fontSize={11}
      fill="#4b5563"
      fontFamily="inherit"
    >
      {payload.value}
    </text>
  );
}

function ChartBody({ data, height, tickInterval, onBarClick, clickable, chartKey }) {
  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer key={chartKey} width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f6" />
          <XAxis
            dataKey="date"
            interval={tickInterval}
            tick={<CustomXAxisTick />}
          />
          <YAxis
            allowDecimals={false}
            width={50}
            tick={<CustomYAxisTick />}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            labelFormatter={(label) => label}
          />
          <Bar
            dataKey="count"
            fill="#0b5ed7"
            radius={[4, 4, 0, 0]}
            cursor={clickable ? "pointer" : "default"}
            onClick={clickable ? (entry) => onBarClick?.(entry) : undefined}
          />
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

const YEAR_PERIODS = new Set(["2026", "2025", "2024"]);

export default function DailyChart({
  data,
  chartMode,
  drillMonthLabel,
  period,
  onPeriodChange,
  onDrillMonth,
  onBackToMonths,
}) {
  const [expanded, setExpanded] = useState(false);

  const maxItem = data.reduce(
    (max, d) => (d.count > max.count ? d : max),
    { count: -1, date: null }
  );

  const isMonthlyView = chartMode === "monthly";
  const isDrilledIntoMonth = chartMode === "daily" && YEAR_PERIODS.has(period) && drillMonthLabel;

  const compactTickInterval = data.length > 15 ? Math.floor(data.length / 8) : 0;
  const expandedTickInterval = data.length > 40 ? Math.floor(data.length / 20) : 0;

  function handleBarClick(entry) {
    if (isMonthlyView && entry && entry.month) {
      onDrillMonth?.(entry.month);
    }
  }

  const title = isDrilledIntoMonth
    ? `Заявки по дням — ${drillMonthLabel}`
    : isMonthlyView
    ? "Заявки по месяцам"
    : "Заявки по дням";

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col gap-3 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {isDrilledIntoMonth && (
              <button
                onClick={() => onBackToMonths?.()}
                title="Назад к месяцам"
                aria-label="Назад к месяцам"
                className="text-gray-400 hover:text-polair-blue transition-colors p-1 -ml-1 rounded-md hover:bg-polair-light flex-shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <h3 className="font-semibold text-gray-800 text-sm truncate">{title}</h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
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

        {isMonthlyView && (
          <p className="text-[11px] text-gray-400 -mt-1">Нажмите на месяц, чтобы увидеть заявки по дням</p>
        )}

        {data.length === 0 ? (
          <div className="text-xs text-gray-400 italic py-8 text-center">Нет данных за выбранный период</div>
        ) : (
          <ChartBody
            data={data}
            height={180}
            tickInterval={compactTickInterval}
            clickable={isMonthlyView}
            onBarClick={handleBarClick}
            chartKey={`compact-${chartMode}-${period}-${drillMonthLabel || ""}`}
          />
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
              <div className="flex items-center gap-2 min-w-0">
                {isDrilledIntoMonth && (
                  <button
                    onClick={() => onBackToMonths?.()}
                    className="text-gray-400 hover:text-polair-blue transition-colors p-1 rounded-md hover:bg-polair-light flex-shrink-0"
                    aria-label="Назад к месяцам"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                )}
                <h3 className="font-semibold text-gray-800 text-lg truncate">{title}</h3>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
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

            {isMonthlyView && (
              <p className="text-xs text-gray-400 -mt-2 mb-3">Нажмите на месяц, чтобы увидеть заявки по дням</p>
            )}

            {data.length === 0 ? (
              <div className="text-sm text-gray-400 italic py-16 text-center">
                Нет данных за выбранный период
              </div>
            ) : (
              <ChartBody
                data={data}
                height={420}
                tickInterval={expandedTickInterval}
                clickable={isMonthlyView}
                onBarClick={(entry) => {
                  handleBarClick(entry);
                }}
                chartKey={`expanded-${chartMode}-${period}-${drillMonthLabel || ""}`}
              />
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
