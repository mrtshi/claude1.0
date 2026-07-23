import * as XLSX from "xlsx";
import { shortenOrgName } from "./dataUtils";

// Column headers expected in the source report (as given by the client).
// We map by fuzzy header matching since real files may have slightly
// different spacing/case.
//
// NOTE: `qty` ("Кол-во") and `sum` ("Сумма") are deliberately NOT in this
// map even though the spec lists them as sub-columns of "Работы,
// запчасти, транс. услуги". In the real report file, "Кол-во" and
// "Сумма" are on a *second* header row directly below the main header
// row (merged-cell group headers), not on the same row as "№ заявки" /
// "Номенклатура". Including "кол-во" here caused two problems: (1) it
// never matched anything real since the actual label is one row down,
// and (2) as a substring pattern it falsely matched inside "Кол-во
// заявок за период" on the main header row, silently stealing that
// column's index. qty/sum are located separately in findSubHeaderIndex.
const HEADER_MAP = {
  year: ["год"],
  period: ["период"],
  ticketsInPeriod: ["кол-во заявок за период"],
  ticketsInYear: ["общее кол-во заявок за год"],
  ticketNumber: ["№ заявки", "номер заявки"],
  nomenclature: ["номенклатура"],
  serialNumber: ["заводской №", "заводской номер", "серийный номер"],
  organization: ["организация"],
  dateReceived: ["дата принятия заявки на ремонт"],
  dateDone: ["дата выполнения ремонта"],
  owner: ["владелец оборудования"],
  location: ["местонахождение оборудования"],
  fio: ["фио"],
  phone: ["телефон"],
  executor: ["исполнитель"],
  malfunction: ["неисправность"],
  malfunctionCode: ["код неисправности по классификатору"],
  worksParts: ["работы, запчасти, транс. услуги", "работы запчасти транс услуги"],
  reports: ["отчеты"],
  comment: ["комментарий"],
  totalRub: ["итого, руб", "итого руб"],
  status: ["статус заявки в фениксе"],
};

// Locates the "Кол-во" (quantity) and "Сумма" (sum) data columns for
// the "Работы, запчасти, транс. услуги" column group.
//
// This can't be done by matching the "Кол-во"/"Сумма" text labels
// directly: in real report files, that group spans 4 sub-columns
// (work/part type, description, quantity, sum), but the "Кол-во"/
// "Сумма" text labels are positioned 2 columns to the left of where
// the actual quantity/sum data lives (they visually appear to label
// the first two description sub-columns due to how the merged header
// cells were laid out in the source spreadsheet). Verified against
// real report data: for the "Работы, запчасти..." group starting at
// column N, columns N and N+1 hold text (type/description) and N+2,
// N+3 hold the numeric quantity and sum.
function findWorksPartsQtySumIndex(worksPartsIndex) {
  if (worksPartsIndex === undefined) return {};
  return {
    qty: worksPartsIndex + 2,
    sum: worksPartsIndex + 3,
  };
}

function normalizeHeader(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildHeaderIndex(headerRow) {
  const idx = {};
  headerRow.forEach((cell, i) => {
    const norm = normalizeHeader(cell);
    if (!norm) return;
    for (const [key, variants] of Object.entries(HEADER_MAP)) {
      if (idx[key] !== undefined) continue;
      if (variants.some((v) => norm === v || norm.includes(v))) {
        idx[key] = i;
      }
    }
  });
  return idx;
}

function excelDateToString(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return String(value);
    const dd = String(date.d).padStart(2, "0");
    const mm = String(date.m).padStart(2, "0");
    return `${dd}.${mm}.${date.y}`;
  }
  return String(value).trim();
}

function cellToString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function cellToNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return isNaN(n) ? null : n;
}

