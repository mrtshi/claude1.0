import { readStoreWithMeta } from "../../../lib/store";
import { requireAdminSession } from "../../../lib/adminAuth";
import { dedupeByTicket } from "../../../lib/dataUtils";

export default async function handler(req, res) {
  if (requireAdminSession(req, res)) return;

  const { store, usingDurableStorage } = await readStoreWithMeta();
  const summarize = (r) => ({
    fileName: r.fileName,
    uploadedAt: r.uploadedAt,
    rowCount: r.rows ? r.rows.length : 0,
    uniqueTicketCount: r.rows ? dedupeByTicket(r.rows).length : 0,
  });

  return res.status(200).json({
    "2026": summarize(store.reports["2026"]),
    archive_2024_2025: summarize(store.reports.archive_2024_2025),
    durableStorage: usingDurableStorage,
  });
}
