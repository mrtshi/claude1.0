import { readStore } from "../../../lib/store";
import { requireAdminSession } from "../../../lib/adminAuth";
import {
  getAllRows,
  getExecutorList,
  getExecutorStats,
  getTopExecutorsByCount,
  getMonthlyAverageCheck,
  getMonthlyCostBreakdown,
  getDailyCounts,
  getMonthlyCounts,
  getDailyCountsForMonth,
  getPeriodRange,
  findRepeatTickets,
  filterByDateRange,
} from "../../../lib/dataUtils";

const YEAR_PERIODS = { "2026": 2026, "2025": 2025, "2024": 2024 };
const YEARS = [2024, 2025, 2026];

export default async function handler(req, res) {
  if (requireAdminSession(req, res)) return;

  const store = await readStore();
  const rows = getAllRows(store);

  const { executor, startDate, endDate, dailyPeriod, drillMonth } = req.query;

  const executors = getExecutorList(rows);

  let effectiveRows = rows;
  if (startDate || endDate) {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
    effectiveRows = filterByDateRange(rows, start, end);
  }

  const executorStats = getExecutorStats(effectiveRows, executor || null);
  const topExecutorsByCount = getTopExecutorsByCount(effectiveRows, 10);
  const monthlyAverageCheck = getMonthlyAverageCheck(rows, executor || null);
  const costBreakdown = getMonthlyCostBreakdown(rows, executor || null);

  // Per-year statistics: each year gets its own average check, top
  // executors and monthly cost breakdown. Independent of the custom
  // date range; follows the executor filter.
  const yearly = {};
  for (const y of YEARS) {
    const yRows = filterByDateRange(
      rows,
      new Date(y, 0, 1),
      new Date(y, 11, 31, 23, 59, 59, 999)
    );
    const yStats = getExecutorStats(yRows, executor || null);
    yearly[y] = {
      totalTickets: yStats.totalTickets,
      averageCheck: yStats.averageCheck,
      approvedCount: yStats.approvedCount,
      approvedSum: yStats.approvedSum,
      topExecutors: getTopExecutorsByCount(yRows, 10),
      costBreakdown: getMonthlyCostBreakdown(yRows, executor || null),
    };
  }

  const dPeriod = dailyPeriod || "7d";
  const year = YEAR_PERIODS[dPeriod];

  let daily;
  let chartMode; // 'daily' | 'monthly'
  let drillMonthLabel = null;

  if (year && drillMonth) {
    // Year selected AND a specific month clicked: show days within that month.
    const monthNum = parseInt(drillMonth, 10);
    daily = getDailyCountsForMonth(rows, year, monthNum);
    chartMode = "daily";
    const monthNames = [
      "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
      "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
    ];
    drillMonthLabel = monthNames[monthNum - 1] || null;
  } else if (year) {
    // Year selected, no month drill-down yet: show monthly totals.
    const monthly = getMonthlyCounts(rows, year);
    daily = monthly.map((m) => ({ date: m.label, count: m.count, month: m.month }));
    chartMode = "monthly";
  } else {
    // 7d / 30d: show daily counts as before.
    const { start: dStart, end: dEnd } = getPeriodRange(dPeriod);
    daily = getDailyCounts(rows, dStart, dEnd);
    chartMode = "daily";
  }

  const repeats = findRepeatTickets(rows);

  return res.status(200).json({
    executors,
    executorStats: {
      totalTickets: executorStats.totalTickets,
      totalSum: executorStats.totalSum,
      averageCheck: executorStats.averageCheck,
      approvedCount: executorStats.approvedCount,
      approvedSum: executorStats.approvedSum,
      statusCounts: executorStats.statusCounts,
    },
    topExecutorsByCount,
    yearly,
    monthlyAverageCheck,
    costBreakdown,
    daily,
    chartMode,
    drillMonthLabel,
    repeats: repeats.slice(0, 100),
    totalRowsLoaded: rows.length,
  });
}
