import { readStore, writeStore, getReportKey } from "../../../lib/store";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const reportKey = getReportKey(req.body.reportKey);
  if (!reportKey) {
    return res.status(400).json({ error: "Некорректный идентификатор отчёта" });
  }

  const store = await readStore();
  store.reports[reportKey] = { fileName: null, uploadedAt: null, rows: [] };
  const saved = await writeStore(store);

  if (!saved) {
    return res.status(500).json({ error: "Не удалось сохранить изменения в хранилище" });
  }

  return res.status(200).json({ success: true });
}
