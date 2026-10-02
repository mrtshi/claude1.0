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
  const all = [...a, ...b];
  // Normalize legal-entity naming on every read so that the fix applies
  // to data uploaded before this normalization existed, not just to
  // newly-parsed files.
  return all.map((row) => ({
    ...row,
    organization: shortenOrgName(row.organization),
    owner: shortenOrgName(row.owner),
    executor: shortenOrgName(row.executor),
  }));
}

export function normalize(str) {
  return String(str || "").toLowerCase().trim();
}

// Search across ticket number or serial number.
export function searchTickets(rows, query) {
  const q = normalize(query);
  if (!q) return [];
  return rows.filter((row) => {
    return normalize(row.ticketNumber) === q || normalize(row.serialNumber) === q;
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
    const key =
      row.ticketNumber ||
      `${row.serialNumber}-${row.dateReceived}-${row.nomenclature}`;
    if (!byTicket[key]) {
      byTicket[key] = { ...row, sum: 0 };
      order.push(key);
    }
    byTicket[key].sum += row.sum || 0;
  }
  return order.map((key) => byTicket[key]);
}

// Computes the number of calendar days between dateReceived and
// dateDone for a single ticket row. Returns null if either date is
// missing/unparseable, or if dateDone is before dateReceived (bad data
// — shouldn't be counted as a valid duration).
export function getRepairDurationDays(row) {
  const received = parseDate(row.dateReceived);
  const done = parseDate(row.dateDone);
  if (!received || !done) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.round((done - received) / dayMs);
  if (diff < 0) return null;
  return diff;
}

// Classifies a repair duration (in days) into a traffic-light severity
// level for quick visual scanning: green = fast (<=10 days), yellow =
// medium (11-20 days), red = slow (21+ days).
export function getDurationSeverity(days) {
  if (days === null || days === undefined) return null;
  if (days <= 10) return "green";
  if (days <= 20) return "yellow";
  return "red";
}

// Returns the N tickets with the longest repair duration (dateDone -
// dateReceived), optionally restricted to a single executor. Each
// result includes the computed duration and severity so the UI doesn't
// need to recompute it.
export function getTopLongestTickets(rows, limit, executor) {
  const filtered = executor
    ? rows.filter((r) => normalize(r.executor) === normalize(executor))
    : rows;

  const tickets = dedupeByTicket(filtered);

  const withDuration = tickets
    .map((t) => ({ ...t, durationDays: getRepairDurationDays(t) }))
    .filter((t) => t.durationDays !== null);

  withDuration.sort((a, b) => b.durationDays - a.durationDays);

  return withDuration.slice(0, limit).map((t) => ({
    ticketNumber: t.ticketNumber,
    nomenclature: t.nomenclature,
    serialNumber: t.serialNumber,
    executor: t.executor,
    location: t.location,
    dateReceived: t.dateReceived,
    dateDone: t.dateDone,
    status: t.status,
    durationDays: t.durationDays,
    severity: getDurationSeverity(t.durationDays),
  }));
}

const DURATION_BUCKETS = [
  { label: "0–3 дня", min: 0, max: 3 },
  { label: "4–7 дней", min: 4, max: 7 },
  { label: "8–14 дней", min: 8, max: 14 },
  { label: "15–30 дней", min: 15, max: 30 },
  { label: "Более 30 дней", min: 31, max: Infinity },
];

function bucketLabelForDuration(days) {
  const bucket = DURATION_BUCKETS.find((b) => days >= b.min && days <= b.max);
  return bucket ? bucket.label : "Не определено";
}

// Aggregates repair-duration statistics (dateReceived -> dateDone) over
// a set of rows. Optionally restrict to a single executor. Rows are
// deduplicated to one entry per ticket first, since duration is a
// per-ticket property, not a per-work-line property.
export function getRepairDurationStats(rows, executor) {
  const filtered = executor
    ? rows.filter((r) => normalize(r.executor) === normalize(executor))
    : rows;

  const tickets = dedupeByTicket(filtered);

  const durations = [];
  let notCompletedCount = 0;
  let invalidCount = 0;

  tickets.forEach((t) => {
    const days = getRepairDurationDays(t);
    if (days === null) {
      if (!t.dateDone) {
        notCompletedCount += 1;
      } else {
        invalidCount += 1;
      }
      return;
    }
    durations.push(days);
  });

  durations.sort((a, b) => a - b);

  const count = durations.length;
  const average = count
    ? Math.round((durations.reduce((acc, d) => acc + d, 0) / count) * 10) / 10
    : null;
  const median = count
    ? count % 2 === 1
      ? durations[(count - 1) / 2]
      : Math.round(((durations[count / 2 - 1] + durations[count / 2]) / 2) * 10) / 10
    : null;
  const min = count ? durations[0] : null;
  const max = count ? durations[count - 1] : null;

  const bucketCounts = {};
  DURATION_BUCKETS.forEach((b) => {
    bucketCounts[b.label] = 0;
  });
  durations.forEach((d) => {
    bucketCounts[bucketLabelForDuration(d)] += 1;
  });

  const distribution = DURATION_BUCKETS.map((b) => ({
    label: b.label,
    count: bucketCounts[b.label],
  }));

  return {
    ticketsWithDuration: count,
    notCompletedCount,
    invalidCount,
    average,
    averageSeverity: getDurationSeverity(average),
    median,
    medianSeverity: getDurationSeverity(median),
    min,
    max,
    distribution,
  };
}

// Returns per-executor average repair duration, sorted fastest first,
// for executors with at least one completed ticket with a valid
// duration. Useful for a quick "who resolves fastest" comparison.
export function getExecutorDurationRanking(rows) {
  const tickets = dedupeByTicket(rows);
  const byExecutor = {};

  tickets.forEach((t) => {
    const days = getRepairDurationDays(t);
    if (days === null) return;
    const key = t.executor || "Не указан";
    if (!byExecutor[key]) byExecutor[key] = [];
    byExecutor[key].push(days);
  });

  return Object.entries(byExecutor)
    .map(([executor, durations]) => {
      const average = Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10;
      return {
        executor,
        ticketCount: durations.length,
        average,
        severity: getDurationSeverity(average),
      };
    })
    .sort((a, b) => a.average - b.average);
}

// Ranks executors by number of unique tickets handled, descending.
// Used for a simple "who did the most work" leaderboard, independent
// of the duration/speed ranking.
export function getTopExecutorsByCount(rows, limit) {
  const tickets = dedupeByTicket(rows);
  const counts = {};

  tickets.forEach((t) => {
    const key = t.executor || "Не указан";
    counts[key] = (counts[key] || 0) + 1;
  });

  const ranked = Object.entries(counts)
    .map(([executor, count]) => ({ executor, count }))
    .sort((a, b) => b.count - a.count);

  return limit ? ranked.slice(0, limit) : ranked;
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

// Returns array of { month: 1-12, label: 'Январь', count } for a given
// year, based on dateReceived. Used for the year-level view of the
// "Заявки по дням" chart, which drills down into daily counts when a
// specific month is selected.
const MONTH_LABELS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export function getMonthlyCounts(rows, year) {
  const tickets = dedupeByTicket(rows);
  const counts = new Array(12).fill(0);

  tickets.forEach((r) => {
    const d = parseDate(r.dateReceived);
    if (!d) return;
    if (d.getFullYear() !== year) return;
    counts[d.getMonth()] += 1;
  });

  return counts.map((count, i) => ({
    month: i + 1,
    label: MONTH_LABELS[i],
    count,
  }));
}

// Returns array of { date: 'dd.mm', count } for every day in a given
// month/year, based on dateReceived. Used for the drill-down view when
// a specific month is clicked in the year-level chart.
export function getDailyCountsForMonth(rows, year, month) {
  const tickets = dedupeByTicket(rows);
  const daysInMonth = new Date(year, month, 0).getDate();
  const buckets = new Array(daysInMonth + 1).fill(0);

  tickets.forEach((r) => {
    const d = parseDate(r.dateReceived);
    if (!d) return;
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return;
    buckets[d.getDate()] += 1;
  });

  const result = [];
  for (let day = 1; day <= daysInMonth; day++) {
    result.push({
      date: `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`,
      count: buckets[day],
    });
  }
  return result;
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
// -> "ООО Ромашка". Matching is case-insensitive. Also normalizes cases
// where the abbreviation/full form appears *after* the name (e.g.
// "Иванов И.И. ИП" or "Ромашка ООО") by moving it to the front, so the
// result is always consistently formatted as "ИП Иванов И.И.".
const FULL_FORM_PATTERNS = [
  { pattern: /индивидуальн(?:ый|ого|ому|ым|ом)\s+предпринимател[а-я]*/gi, replacement: "ИП" },
  { pattern: /общество\s+с\s+ограниченной\s+ответственностью/gi, replacement: "ООО" },
  { pattern: /закрытое\s+акционерное\s+общество/gi, replacement: "ЗАО" },
  { pattern: /публичное\s+акционерное\s+общество/gi, replacement: "ПАО" },
  { pattern: /открытое\s+акционерное\s+общество/gi, replacement: "ОАО" },
  { pattern: /акционерное\s+общество/gi, replacement: "АО" },
];

// Matches a trailing or leading short abbreviation as a standalone word
// (not part of another word), so we can detect and reposition it.
const ABBREVIATION_WORD = /(^|\s)(ИП|ООО|ЗАО|ПАО|ОАО|АО)(\s|$)/i;

export function shortenOrgName(name) {
  if (!name) return name;
  let result = String(name);

  // First, expand any full legal-form phrasing to its abbreviation,
  // wherever it appears in the string.
  for (const { pattern, replacement } of FULL_FORM_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  result = result.replace(/\s+/g, " ").trim();

  // If the abbreviation ended up trailing the name (e.g. "Иванов И.И.
  // ИП" or "Ромашка ООО"), move it to the front for consistency.
  const match = result.match(ABBREVIATION_WORD);
  if (match) {
    const abbr = match[2].toUpperCase();
    const alreadyLeading = new RegExp(`^${abbr}\\b`, "i").test(result);
    if (!alreadyLeading) {
      const withoutAbbr = (
        result.slice(0, match.index) + " " + result.slice(match.index + match[0].length)
      )
        .replace(/\s+/g, " ")
        .trim();
      result = `${abbr} ${withoutAbbr}`.trim();
    }
  }

  return result;
}
