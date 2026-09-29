import { readStore } from "../../../lib/store";
import { requireAdminSession } from "../../../lib/adminAuth";
import {
  getAllRows,
  getExecutorList,
  getRepairDurationStats,
  getExecutorDurationRanking,
  getPeriodRange,
  filterByDateRange,
} from "../../../lib/dataUtils";

export default async function handler(req, res) {
  if (requireAdminSession(req, res)) return;

  const store = await readStore();
  const rows = getAllRows(store);

  const { executor, period } = req.query;

  let effectiveRows = rows;
  if (period) {
    const { start, end } = getPeriodRange(period);
    effectiveRows = filterByDateRange(rows, start, end);
  }

  const durationStats = getRepairDurationStats(effectiveRows, executor || null);
  const executorRanking = getExecutorDurationRanking(effectiveRows);
  const executors = getExecutorList(rows);

  return res.status(200).json({
    executors,
    durationStats,
    executorRanking,
  });
}
