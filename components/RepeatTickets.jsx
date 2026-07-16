import { useState } from "react";

export default function RepeatTickets({ repeats }) {
  const [expanded, setExpanded] = useState(null);

  if (!repeats || repeats.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic py-8 text-center">
        Повторных обращений по одному и тому же оборудованию не найдено
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {repeats.map((group, idx) => (
        <div
          key={group.key + idx}
          className="border border-gray-200 rounded-lg overflow-hidden"
        >
          <button
            onClick={() => setExpanded(expanded === idx ? null : idx)}
            className="w-full text-left px-4 py-3 bg-white hover:bg-polair-light transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
          >
            <div className="text-sm">
              <span className="font-medium text-gray-800">{group.nomenclature || "Оборудование"}</span>
              <span className="text-gray-400"> · Зав.№ {group.serialNumber || "—"}</span>
            </div>
            <div className="text-xs text-gray-500 flex gap-3">
              <span>{group.location || "адрес не указан"}</span>
              <span className="font-medium text-polair-blue">{group.executor || "—"}</span>
              <span className="bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-semibold">
                {group.visits.length} обращ.
              </span>
            </div>
          </button>

          {expanded === idx && (
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-left">
                    <th className="pb-2 pr-2">№ заявки</th>
                    <th className="pb-2 pr-2">Дата принятия</th>
                    <th className="pb-2 pr-2">Дата выполнения</th>
                    <th className="pb-2 pr-2">Неисправность</th>
                    <th className="pb-2">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {group.visits.map((v, i) => (
                    <tr key={i} className="border-t border-gray-200">
                      <td className="py-2 pr-2 font-medium text-gray-700">{v.ticketNumber || "—"}</td>
                      <td className="py-2 pr-2 text-gray-600">{v.dateReceived || "—"}</td>
                      <td className="py-2 pr-2 text-gray-600">{v.dateDone || "—"}</td>
                      <td className="py-2 pr-2 text-gray-600">{v.malfunction || "—"}</td>
                      <td className="py-2 text-gray-600">{v.status || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
