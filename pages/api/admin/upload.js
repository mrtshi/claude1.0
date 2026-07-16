import { readStore, writeStore, getReportKey } from "../../../lib/store";
import { parseWorkbook } from "../../../lib/parseReport";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false, maxFileSize: 25 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fields, files } = await parseForm(req);
    const reportKeyRaw = Array.isArray(fields.reportKey) ? fields.reportKey[0] : fields.reportKey;
    const reportKey = getReportKey(reportKeyRaw);

    if (!reportKey) {
      return res.status(400).json({ error: "Некорректный идентификатор отчёта" });
    }

    const fileEntry = files.file;
    const file = Array.isArray(fileEntry) ? fileEntry[0] : fileEntry;

    if (!file) {
      return res.status(400).json({ error: "Файл не найден в запросе" });
    }

    const buffer = fs.readFileSync(file.filepath);
    const rows = parseWorkbook(buffer);

    if (!rows.length) {
      return res.status(400).json({
        error: "В файле не найдено ни одной строки с данными заявок.",
      });
    }

    const store = readStore();
    store.reports[reportKey] = {
      fileName: file.originalFilename || "report.xlsx",
      uploadedAt: new Date().toISOString(),
      rows,
    };
    writeStore(store);

    return res.status(200).json({
      success: true,
      fileName: store.reports[reportKey].fileName,
      rowCount: rows.length,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Ошибка при обработке файла" });
  }
}
