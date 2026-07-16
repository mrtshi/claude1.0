import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const PERIOD_OPTIONS = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "2026", label: "2026 год" },
  { value: "2025", label: "2025 год" },
  { value: "2024", label: "2024 год" },
];

export default function DailyChart({ data, period, onPeriodChange }) {
  const maxItem = data.reduce(
    (max, d) => (d.count > max.count ? d : max),
    { count: -1, date: null }
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col gap-3 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-gray-800 text-sm">Заявки по дням</h3>
        <select
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-polair-blue"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {data.length === 0 ? (
        <div className="text-xs text-gray-400 italic py-8 text-center">Нет данных за выбранный период</div>
      ) : (
        <div className="w-full min-w-0" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={data.length > 15 ? Math.floor(data.length / 8) : 0} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelFormatter={(label) => `Дата: ${label}`}
              />
              <Bar dataKey="count" fill="#0b5ed7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {maxItem.date && (
        <p className="text-xs text-gray-500">
          Больше всего заявок:{" "}
          <span className="font-semibold text-polair-dark">{maxItem.date}</span> (
          {maxItem.count} шт.)
        </p>
      )}
    </div>
  );
}
