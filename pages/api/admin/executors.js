import { readStore } from "../../../lib/store";
import { requireAdminSession } from "../../../lib/adminAuth";
import { getAllRows, getExecutorList } from "../../../lib/dataUtils";

export default async function handler(req, res) {
  if (requireAdminSession(req, res)) return;

  const store = await readStore();
  const rows = getAllRows(store);
  const executors = getExecutorList(rows);

  return res.status(200).json({ executors });
}
