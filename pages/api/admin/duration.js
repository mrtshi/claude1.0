import { readStore } from "../../../lib/store";
import { requireAdminSession } from "../../../lib/adminAuth";
import {
  getAllRows,
  getExecutorList,
  getRepairDurationStats,
  getExecutorDurationRanking,
  getTopLongestTickets,
  filterByDateRange,
} from "../../../lib/dataUtils";

const TOP_LONGEST_LIMIT = 10;

export default async function handler(req, res) {
  if (requireAdminSession(req, res)) return;

  const store = await readStore();
  const rows = getAllRows(store);

  const { executor, startDate, endDate, drillExecutor } = req.query;

  let effectiveRows = rows;
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
    effectiveRows = filterByDateRange(rows, start, end);
  }

  const durationStats = getRepairDurationStats(effectiveRows, executor || null);
  const executorRanking = getExecutorDurationRanking(effectiveRows);
  const topLongest = getTopLongestTickets(effectiveRows, TOP_LONGEST_LIMIT, executor || null);
  const executors = getExecutorList(rows);

  // When drilling into a specific executor from the ranking table, also
  // return their full list of tickets sorted by longest duration first,
  // so the admin can see exactly which jobs are dragging down that
  // executor's average.
  let drillExecutorTickets = null;
  if (drillExecutor) {
    drillExecutorTickets = getTopLongestTickets(effectiveRows, 1000, drillExecutor);
  }

  return res.status(200).json({
    executors,
    durationStats,
    executorRanking,
    topLongest,
    drillExecutorTickets,
  });
}
