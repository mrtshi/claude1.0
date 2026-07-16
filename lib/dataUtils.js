// Parses a "dd.mm.yyyy" style date string into a Date object (or null).
export function parseDate(str) {
  if (!str) return null;
  const m = String(str).match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = "20" + y;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (isNaN(date.getTime())) return null;
  return date;
}

export function getAllRows(store) {
  const a = store.reports["2026"]?.rows || [];
  const b = store.reports.archive_2024_2025?.rows || [];
  return [...a, ...b];
}

export function normalize(str) {
  return String(str || "").toLowerCase().trim();
}

// Search across ticket number or serial number.
export function searchTickets(rows, query) {
  const q = normalize(query);
  if (!q) return [];
  return rows.filter((row) => {
    return (
      normalize(row.ticketNumber) === q ||
      normalize(row.serialNumber) === q ||
      normalize(row.ticketNumber).includes(q) ||
      normalize(row.serialNumber).includes(q)
    );
  });
}

// Generic column search across multiple allowed fields.
export function advancedSearch(rows, filters) {
  return rows.filter((row) => {
    return Object.entries(filters).every(([field, value]) => {
      if (!value) return true;
      return normalize(row[field]).includes(normalize(value));
    });
  });
}

// Detect repeat visits: same serial number (or same location) appearing
// in more than one distinct ticket. Returns groups sorted by most recent.
export function findRepeatTickets(rows) {
  // Collapse work/parts sub-rows into one row per ticket first, so a
  // ticket with several cost lines doesn't look like several visits.
  const tickets = dedupeByTicket(rows);

  const bySerial = {};
  for (const row of tickets) {
    const key = normalize(row.serialNumber) || normalize(row.location);
    if (!key) continue;
    if (!bySerial[key]) bySerial[key] = [];
    bySerial[key].push(row);
  }

  const groups = [];
  for (const [key, uniqueTickets] of Object.entries(bySerial)) {
    if (uniqueTickets.length > 1) {
      uniqueTickets.sort((a, b) => {
        const da = parseDate(a.dateReceived);
        const db = parseDate(b.dateReceived);
        if (!da || !db) return 0;
        return db - da;
      });
      groups.push({
        key,
        serialNumber: uniqueTickets[0].serialNumber,
        location: uniqueTickets[0].location,
        executor: uniqueTickets[0].executor,
        nomenclature: uniqueTickets[0].nomenclature,
        visits: uniqueTickets,
      });
    }
  }

  groups.sort((a, b) => b.visits.length - a.visits.length);
  return groups;
}

// Filters rows by a date range using dateReceived.
export function filterByDateRange(rows, startDate, endDate) {
  return rows.filter((row) => {
    const d = parseDate(row.dateReceived);
    if (!d) return false;
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  });
}

export function getPeriodRange(period) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  let start = null;
  let end = now;

  if (period === "7d") {
    start = new Date(now);
    start.setDate(start.getDate() - 7);
  } else if (period === "30d") {
    start = new Date(now);
    start.setDate(start.getDate() - 30);
  } else if (period === "2026") {
    start = new Date(2026, 0, 1);
    end = new Date(2026, 11, 31, 23, 59, 59, 999);
  } else if (period === "2025") {
    start = new Date(2025, 0, 1);
    end = new Date(2025, 11, 31, 23, 59, 59, 999);
  } else if (period === "2024") {
    start = new Date(2024, 0, 1);
    end = new Date(2024, 11, 31, 23, 59, 59, 999);
  }

  return { start, end };
}

// Collapses multiple work/parts sub-rows belonging to the same ticket
// into a single representative row, summing money fields. Used whenever
// we need to count or list *tickets* rather than raw spreadsheet rows.
export function dedupeByTicket(rows) {
  const byTicket = {};
  const order = [];
  for (const row of rows) {
    const key = row.ticketNumber || `${row.serialNumber}-${row.dateReceived}`;
    if (!byTicket[key]) {
      byTicket[key] = { ...row, sum: 0 };
      order.push(key);
    }
    byTicket[key].sum += row.sum || 0;
  }
  return order.map((key) => byTicket[key]);
}

export function getExecutorList(rows) {
  const set = new Set();
  rows.forEach((r) => {
    if (r.executor) set.add(r.executor);
  });
  return Array.from(set).sort();
}

export function getExecutorStats(rows, executor) {
  const filtered = executor
    ? rows.filter((r) => normalize(r.executor) === normalize(executor))
    : rows;

  const tickets = dedupeByTicket(filtered);

  const totalTickets = tickets.length;
  const totalSum = tickets.reduce((acc, r) => acc + (r.sum || 0), 0);

  const statusCounts = {};
  tickets.forEach((r) => {
    const s = r.status || "Не указан";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  return {
    totalTickets,
    totalSum,
    statusCounts,
    rows: filtered,
  };
}

// Returns array of { date: 'dd.mm', count } for the last N days based on
// dateReceived, or bucketed by day within a custom range.
export function getDailyCounts(rows, start, end) {
  const buckets = {};
  const dayMs = 24 * 60 * 60 * 1000;

  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;

  const tickets = dedupeByTicket(rows);

  tickets.forEach((r) => {
    const d = parseDate(r.dateReceived);
    if (!d) return;
    if (s && d < s) return;
    if (e && d > e) return;
    const key = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets[key] = (buckets[key] || 0) + 1;
  });

  // Build ordered list of days between s and e (if provided), else use
  // whatever keys we found, sorted chronologically.
  if (s && e && e - s <= 90 * dayMs) {
    const result = [];
    const cursor = new Date(s);
    while (cursor <= e) {
      const key = `${String(cursor.getDate()).padStart(2, "0")}.${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      result.push({ date: key, count: buckets[key] || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  return Object.entries(buckets)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => {
      const [da, ma] = a.date.split(".").map(Number);
      const [db, mb] = b.date.split(".").map(Number);
      return ma - mb || da - db;
    });
}

// Pluralizes the Russian word "обращение" based on count (1 обращение,
// 2-4 обращения, 5+ обращений, with special-casing for 11-14).
export function pluralizeObrashenie(count) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "обращений";
  if (n1 > 1 && n1 < 5) return "обращения";
  if (n1 === 1) return "обращение";
  return "обращений";
}

// Shortens common Russian legal-entity forms to their standard
// abbreviations, e.g. "Индивидуальный предприниматель Иванов И.И." ->
// "ИП Иванов И.И.", "Общество с ограниченной ответственностью Ромашка"
// -> "ООО Ромашка". Matching is case-insensitive; abbreviations that are
// already present (ИП, ООО, АО, ЗАО, ПАО, ОАО) are left untouched.
const ORG_REPLACEMENTS = [
  { pattern: /индивидуальн(?:ый|ого|ому|ым|ом)\s+предпринимател[а-я]*/gi, replacement: "ИП" },
  { pattern: /общество\s+с\s+ограниченной\s+ответственностью/gi, replacement: "ООО" },
  { pattern: /закрытое\s+акционерное\s+общество/gi, replacement: "ЗАО" },
  { pattern: /публичное\s+акционерное\s+общество/gi, replacement: "ПАО" },
  { pattern: /открытое\s+акционерное\s+общество/gi, replacement: "ОАО" },
  { pattern: /акционерное\s+общество/gi, replacement: "АО" },
];

export function shortenOrgName(name) {
  if (!name) return name;
  let result = String(name);
  for (const { pattern, replacement } of ORG_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, " ").trim();
}
