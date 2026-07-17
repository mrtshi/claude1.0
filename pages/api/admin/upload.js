import { readStore, writeStoreWithMeta, getReportKey } from "../../../lib/store";
import { parseWorkbook } from "../../../lib/parseReport";
import { requireAdminSession } from "../../../lib/adminAuth";
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

  if (requireAdminSession(req, res)) return;

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

    const store = await readStore();
    store.reports[reportKey] = {
      fileName: file.originalFilename || "report.xlsx",
      uploadedAt: new Date().toISOString(),
      rows,
    };
    const { saved, usingDurableStorage } = await writeStoreWithMeta(store);

    if (!saved) {
      return res.status(500).json({
        error: "Файл был обработан, но не удалось сохранить данные ни в постоянное хранилище, ни во временное. Попробуйте ещё раз.",
      });
    }

    return res.status(200).json({
      success: true,
      fileName: store.reports[reportKey].fileName,
      rowCount: rows.length,
      warning: usingDurableStorage
        ? null
        : "Данные сохранены только во временную память сервера — постоянное хранилище (Vercel Blob) сейчас недоступно. Отчёт может пропасть при перезапуске сервера. Проверьте подключение Blob в панели администратора.",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Ошибка при обработке файла" });
  }
}
