"use client";

/**
 * Placeholder boundary for durable project payloads.
 *
 * V1 keeps the small working dataset in Zustand persistence so the interface is
 * immediately useful. Large uploaded blobs and report versions should move
 * behind this module following the existing `lib/history/db.ts` IndexedDB
 * pattern when collection volume grows.
 */
export const INDUSTRY_DB_NAME = "industry-insight-studio";
