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
// Authentication detection: we deliberately do NOT try to infer Blob
// availability from environment variables like VERCEL_OIDC_TOKEN or
// BLOB_STORE_ID. On Vercel, when a project is connected via OIDC, the
// OIDC token is delivered to running functions as the `x-vercel-oidc-
// token` request header — NOT as a `process.env.VERCEL_OIDC_TOKEN`
// value (that env var is only populated at build time / in local dev).
// Checking process.env for it at runtime would incorrectly report
// "not configured" even when Blob is working perfectly via the SDK's
// own OIDC handling. Instead, we let the @vercel/blob SDK attempt the
// operation and treat *actual success or failure of that attempt* as
// the source of truth for whether durable storage is available.
//
// For local development (or any environment without Blob configured),
// a failed Blob attempt transparently falls back to a JSON file on disk
// so `npm run dev` keeps working with zero extra setup.

const BLOB_PATHNAME = "polair-store.json";
const LOCAL_FALLBACK_PATH = path.join("/tmp", "polair-store-local.json");
const SEED_PATH = path.join(process.cwd(), "data", "store.json");

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

// --- Local filesystem fallback (development / Blob unavailable) ------

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

// --- Short-lived in-process cache -------------------------------------
//
// The admin page fires off several API calls (status, stats) in quick
// succession, each of which used to independently re-download and
// re-parse the full report JSON from Blob. With ~18,000 rows this JSON
// can be several MB, and doing that 2-3x per page load added real
// latency and, occasionally, timeout risk. We cache the parsed store
// for a few seconds within the same warm serverless instance so those
// near-simultaneous requests share one Blob read.
//
// This does NOT reintroduce the original "stale /tmp" bug: the cache
// only lives a few seconds, is per-instance (never assumed to be
// consistent across instances), and every write (upload/delete) clears
// it immediately so the next read is forced to go back to Blob.
let cachedStore = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

function getCachedStore() {
  if (cachedStore && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedStore;
  }
  return null;
}

function setCachedStore(store) {
  cachedStore = store;
  cachedAt = Date.now();
}

function clearCachedStore() {
  cachedStore = null;
  cachedAt = 0;
}

async function tryReadBlobStore() {
  const cached = getCachedStore();
  if (cached) {
    return { ok: true, store: cached };
  }

  try {
    const { get } = await import("@vercel/blob");
    const result = await get(BLOB_PATHNAME, {
      access: "private",
      useCache: false,
    });

    if (!result) {
      // No blob at this pathname yet — Blob itself is working, there's
      // just nothing uploaded yet. This is the expected state before
      // the first upload.
      const store = readSeed();
      setCachedStore(store);
      return { ok: true, store };
    }

    if (result.statusCode !== 200 || !result.stream) {
      const store = readSeed();
      setCachedStore(store);
      return { ok: true, store };
    }

    const chunks = [];
    for await (const chunk of result.stream) {
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString("utf-8");
    const store = JSON.parse(text);
    setCachedStore(store);
    return { ok: true, store };
  } catch (e) {
    // A 404 (blob not created yet) is an expected state, not a failure
    // of Blob itself.
    if (e && (e.status === 404 || /not.?found/i.test(e.message || ""))) {
      const store = readSeed();
      setCachedStore(store);
      return { ok: true, store };
    }
    // Any other error (missing credentials, network issue, store not
    // connected, etc) means Blob genuinely isn't usable right now.
    console.error("Vercel Blob read failed, falling back to local store", e);
    return { ok: false, store: null };
  }
}

async function tryWriteBlobStore(store) {
  try {
    const { put } = await import("@vercel/blob");
    await put(BLOB_PATHNAME, JSON.stringify(store), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    // Invalidate the cache immediately so the very next read (e.g. the
    // admin page refreshing after an upload) reflects this write rather
    // than serving a stale cached copy for up to CACHE_TTL_MS.
    clearCachedStore();
    return { ok: true };
  } catch (e) {
    console.error("Vercel Blob write failed, falling back to local store", e);
    return { ok: false };
  }
}

// --- Public API ---------------------------------------------------
//
// Both readStore/writeStore always attempt Blob first (regardless of
// what environment variables look like), and only fall back to the
// local file if that attempt genuinely fails. This makes the app work
// correctly whether Blob is configured via a static
// BLOB_READ_WRITE_TOKEN or via a project's OIDC connection.

export async function readStore() {
  const blobResult = await tryReadBlobStore();
  if (blobResult.ok) {
    return blobResult.store;
  }
  return readLocalFallback();
}

// Same as readStore(), but also reports whether the data actually came
// from durable Blob storage or the ephemeral local fallback. Lets the
// admin status endpoint show an accurate warning without performing a
// second, redundant Blob read just to check availability.
export async function readStoreWithMeta() {
  const blobResult = await tryReadBlobStore();
  if (blobResult.ok) {
    return { store: blobResult.store, usingDurableStorage: true };
  }
  return { store: readLocalFallback(), usingDurableStorage: false };
}

export async function writeStore(store) {
  const blobResult = await tryWriteBlobStore(store);
  if (blobResult.ok) {
    return true;
  }
  return writeLocalFallback(store);
}

// Same as writeStore(), but also reports whether the write actually
// landed in durable Blob storage (true) or only in the ephemeral local
// fallback (false), so callers like the upload endpoint can warn the
// admin when a save isn't actually durable.
export async function writeStoreWithMeta(store) {
  const blobResult = await tryWriteBlobStore(store);
  if (blobResult.ok) {
    return { saved: true, usingDurableStorage: true };
  }
  const saved = writeLocalFallback(store);
  return { saved, usingDurableStorage: false };
}

export function getReportKey(key) {
  if (key === "2026") return "2026";
  if (key === "archive") return "archive_2024_2025";
  return null;
}

// --- Backward-compatible check --------------------------------------
//
// Performs a real Blob read attempt to determine current availability.
// Prefer readStoreWithMeta() when you also need the data itself, to
// avoid a redundant Blob call.
export async function isUsingDurableStorage() {
  const result = await tryReadBlobStore();
  return result.ok;
}