// Parses the workbook buffer and returns an array of "ticket" row objects.
// Each row of underlying data (which may include several work-line
// sub-rows per ticket) is preserved as a raw record; grouping by ticket
// number happens at query time.
export function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  if (!rows.length) return [];

  // Find header row: search first 5 rows for one that contains "№ заявки"
  let headerRowIndex = -1;
  let headerIdx = {};
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const candidate = buildHeaderIndex(rows[i]);
    if (candidate.ticketNumber !== undefined && candidate.nomenclature !== undefined) {
      headerRowIndex = i;
      headerIdx = candidate;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      "Не удалось найти строку заголовков в файле. Проверьте формат таблицы."
    );
  }

  // "Кол-во" / "Сумма" are located positionally relative to the
  // "Работы, запчасти..." column (see findWorksPartsQtySumIndex), since
  // their text labels in the source file don't reliably align with the
  // actual data columns.
  const qtySumIdx = findWorksPartsQtySumIndex(headerIdx.worksParts);
  Object.assign(headerIdx, qtySumIdx);

  // The row right after the main header row may be a sub-header row
  // (containing labels like "Кол-во"/"Сумма" under the merged group
  // headers) rather than actual data — detect and skip it generically
  // by checking whether it contains no ticket number but does contain
  // recognizable sub-header text in the worksParts group columns.
  let dataStartIndex = headerRowIndex + 1;
  if (dataStartIndex < rows.length) {
    const maybeSubHeaderRow = rows[dataStartIndex];
    const looksLikeSubHeader =
      headerIdx.ticketNumber !== undefined &&
      cellToString(maybeSubHeaderRow[headerIdx.ticketNumber]) === "" &&
      headerIdx.worksParts !== undefined &&
      /^(кол-во|шт|ед)/i.test(normalizeHeader(maybeSubHeaderRow[headerIdx.worksParts]) || "");
    if (looksLikeSubHeader) {
      dataStartIndex += 1;
    }
  }

  const results = [];
  let currentYear = "";
  let currentPeriod = "";

  // Context carried forward from the last row that had a real ticket
  // number, so that continuation rows (extra parts/work/cost lines that
  // belong to the same ticket but leave most columns blank) still get
  // associated with the correct ticket, serial number, executor, etc.
  let lastTicketContext = null;

  for (let r = dataStartIndex; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => cellToString(c) === "")) continue;

    const get = (key) =>
      headerIdx[key] !== undefined ? row[headerIdx[key]] : "";

    const yearVal = cellToString(get("year"));
    const periodVal = cellToString(get("period"));
    if (yearVal) currentYear = yearVal;
    if (periodVal) currentPeriod = periodVal;

    const ticketNumber = cellToString(get("ticketNumber"));
    const nomenclature = cellToString(get("nomenclature"));
    const worksParts = cellToString(get("worksParts"));
    const sum = cellToNumber(get("sum"));

    // Rows that carry neither a ticket number/nomenclature (a new ticket)
    // nor any work/parts/sum data (a continuation line) are just section
    // separators (e.g. a lone "Январь" row) and can be skipped entirely.
    if (!ticketNumber && !nomenclature && !worksParts && sum === null) continue;

    let record;
    if (ticketNumber) {
      // This is a new ticket row — identified by having its own ticket
      // number. (We don't also require `nomenclature` to be present,
      // since some real tickets in practice are missing that field but
      // are still genuinely separate tickets — using nomenclature as
      // a second requirement caused independent tickets with a blank
      // nomenclature to be incorrectly merged into the previous
      // ticket's continuation rows, undercounting the true ticket
      // count significantly.)
      record = {
        year: currentYear,
        period: currentPeriod,
        ticketsInPeriod: cellToString(get("ticketsInPeriod")),
        ticketsInYear: cellToString(get("ticketsInYear")),
        ticketNumber,
        nomenclature,
        serialNumber: cellToString(get("serialNumber")),
        organization: shortenOrgName(cellToString(get("organization"))),
        dateReceived: excelDateToString(get("dateReceived")),
        dateDone: excelDateToString(get("dateDone")),
        owner: shortenOrgName(cellToString(get("owner"))),
        location: cellToString(get("location")),
        fio: cellToString(get("fio")),
        phone: cellToString(get("phone")),
        executor: shortenOrgName(cellToString(get("executor"))),
        malfunction: cellToString(get("malfunction")),
        malfunctionCode: cellToString(get("malfunctionCode")),
        worksParts,
        reportsField: cellToString(get("reports")),
        comment: cellToString(get("comment")),
        totalRub: cellToNumber(get("totalRub")),
        status: cellToString(get("status")),
        qty: cellToNumber(get("qty")),
        sum,
      };
      lastTicketContext = record;
    } else if (nomenclature) {
      // No ticket number but a nomenclature is present — still treat as
      // a distinct ticket (using a synthetic key later, since dedup
      // relies on ticketNumber) rather than merging it into whatever
      // ticket preceded it, since a real continuation row for
      // parts/work lines never introduces a new nomenclature value.
      record = {
        year: currentYear,
        period: currentPeriod,
        ticketsInPeriod: cellToString(get("ticketsInPeriod")),
        ticketsInYear: cellToString(get("ticketsInYear")),
        ticketNumber: "",
        nomenclature,
        serialNumber: cellToString(get("serialNumber")),
        organization: shortenOrgName(cellToString(get("organization"))),
        dateReceived: excelDateToString(get("dateReceived")),
        dateDone: excelDateToString(get("dateDone")),
        owner: shortenOrgName(cellToString(get("owner"))),
        location: cellToString(get("location")),
        fio: cellToString(get("fio")),
        phone: cellToString(get("phone")),
        executor: shortenOrgName(cellToString(get("executor"))),
        malfunction: cellToString(get("malfunction")),
        malfunctionCode: cellToString(get("malfunctionCode")),
        worksParts,
        reportsField: cellToString(get("reports")),
        comment: cellToString(get("comment")),
        totalRub: cellToNumber(get("totalRub")),
        status: cellToString(get("status")),
        qty: cellToNumber(get("qty")),
        sum,
      };
      lastTicketContext = record;
    } else if (lastTicketContext) {
      // Continuation row: inherit identifying context, but use this row's
      // own work/parts/sum figures so totals aggregate correctly.
      record = {
        ...lastTicketContext,
        worksParts,
        totalRub: cellToNumber(get("totalRub")) ?? 0,
        qty: cellToNumber(get("qty")),
        sum,
      };
    } else {
      // Continuation-looking row with no prior ticket context; skip.
      continue;
    }

    results.push(record);
  }

  return results;
}
