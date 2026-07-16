import { useState } from "react";

function pluralizeObrashenie(count) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "обращений";
  if (n1 > 1 && n1 < 5) return "обращения";
  if (n1 === 1) return "обращение";
  return "обращений";
}

export default function RepeatTickets({ repeats }) {
  const [activeGroup, setActiveGroup] = useState(null);

  if (!repeats || repeats.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic py-8 text-center">
        Повторных обращений по одному и тому же оборудованию не найдено
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {repeats.map((group, idx) => (
          <button
            key={group.key + idx}
            onClick={() => setActiveGroup(idx)}
            className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-polair-light hover:border-polair-blue/40 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
          >
            <div className="text-sm">
              <span className="font-medium text-gray-800">{group.nomenclature || "Оборудование"}</span>
              <span className="text-gray-400"> · Зав.№ {group.serialNumber || "—"}</span>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-3">
              <span>{group.location || "адрес не указан"}</span>
              <span className="font-medium text-polair-blue">{group.executor || "—"}</span>
              <span className="bg-orange-100 text-orange-700 rounded-full px-2.5 py-1 font-semibold whitespace-nowrap">
                {group.visits.length} {pluralizeObrashenie(group.visits.length)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {activeGroup !== null && repeats[activeGroup] && (
        <RepeatDetailModal
          group={repeats[activeGroup]}
          onClose={() => setActiveGroup(null)}
        />
      )}
    </>
  );
}

function RepeatDetailModal({ group, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-800">
              {group.nomenclature || "Оборудование"}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Зав.№ {group.serialNumber || "—"} · {group.location || "адрес не указан"} ·{" "}
              <span className="text-polair-blue font-medium">{group.executor || "—"}</span>
            </p>
            <span className="inline-block mt-2 bg-orange-100 text-orange-700 rounded-full px-2.5 py-1 text-xs font-semibold">
              {group.visits.length} {pluralizeObrashenie(group.visits.length)}
            </span>
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
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-2 pr-2 font-medium text-gray-700">{v.ticketNumber || "—"}</td>
                  <td className="py-2 pr-2 text-gray-600">{v.dateReceived || "—"}</td>
                  <td className="py-2 pr-2 text-gray-600">{v.dateDone || "—"}</td>
                  <td className="py-2 pr-2 text-gray-600">{v.malfunction || "—"}</td>
                  <td className="py-2 text-gray-600">{v.status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {group.visits.length > 1 && (
            <p className="text-xs text-gray-400 mt-3">
              Предыдущий выезд: {group.visits[1].dateReceived || "—"}
              {group.visits[1].dateDone ? ` (выполнен ${group.visits[1].dateDone})` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
