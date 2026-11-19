import { readStore } from "../../lib/store";
import { getAllRows, searchTickets, dedupeByTicket } from "../../lib/dataUtils";
import { ADMIN_PASSWORD, buildSessionCookieHeader } from "../../lib/adminSession";

export default async function handler(req, res) {
  // The search box sends its text in a POST body. GET with ?q= still works
  // for plain searches, but see below: it can never open the admin panel.
  const isPost = req.method === "POST";
  const query = String((isPost ? req.body?.q : req.query.q) ?? "").trim();

  if (!query) {
    return res.status(400).json({ error: "Введите номер заявки или серийный номер" });
  }

  // Hidden entry to the admin panel: typing the admin password into the
  // public search box opens an admin session. Accepted only via POST so
  // the password never ends up in a URL / query string (those get written
  // to server logs).
  if (isPost && query === ADMIN_PASSWORD) {
    res.setHeader("Set-Cookie", buildSessionCookieHeader());
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ admin: true });
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
