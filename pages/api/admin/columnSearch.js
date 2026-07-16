import { readStore } from "../../../lib/store";
import { getAllRows, advancedSearch, dedupeByTicket } from "../../../lib/dataUtils";

const ALLOWED_FIELDS = [
  "nomenclature",
  "location",
  "serialNumber",
  "executor",
  "dateReceived",
  "dateDone",
  "status",
];

export default async function handler(req, res) {
  const store = await readStore();
  const rows = getAllRows(store);

  const filters = {};
  ALLOWED_FIELDS.forEach((f) => {
    if (req.query[f]) filters[f] = req.query[f].toString();
  });

  if (Object.keys(filters).length === 0) {
    return res.status(400).json({ error: "Укажите хотя бы один параметр поиска" });
  }

  const matches = advancedSearch(rows, filters);
  const results = dedupeByTicket(matches);

  return res.status(200).json({ results });
}
