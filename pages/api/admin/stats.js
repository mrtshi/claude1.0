import { readStore } from "../../../lib/store";
import {
  getAllRows,
  getExecutorList,
  getExecutorStats,
  getDailyCounts,
  getPeriodRange,
  findRepeatTickets,
  filterByDateRange,
} from "../../../lib/dataUtils";

export default async function handler(req, res) {
  const store = await readStore();
  const rows = getAllRows(store);

  const { executor, period, dailyPeriod } = req.query;

  const executors = getExecutorList(rows);

  let effectiveRows = rows;
  if (period) {
    const { start, end } = getPeriodRange(period);
    effectiveRows = filterByDateRange(rows, start, end);
  }

  const executorStats = getExecutorStats(effectiveRows, executor || null);

  const dPeriod = dailyPeriod || "7d";
  const { start: dStart, end: dEnd } = getPeriodRange(dPeriod);
  const daily = getDailyCounts(rows, dStart, dEnd);

  const repeats = findRepeatTickets(rows);

  return res.status(200).json({
    executors,
    executorStats: {
      totalTickets: executorStats.totalTickets,
      totalSum: executorStats.totalSum,
      statusCounts: executorStats.statusCounts,
    },
    daily,
    repeats: repeats.slice(0, 100),
    totalRowsLoaded: rows.length,
  });
}
