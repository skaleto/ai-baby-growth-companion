// admin/lib/db.mjs
import Database from "better-sqlite3";
import { config } from "./config.mjs";

export function openDb(path = config.dbPath) {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  return db;
}

let singleton = null;
export function db() {
  if (!singleton) singleton = openDb();
  return singleton;
}
