import fs from "fs";
import path from "path";

// --- Storage strategy -----------------------------------------------
//
// This app needs to persist uploaded report data between requests. On a
// normal server that's trivial (write to disk), but on Vercel's
// serverless platform the filesystem is read-only except for /tmp, and
// /tmp is wiped whenever a new instance is spun up (which can happen at
// any time — after periods of inactivity, during scaling, on every
// deploy, etc). That meant reports could silently "disappear" and then
// "reappear" depending on which instance happened to serve a request.
//
// The fix: use Vercel Blob (private storage) as the durable store. It's
// a real persistent object store, so once a report is uploaded it stays
// there regardless of which serverless instance answers the next
// request. We use `access: 'private'` since this data (repair tickets,
// names, phone numbers) shouldn't be reachable via a guessable public
// URL, and we read with `useCache: false` so writes are visible
// immediately instead of waiting out the CDN's cache propagation.
//
// For local development (or any environment without a Blob token
// configured), we transparently fall back to a JSON file on disk so
// `npm run dev` keeps working with zero extra setup.

const BLOB_PATHNAME = "polair-store.json";
const LOCAL_FALLBACK_PATH = path.join("/tmp", "polair-store-local.json");
const SEED_PATH = path.join(process.cwd(), "data", "store.json");

const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

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

// --- Local filesystem fallback (development only) --------------------

function readLocalFallback() {
  try {
    if (fs.existsSync(LOCAL_FALLBACK_PATH)) {
      const raw = fs.readFileSync(LOCAL_FALLBACK_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    // fall through to seed
  }
  return readSeed();
}

function writeLocalFallback(store) {
  try {
    fs.writeFileSync(LOCAL_FALLBACK_PATH, JSON.stringify(store), "utf-8");
    return true;
  } catch (e) {
    console.error("Failed to write local fallback store", e);
    return false;
  }
}

// --- Vercel Blob (production, durable, private) -----------------------

async function readBlobStore() {
  const { get } = await import("@vercel/blob");
  try {
    const result = await get(BLOB_PATHNAME, {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return readSeed();
    }
    const chunks = [];
    for await (const chunk of result.stream) {
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString("utf-8");
    return JSON.parse(text);
  } catch (e) {
    // A 404 (blob not created yet) is the expected state before the
    // first upload — treat it as an empty store rather than an error.
    if (e && (e.status === 404 || /not.?found/i.test(e.message || ""))) {
      return readSeed();
    }
    console.error("Failed to read blob store", e);
    return readSeed();
  }
}

async function writeBlobStore(store) {
  const { put } = await import("@vercel/blob");
  try {
    await put(BLOB_PATHNAME, JSON.stringify(store), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return true;
  } catch (e) {
    console.error("Failed to write blob store", e);
    return false;
  }
}

// --- Public API ---------------------------------------------------

export async function readStore() {
  if (hasBlobToken) {
    return readBlobStore();
  }
  return readLocalFallback();
}

export async function writeStore(store) {
  if (hasBlobToken) {
    return writeBlobStore(store);
  }
  return writeLocalFallback(store);
}

export function getReportKey(key) {
  if (key === "2026") return "2026";
  if (key === "archive") return "archive_2024_2025";
  return null;
}

export function isUsingDurableStorage() {
  return hasBlobToken;
}
