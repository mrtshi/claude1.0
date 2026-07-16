import { readStore } from "../../lib/store";
import { getAllRows, searchTickets, normalize } from "../../lib/dataUtils";

export default async function handler(req, res) {
  const query = (req.query.q || "").toString().trim();

  if (!query) {
    return res.status(400).json({ error: "Введите номер заявки или серийный номер" });
  }

  const store = await readStore();
  const rows = getAllRows(store);
  const matches = searchTickets(rows, query);

  if (!matches.length) {
    return res.status(404).json({ error: "По вашему запросу ничего не найдено" });
  }

  // If multiple work-lines belong to the same ticket, merge into one
  // logical ticket but keep totals summed.
  const byTicket = {};
  for (const row of matches) {
    const key = row.ticketNumber || row.serialNumber;
    if (!byTicket[key]) {
      byTicket[key] = { ...row, sum: 0, totalRub: 0 };
    }
    byTicket[key].sum += row.sum || 0;
    byTicket[key].totalRub += row.totalRub || row.sum || 0;
  }

  const results = Object.values(byTicket).map((r) => ({
    ticketNumber: r.ticketNumber,
    nomenclature: r.nomenclature,
    serialNumber: r.serialNumber,
    executor: r.executor,
    dateReceived: r.dateReceived,
    dateDone: r.dateDone,
    status: r.status,
    location: r.location,
    organization: r.organization,
    malfunction: r.malfunction,
    totalRub: r.totalRub,
  }));

  return res.status(200).json({ results });
}
