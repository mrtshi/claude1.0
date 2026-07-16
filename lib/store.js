import fs from "fs";
import path from "path";

// On Vercel, the filesystem is read-only except for /tmp.
// We keep a bundled seed file in /data for initial (empty) state,
// and persist actual runtime data in /tmp so uploads work across
// requests within the same serverless instance lifetime.
// NOTE: /tmp storage on serverless platforms is ephemeral and may
// reset between deployments or cold starts. For permanent storage,
// connect a database or Vercel Blob (see README).

const SEED_PATH = path.join(process.cwd(), "data", "store.json");
const RUNTIME_PATH = path.join("/tmp", "polair-store.json");

function emptyStore() {
  return {
    reports: {
      "2026": { fileName: null, uploadedAt: null, rows: [] },
      archive_2024_2025: { fileName: null, uploadedAt: null, rows: [] },
    },
  };
}

function readSeed() {
  try {
    const raw = fs.readFileSync(SEED_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return emptyStore();
  }
}

export function readStore() {
  try {
    if (fs.existsSync(RUNTIME_PATH)) {
      const raw = fs.readFileSync(RUNTIME_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    // fall through to seed
  }
  return readSeed();
}

export function writeStore(store) {
  try {
    fs.writeFileSync(RUNTIME_PATH, JSON.stringify(store, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Failed to write store", e);
    return false;
  }
}

export function getReportKey(key) {
  if (key === "2026") return "2026";
  if (key === "archive") return "archive_2024_2025";
  return null;
}
