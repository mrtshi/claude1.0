import { readStore, isUsingDurableStorage } from "../../../lib/store";

export default async function handler(req, res) {
  const store = await readStore();
  const summarize = (r) => ({
    fileName: r.fileName,
    uploadedAt: r.uploadedAt,
    rowCount: r.rows ? r.rows.length : 0,
  });

  return res.status(200).json({
    "2026": summarize(store.reports["2026"]),
    archive_2024_2025: summarize(store.reports.archive_2024_2025),
    durableStorage: isUsingDurableStorage(),
  });
}
