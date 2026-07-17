import { readStore } from "../../lib/store";
import { getAllRows, searchTickets, dedupeByTicket } from "../../lib/dataUtils";

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
  const tickets = dedupeByTicket(matches);

  const results = tickets.map((r) => ({
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
    totalRub: r.sum,
  }));

  return res.status(200).json({ results });
}
